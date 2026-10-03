"""Copernicus Data Space Process API integration for Sentinel-2 imagery."""
import asyncio
import time
from datetime import date, datetime, time as datetime_time, timezone
from typing import Optional

import httpx

from ..config import settings

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
PROCESS_URL = "https://sh.dataspace.copernicus.eu/process/v1"

_access_token: Optional[str] = None
_token_expires_at = 0.0
_token_lock = asyncio.Lock()


class SatelliteProviderError(Exception):
    """A safe, user-facing error from the satellite provider integration."""


def is_configured() -> bool:
    return bool(settings.CDSE_CLIENT_ID and settings.CDSE_CLIENT_SECRET)


async def _get_access_token(client: httpx.AsyncClient) -> str:
    global _access_token, _token_expires_at
    if _access_token and time.monotonic() < _token_expires_at:
        return _access_token

    async with _token_lock:
        if _access_token and time.monotonic() < _token_expires_at:
            return _access_token
        try:
            response = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.CDSE_CLIENT_ID,
                    "client_secret": settings.CDSE_CLIENT_SECRET,
                },
            )
            response.raise_for_status()
            token_data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise SatelliteProviderError("Copernicus authentication failed. Check the configured OAuth credentials.") from exc

        _access_token = token_data["access_token"]
        _token_expires_at = time.monotonic() + max(60, int(token_data.get("expires_in", 300)) - 60)
        return _access_token


async def fetch_sentinel2_preview(
    *,
    client: httpx.AsyncClient,
    bbox: list[float],
    acquisition_date: date,
    cloud_cover: int,
) -> bytes:
    """Return a 512px true-color Sentinel-2 L2A image for one UTC calendar day."""
    start = datetime.combine(acquisition_date, datetime_time.min, tzinfo=timezone.utc)
    end = datetime.combine(acquisition_date, datetime_time.max, tzinfo=timezone.utc)
    request_body = {
        "input": {
            "bounds": {
                "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
                "bbox": bbox,
            },
            "data": [{
                "type": "sentinel-2-l2a",
                "dataFilter": {
                    "timeRange": {"from": start.isoformat(), "to": end.isoformat()},
                    "maxCloudCoverage": cloud_cover,
                    "mosaickingOrder": "leastCC",
                },
            }],
        },
        "output": {
            "width": 512,
            "height": 512,
            "responses": [{"format": {"type": "image/jpeg"}}],
        },
        "evalscript": """//VERSION=3
function setup() {
  return { input: ["B02", "B03", "B04"], output: { bands: 3, sampleType: "AUTO" } };
}
function evaluatePixel(sample) {
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
}""",
    }
    token = await _get_access_token(client)
    try:
        response = await client.post(
            PROCESS_URL,
            json=request_body,
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 404, 422):
            raise SatelliteProviderError(
                f"Copernicus could not create imagery for {acquisition_date}. Try another date or increase the cloud limit."
            ) from exc
        if exc.response.status_code == 401:
            _access_token = None
            _token_expires_at = 0.0
            raise SatelliteProviderError("Copernicus rejected the OAuth token. Check the configured credentials.") from exc
        raise SatelliteProviderError("Copernicus image processing is unavailable. Try again later.") from exc
    except httpx.HTTPError as exc:
        raise SatelliteProviderError("Could not connect to the Copernicus image service.") from exc

    if not response.headers.get("content-type", "").startswith("image/"):
        raise SatelliteProviderError("Copernicus returned an unexpected image response.")
    return response.content
