"""GIS Module — pixel to geo coordinate transforms, GeoJSON generation, area calculation."""
import math
from typing import List, Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)


def pixel_to_latlon(
    px: float,
    py: float,
    ref_lat: float,
    ref_lon: float,
    img_width: int,
    img_height: int,
    gsd_meters: float = 0.5
) -> Tuple[float, float]:
    """
    Convert image pixel coordinate (px, py) to (lat, lon) based on reference center.
    
    Args:
        px: pixel x coordinate (column)
        py: pixel y coordinate (row)
        ref_lat: latitude at image center
        ref_lon: longitude at image center
        img_width: image width in pixels
        img_height: image height in pixels
        gsd_meters: ground sample distance in meters per pixel
        
    Returns:
        (latitude, longitude)
    """
    # Image center
    cx = img_width / 2.0
    cy = img_height / 2.0
    
    # Distance in meters from center
    dx_meters = (px - cx) * gsd_meters
    dy_meters = (cy - py) * gsd_meters  # py increases downward, North is upward
    
    # Approx Earth conversion
    # 1 deg lat = ~111,320 m
    # 1 deg lon = ~111,320 * cos(lat) m
    lat_deg_per_meter = 1.0 / 111320.0
    lon_deg_per_meter = 1.0 / (111320.0 * math.cos(math.radians(ref_lat)) + 1e-10)
    
    lat = ref_lat + (dy_meters * lat_deg_per_meter)
    lon = ref_lon + (dx_meters * lon_deg_per_meter)
    
    return round(lat, 6), round(lon, 6)


def calculate_area_hectares(area_pixels: int, gsd_meters: float = 0.5) -> float:
    """
    Calculate real-world area in hectares from pixel count and GSD.
    1 hectare = 10,000 square meters.
    """
    area_sq_meters = area_pixels * (gsd_meters ** 2)
    area_ha = area_sq_meters / 10000.0
    return round(area_ha, 4)


def build_geojson(
    regions: List[Dict[str, Any]],
    ref_lat: float,
    ref_lon: float,
    img_width: int,
    img_height: int,
    gsd_meters: float = 0.5
) -> Dict[str, Any]:
    """
    Convert detected regions into GeoJSON FeatureCollection with properties.
    """
    features = []
    
    for r in regions:
        # Convert polygon pixels to coordinates
        poly_coords = []
        for pt in r.get("polygon", []):
            px, py = pt[0], pt[1]
            lat, lon = pixel_to_latlon(px, py, ref_lat, ref_lon, img_width, img_height, gsd_meters)
            poly_coords.append([lon, lat])  # GeoJSON standard is [lon, lat]
            
        # Ensure polygon ring is closed
        if poly_coords and poly_coords[0] != poly_coords[-1]:
            poly_coords.append(poly_coords[0])
            
        c_px, c_py = r.get("centroid", [img_width // 2, img_height // 2])
        c_lat, c_lon = pixel_to_latlon(c_px, c_py, ref_lat, ref_lon, img_width, img_height, gsd_meters)
        area_ha = calculate_area_hectares(r.get("area_pixels", 0), gsd_meters)
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [poly_coords] if poly_coords else []
            },
            "properties": {
                "id": r.get("id"),
                "change_type": r.get("change_type", "Other"),
                "confidence": r.get("confidence", 50.0),
                "area_hectares": area_ha,
                "area_pixels": r.get("area_pixels", 0),
                "mean_intensity": r.get("mean_intensity", 0.0),
                "centroid": [c_lat, c_lon]
            }
        }
        features.append(feature)
        
    return {
        "type": "FeatureCollection",
        "features": features
    }
