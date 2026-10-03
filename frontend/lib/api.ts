/**
 * TerraTrace API Client — Communicates with FastAPI backend
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface LocationItem {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  created_at: string;
  scan_count: number;
  latest_scan_status?: string;
}

export interface LocationDetail extends Omit<LocationItem, "scan_count" | "latest_scan_status"> {
  scans: {
    id: number;
    status: ScanItem["status"];
    created_at: string;
    alignment_quality?: number;
    old_thumbnail?: string;
    new_thumbnail?: string;
    overlay_path?: string;
    detections_count: number;
  }[];
}

export interface ScanItem {
  id: number;
  location_id: number;
  status: "uploaded" | "processing" | "completed" | "failed";
  current_step?: string;
  progress: number;
  alignment_quality?: number;
  old_thumbnail?: string;
  new_thumbnail?: string;
  old_image_path?: string;
  new_image_path?: string;
  aligned_image_path?: string;
  diff_heatmap_path?: string;
  detection_overlay_path?: string;
  geojson_path?: string;
  has_georef: boolean;
  gsd_meters: number;
  scan_date_old?: string;
  scan_date_new?: string;
  created_at: string;
  completed_at?: string;
  detection_count: number;
  total_area_ha: number;
}

export interface ScanTimelineItem {
  scan_id: number;
  created_at: string;
  status: ScanItem["status"];
  total_area_ha: number;
  detections_count: number;
  alignment_quality?: number;
  thumbnail?: string;
}

export interface DetectionItem {
  id: number;
  change_type: "Deforestation" | "Construction" | "Mining" | "Other";
  confidence: number;
  area_hectares: number;
  centroid_lat: number;
  centroid_lon: number;
  polygon: { type: "Polygon"; coordinates: [number, number][][] } | { type: "Point"; coordinates: [number, number] };
  bbox: [number, number, number, number];
  area_pixels: number;
  mean_intensity: number;
}

export interface LiveMapFeature {
  id: string;
  category: "mining" | "protected";
  lat: number;
  lon: number;
  name: string;
  tags: Record<string, string>;
  source: string;
  source_url: string;
  osm_type: string;
  osm_id: number;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  boundingbox?: string[];
  address: Record<string, string>;
  source: string;
}

export interface AnalysisResults {
  scan_id: number;
  location_id: number;
  status: string;
  alignment_quality?: number;
  total_area_ha: number;
  avg_confidence: number;
  change_type_counts: Record<string, number>;
  aligned_image_path?: string;
  diff_heatmap_path?: string;
  detection_overlay_path?: string;
  geojson_path?: string;
  report_pdf_path?: string;
  old_thumbnail?: string;
  new_thumbnail?: string;
  old_image_path?: string;
  new_image_path?: string;
  scan_date_old?: string;
  scan_date_new?: string;
  created_at?: string;
  detections: DetectionItem[];
}

export interface AnalysisStartResponse {
  scan_id: number;
  status: ScanItem["status"];
  message: string;
}

export interface AnalysisStatusResponse {
  scan_id: number;
  status: ScanItem["status"];
  current_step?: string;
  progress: number;
  error_message?: string;
}

export interface DashboardStats {
  total_locations: number;
  total_scans: number;
  total_detections: number;
  total_changed_area_ha: number;
  change_area_delta_pct: number;
  change_type_counts: {
    Deforestation: number;
    Construction: number;
    Mining: number;
    Other: number;
  };
  avg_confidence: number;
  suspicious_sites: number;
  recent_activity: {
    scan_id: number;
    location_name: string;
    status: string;
    created_at: string;
    detections: number;
  }[];
}

export interface AlertItem {
  id: number;
  location_id: number;
  location_name: string;
  rule_type: string;
  threshold_ha: number;
  change_type_filter: string;
  status: "active" | "triggered" | "investigating" | "resolved";
  notification_method: string;
  triggered_at?: string;
  created_at: string;
}

export interface HealthStatus {
  status: string;
  app: string;
  version: string;
  timestamp: string;
}

export interface SatelliteScene {
  id: string;
  datetime?: string;
  cloud_cover?: number;
  platform?: string;
  thumbnail?: string | null;
  catalog_url: string;
}

export interface SatelliteApiStatus {
  catalog_search: boolean;
  sentinel2_processing: boolean;
}

export interface PixabayImage {
  id: number;
  image_url: string;
  source_url: string;
  tags: string;
  photographer: string;
  width?: number;
  height?: number;
}

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE_URL}/api/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("Backend health check failed");
    return res.json();
  },

  async searchSatelliteScenes(params: {
    locationId: number;
    startDate: string;
    endDate: string;
    cloudCover: number;
  }): Promise<{ location_id: number; collection: string; scenes: SatelliteScene[] }> {
    const query = new URLSearchParams({
      location_id: String(params.locationId),
      start_date: params.startDate,
      end_date: params.endDate,
      cloud_cover: String(params.cloudCover),
    });
    const res = await fetch(`${API_BASE_URL}/api/satellite/search?${query}`, { cache: "no-store" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Satellite catalog search failed" }));
      throw new Error(error.detail || "Satellite catalog search failed");
    }
    return res.json();
  },

  async getSatelliteStatus(): Promise<SatelliteApiStatus> {
    const res = await fetch(`${API_BASE_URL}/api/satellite/status`, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not check satellite processing configuration");
    return res.json();
  },

  async ingestSatellitePair(params: {
    locationId: number;
    beforeDate: string;
    afterDate: string;
    cloudCover: number;
  }): Promise<{ scan_id: number; location_id: number; status: ScanItem["status"]; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/satellite/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: params.locationId,
        before_date: params.beforeDate,
        after_date: params.afterDate,
        cloud_cover: params.cloudCover,
      }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Could not fetch satellite imagery" }));
      throw new Error(error.detail || "Could not fetch satellite imagery");
    }
    return res.json();
  },

  async searchPixabayImages(query: string): Promise<{ query: string; source: string; images: PixabayImage[] }> {
    const params = new URLSearchParams({ query });
    const res = await fetch(`${API_BASE_URL}/api/media/pixabay?${params}`, { cache: "no-store" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Pixabay image search failed" }));
      throw new Error(error.detail || "Pixabay image search failed");
    }
    return res.json();
  },

  // Stats
  async getStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE_URL}/api/stats`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return res.json();
  },

  // Locations
  async getLocations(): Promise<LocationItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/locations`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch locations");
    return res.json();
  },

  async geocodePlace(query: string): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({ q: query });
    const res = await fetch(`${API_BASE_URL}/api/map/geocode?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Place search is temporarily unavailable");
    return res.json();
  },

  async reverseGeocode(lat: number, lon: number): Promise<GeocodeResult> {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    const res = await fetch(`${API_BASE_URL}/api/map/reverse?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Administrative area lookup is temporarily unavailable");
    return res.json();
  },

  async getLiveMapFeatures(bounds: { west: number; south: number; east: number; north: number }): Promise<{ features: LiveMapFeature[]; count: number; source: string; license: string; retrieved_at: string }> {
    const params = new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]));
    const res = await fetch(`${API_BASE_URL}/api/map/live-features?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Live feature data is temporarily unavailable");
    return res.json();
  },

  async getLocation(id: number): Promise<LocationDetail> {
    const res = await fetch(`${API_BASE_URL}/api/locations/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch location detail");
    return res.json();
  },

  async getLocationTimeline(id: number): Promise<ScanTimelineItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/locations/${id}/timeline`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch location timeline");
    return res.json();
  },

  // Scans
  async getScans(): Promise<ScanItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/scans`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch scans");
    return res.json();
  },

  // Upload
  async uploadScan(formData: FormData): Promise<{ scan_id: number; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  // Analysis
  async startAnalysis(scanId: number, options?: { change_threshold?: number; min_region_area_px?: number }): Promise<AnalysisStartResponse> {
    const res = await fetch(`${API_BASE_URL}/api/analysis/${scanId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) throw new Error("Failed to dispatch analysis");
    return res.json();
  },

  async getAnalysisStatus(scanId: number): Promise<AnalysisStatusResponse> {
    const res = await fetch(`${API_BASE_URL}/api/analysis/${scanId}/status`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch analysis status");
    return res.json();
  },

  async getAnalysisResults(scanId: number): Promise<AnalysisResults> {
    const res = await fetch(`${API_BASE_URL}/api/analysis/${scanId}/results`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch analysis results");
    return res.json();
  },

  async getGeoJSON(scanId: number): Promise<import("geojson").FeatureCollection> {
    const res = await fetch(`${API_BASE_URL}/api/analysis/${scanId}/geojson`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch geojson");
    return res.json();
  },

  // Alerts
  async getAlerts(): Promise<AlertItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/alerts`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch alerts");
    return res.json();
  },

  async createAlert(data: { location_id: number; threshold_ha: number; change_type_filter: string }): Promise<AlertItem> {
    const res = await fetch(`${API_BASE_URL}/api/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create alert rule");
    return res.json();
  },

  async updateAlert(alertId: number, status: string): Promise<AlertItem> {
    const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update alert");
    return res.json();
  },

  getReportDownloadUrl(scanId: number): string {
    return `${API_BASE_URL}/api/reports/${scanId}/download`;
  },

  getAssetUrl(relativePath?: string | null): string {
    if (!relativePath) return "";
    if (relativePath.startsWith("http")) return relativePath;
    return `${API_BASE_URL}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
  }
};
