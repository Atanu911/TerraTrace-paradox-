"""Pydantic schemas for API request/response."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Location ──────────────────────────────────────────────

class LocationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    description: str = ""


class LocationResponse(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    description: str
    created_at: datetime
    scan_count: int = 0
    latest_scan_status: Optional[str] = None


# ── Scan ──────────────────────────────────────────────────

class ScanCreate(BaseModel):
    location_id: int
    gsd_meters: float = 0.5
    scan_date_old: Optional[datetime] = None
    scan_date_new: Optional[datetime] = None


class ScanResponse(BaseModel):
    id: int
    location_id: int
    status: str
    current_step: Optional[str]
    progress: float
    alignment_quality: Optional[float]
    old_thumbnail: Optional[str]
    new_thumbnail: Optional[str]
    aligned_image_path: Optional[str]
    diff_heatmap_path: Optional[str]
    detection_overlay_path: Optional[str]
    geojson_path: Optional[str]
    has_georef: bool
    gsd_meters: float
    scan_date_old: Optional[datetime]
    scan_date_new: Optional[datetime]
    created_at: datetime
    completed_at: Optional[datetime]
    detection_count: int = 0
    total_area_ha: float = 0.0


# ── Detection ─────────────────────────────────────────────

class DetectionResponse(BaseModel):
    id: int
    scan_id: int
    change_type: str
    confidence: float
    area_hectares: float
    centroid_lat: float
    centroid_lon: float
    polygon_geojson: str
    bbox: str
    area_pixels: int
    mean_change_intensity: float
    created_at: datetime


# ── Analysis ──────────────────────────────────────────────

class AnalysisStartRequest(BaseModel):
    change_threshold: float = 0.3
    min_region_area_px: int = 50
    alignment_method: str = "orb"


class AnalysisStatusResponse(BaseModel):
    scan_id: int
    status: str
    current_step: Optional[str]
    progress: float
    error_message: Optional[str]


class AnalysisResultResponse(BaseModel):
    scan_id: int
    status: str
    alignment_quality: Optional[float]
    detections: list[DetectionResponse] = []
    total_area_ha: float = 0.0
    change_type_counts: dict[str, int] = {}
    avg_confidence: float = 0.0
    geojson_path: Optional[str]
    diff_heatmap_path: Optional[str] = None
    detection_overlay_path: Optional[str] = None
    old_thumbnail: Optional[str] = None
    new_thumbnail: Optional[str] = None
    old_image_path: Optional[str] = None
    new_image_path: Optional[str] = None
    aligned_image_path: Optional[str] = None
    scan_date_old: Optional[datetime] = None
    scan_date_new: Optional[datetime] = None
    created_at: Optional[datetime] = None


# ── Stats ─────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_locations: int = 0
    total_scans: int = 0
    total_detections: int = 0
    total_changed_area_ha: float = 0.0
    change_area_delta_pct: float = 0.0
    change_type_counts: dict[str, int] = {}
    avg_confidence: float = 0.0
    suspicious_sites: int = 0
    recent_activity: list[dict] = []


# ── Alerts ────────────────────────────────────────────────

class AlertCreate(BaseModel):
    location_id: int
    rule_type: str = "area_threshold"
    threshold_ha: float = 1.0
    change_type_filter: str = "all"
    notification_method: str = "browser"


class AlertResponse(BaseModel):
    id: int
    location_id: int
    rule_type: str
    threshold_ha: float
    change_type_filter: str
    status: str
    notification_method: str
    triggered_at: Optional[datetime]
    created_at: datetime
    location_name: str = ""


class AlertUpdate(BaseModel):
    status: Optional[str] = None


# ── Pipeline Progress (WebSocket) ─────────────────────────

class PipelineProgress(BaseModel):
    step: str
    status: str  # running, complete, error
    progress: float = 0.0
    message: str = ""
    image_url: Optional[str] = None
    data: Optional[dict] = None
