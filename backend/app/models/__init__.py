"""TerraTrace Database Models"""
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
import json


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Location(SQLModel, table=True):
    """A geographic location being monitored."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    latitude: float
    longitude: float
    description: str = ""
    created_at: datetime = Field(default_factory=now_utc)
    
    # Relationships
    scans: list["Scan"] = Relationship(back_populates="location")
    alerts: list["Alert"] = Relationship(back_populates="location")


class Scan(SQLModel, table=True):
    """A before/after scan analysis job."""
    id: Optional[int] = Field(default=None, primary_key=True)
    location_id: int = Field(foreign_key="location.id")
    
    # Image paths
    old_image_path: str
    new_image_path: str
    drone_image_path: Optional[str] = None
    old_thumbnail: Optional[str] = None
    new_thumbnail: Optional[str] = None
    
    # Status
    status: str = Field(default="uploaded")  # uploaded, processing, completed, failed
    current_step: Optional[str] = None
    progress: float = 0.0
    error_message: Optional[str] = None
    
    # Pipeline outputs
    aligned_image_path: Optional[str] = None
    diff_heatmap_path: Optional[str] = None
    detection_overlay_path: Optional[str] = None
    geojson_path: Optional[str] = None
    
    # Metadata
    alignment_quality: Optional[float] = None
    pipeline_metadata: Optional[str] = None  # JSON string
    
    # Georeferencing
    has_georef: bool = False
    gsd_meters: float = 0.5  # ground sample distance
    
    # Dates
    scan_date_old: Optional[datetime] = None
    scan_date_new: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    completed_at: Optional[datetime] = None
    
    # Relationships
    location: Optional[Location] = Relationship(back_populates="scans")
    detections: list["Detection"] = Relationship(back_populates="scan")
    report: Optional["Report"] = Relationship(back_populates="scan")
    
    def get_metadata(self) -> dict:
        if self.pipeline_metadata:
            return json.loads(self.pipeline_metadata)
        return {}
    
    def set_metadata(self, data: dict):
        self.pipeline_metadata = json.dumps(data)


class Detection(SQLModel, table=True):
    """A detected change region."""
    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: int = Field(foreign_key="scan.id")
    
    # Classification
    change_type: str  # Construction, Deforestation, Mining, Other
    confidence: float  # 0-100
    
    # Geography
    area_hectares: float
    centroid_lat: float
    centroid_lon: float
    
    # Geometry (stored as JSON strings)
    polygon_geojson: str  # GeoJSON geometry
    bbox: str  # [x1, y1, x2, y2] in pixels
    
    # Pixel-level info
    area_pixels: int = 0
    mean_change_intensity: float = 0.0
    
    created_at: datetime = Field(default_factory=now_utc)
    
    # Relationships
    scan: Optional[Scan] = Relationship(back_populates="detections")
    
    def get_polygon(self) -> dict:
        return json.loads(self.polygon_geojson)
    
    def get_bbox(self) -> list:
        return json.loads(self.bbox)


class Report(SQLModel, table=True):
    """A forensic evidence report."""
    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: int = Field(foreign_key="scan.id", unique=True)
    
    pdf_path: str
    sha256_old: str
    sha256_new: str
    
    created_at: datetime = Field(default_factory=now_utc)
    
    # Relationships
    scan: Optional[Scan] = Relationship(back_populates="report")


class Alert(SQLModel, table=True):
    """An alert rule for monitoring changes."""
    id: Optional[int] = Field(default=None, primary_key=True)
    location_id: int = Field(foreign_key="location.id")
    
    # Rule
    rule_type: str = "area_threshold"  # area_threshold
    threshold_ha: float = 1.0
    change_type_filter: str = "all"  # all, Construction, Deforestation, Mining
    
    # Status
    status: str = "active"  # active, triggered, investigating, resolved
    notification_method: str = "browser"  # browser, email, webhook
    
    triggered_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)
    
    # Relationships
    location: Optional[Location] = Relationship(back_populates="alerts")
