"""Cached Pixabay search with local image copies for safe UI display."""
import asyncio
import hashlib
import json
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from ..config import settings

PIXABAY_API_URL = "https://pixabay.com/api/"
CACHE_DIR = Path(settings.UPLOAD_DIR) / "pixabay-cache"
CACHE_INDEX = CACHE_DIR / "index.json"
CACHE_TTL_SECONDS = 24 * 60 * 60
_cache_lock = asyncio.Lock()


class PixabayProviderError(Exception):
    """A safe, user-facing Pixabay service error."""


def is_configured() -> bool:
    return bool(settings.PIXABAY_API_KEY)


def _read_cache() -> dict[str, Any]:
    try:
        return json.loads(CACHE_INDEX.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write_cache(cache: dict[str, Any]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_INDEX.write_text(json.dumps(cache), encoding="utf-8")


async def search_and_cache_images(query: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Search Pixabay, download display-size results locally, cache the response for 24 hours."""
    normalized_query = " ".join(query.split()).lower()
    cache_key = hashlib.sha256(normalized_query.encode("utf-8")).hexdigest()
    async with _cache_lock:
        cache = _read_cache()
        cached = cache.get(cache_key)
        if cached and cached.get("expires_at", 0) > time.time():
            return cached.get("images", [])

        try:
            response = await client.get(
                PIXABAY_API_URL,
                params={
                    "key": settings.PIXABAY_API_KEY,
                    "q": normalized_query,
                    "image_type": "photo",
                    "orientation": "horizontal",
                    "safesearch": "true",
                    "per_page": 6,
                },
            )
            response.raise_for_status()
            hits = response.json().get("hits", [])
        except (httpx.HTTPError, ValueError) as exc:
            raise PixabayProviderError("Pixabay image search is unavailable. Check the API key and try again.") from exc

        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        images = []
        for hit in hits[:6]:
            image_url = hit.get("webformatURL")
            if not image_url:
                continue
            parsed = urlparse(image_url)
            if parsed.hostname not in {"pixabay.com", "cdn.pixabay.com"}:
                continue
            suffix = Path(parsed.path).suffix.lower()
            if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
                suffix = ".jpg"
            filename = f"{int(hit['id'])}{suffix}"
            local_path = CACHE_DIR / filename
            if not local_path.is_file():
                try:
                    image_response = await client.get(image_url)
                    image_response.raise_for_status()
                    if not image_response.headers.get("content-type", "").startswith("image/"):
                        continue
                    local_path.write_bytes(image_response.content)
                except (httpx.HTTPError, OSError):
                    continue
            images.append({
                "id": hit.get("id"),
                "image_url": f"/uploads/pixabay-cache/{filename}",
                "source_url": hit.get("pageURL", "https://pixabay.com/"),
                "tags": hit.get("tags", "Earth imagery"),
                "photographer": hit.get("user", "Pixabay contributor"),
                "width": hit.get("webformatWidth"),
                "height": hit.get("webformatHeight"),
            })

        cache[cache_key] = {"expires_at": time.time() + CACHE_TTL_SECONDS, "images": images}
        _write_cache(cache)
        return images
