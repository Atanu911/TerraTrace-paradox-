"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database, Upload, Image as ImageIcon, Calendar, Satellite, Search, ExternalLink } from "lucide-react";
import { api, ScanItem, LocationItem, SatelliteScene, PixabayImage } from "@/lib/api";

export default function DataSourcesPage() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cloudCover, setCloudCover] = useState(30);
  const [scenes, setScenes] = useState<SatelliteScene[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [sentinelProcessingReady, setSentinelProcessingReady] = useState(false);
  const [beforeDate, setBeforeDate] = useState(() => new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10));
  const [afterDate, setAfterDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState("");
  const [pixabayQuery, setPixabayQuery] = useState("earth from space");
  const [pixabayImages, setPixabayImages] = useState<PixabayImage[]>([]);
  const [pixabayLoading, setPixabayLoading] = useState(false);
  const [pixabayMessage, setPixabayMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [scanData, locationData] = await Promise.all([
          api.getScans(),
          api.getLocations(),
        ]);
        setScans(scanData);
        setLocations(locationData);
        if (locationData.length) setSelectedLocation(String(locationData[0].id));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not load uploaded image records.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    api.getSatelliteStatus().then((status) => setSentinelProcessingReady(status.sentinel2_processing)).catch(() => setSentinelProcessingReady(false));
  }, []);

  const searchSatellite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocation) {
      setSearchMessage("Create a monitoring location before searching the satellite catalog.");
      return;
    }
    setSearching(true);
    setSearchMessage("");
    try {
      const result = await api.searchSatelliteScenes({
        locationId: Number(selectedLocation), startDate, endDate, cloudCover,
      });
      setScenes(result.scenes);
      setSearchMessage(result.scenes.length ? `${result.scenes.length} scene${result.scenes.length === 1 ? "" : "s"} found.` : "No scenes found. Try a wider date range or a higher cloud limit.");
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : "Satellite catalog search failed.");
    } finally {
      setSearching(false);
    }
  };

  const createSatelliteScan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocation) {
      setIngestMessage("Choose a monitoring location first.");
      return;
    }
    setIngesting(true);
    setIngestMessage("");
    try {
      const scan = await api.ingestSatellitePair({
        locationId: Number(selectedLocation), beforeDate, afterDate, cloudCover,
      });
      router.push(`/analyze?scan_id=${scan.scan_id}&location_id=${scan.location_id}`);
    } catch (error) {
      setIngestMessage(error instanceof Error ? error.message : "Could not fetch Sentinel-2 imagery.");
    } finally {
      setIngesting(false);
    }
  };

  const searchPixabay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPixabayLoading(true);
    setPixabayMessage("");
    try {
      const result = await api.searchPixabayImages(pixabayQuery);
      setPixabayImages(result.images);
      setPixabayMessage(result.images.length ? `${result.images.length} images found. Results are cached for 24 hours.` : "No images found. Try another search phrase.");
    } catch (error) {
      setPixabayMessage(error instanceof Error ? error.message : "Pixabay image search failed.");
    } finally {
      setPixabayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-2">
          <Database className="h-3 w-3" />
          <span>DATA MANAGEMENT • SOURCE IMAGES</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Data & Sources</h1>
        <p className="text-slate-400">
          Manage uploaded satellite and drone imagery for analysis
        </p>
      </div>

      {errorMessage && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{errorMessage}</p>}

      {/* Upload Section */}
      <section className="glass-card rounded-2xl p-6 border border-cyan-400/20 bg-[#0C1C2C]/72 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-2 text-cyan-300"><Satellite className="h-5 w-5" /><h2 className="text-lg font-semibold text-white">Search Sentinel-2 satellite imagery</h2></div>
        <p className="text-sm text-slate-400 mb-5">Search the Copernicus Data Space catalog for Level-2A scenes within approximately 10 km of a monitoring location.</p>
        <form onSubmit={searchSatellite} className="grid gap-3 md:grid-cols-5">
          <label className="text-xs text-slate-400">Monitoring location<select value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#071522] p-2 text-sm text-white" required><option value="">Choose location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className="text-xs text-slate-400">From<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#071522] p-2 text-sm text-white" required /></label>
          <label className="text-xs text-slate-400">To<input type="date" value={endDate} min={startDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#071522] p-2 text-sm text-white" required /></label>
          <label className="text-xs text-slate-400">Maximum cloud cover (%)<input type="number" min="0" max="100" value={cloudCover} onChange={(event) => setCloudCover(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#071522] p-2 text-sm text-white" /></label>
          <button type="submit" disabled={searching || !locations.length} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"><Search className="h-4 w-4" />{searching ? "Searching…" : "Search catalog"}</button>
        </form>
        {searchMessage && <p role="status" className="mt-4 text-sm text-slate-300">{searchMessage}</p>}
        {scenes.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{scenes.map((scene) => <article key={scene.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#071522]">{scene.thumbnail && <img src={scene.thumbnail} alt="Satellite scene preview" className="h-36 w-full object-cover" loading="lazy" />}<div className="p-4"><p className="truncate text-sm font-medium text-white" title={scene.id}>{scene.id}</p><p className="mt-1 text-xs text-slate-400">{scene.datetime ? new Date(scene.datetime).toLocaleString() : "Acquisition date unavailable"} · {scene.cloud_cover == null ? "Cloud cover unavailable" : `${scene.cloud_cover.toFixed(1)}% clouds`}</p><a href={scene.catalog_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">Open catalog record <ExternalLink className="h-3 w-3" /></a></div></article>)}</div>}
        <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="text-sm font-semibold text-white">Create a Sentinel-2 comparison</h3>
          <p className="mt-1 text-xs text-slate-400">Fetch before and after images for this location and send the pair to the existing change-analysis workflow.</p>
          <form onSubmit={createSatelliteScan} className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-xs text-slate-400">Before date<input type="date" value={beforeDate} max={afterDate} onChange={(event) => setBeforeDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#071522] p-2 text-sm text-white" required /></label>
            <label className="text-xs text-slate-400">After date<input type="date" value={afterDate} min={beforeDate} max={new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)} onChange={(event) => setAfterDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#071522] p-2 text-sm text-white" required /></label>
            <p className="self-end pb-2 text-xs text-slate-500">Area: 2 km radius · cloud limit: {cloudCover}%</p>
            <button type="submit" disabled={ingesting || !sentinelProcessingReady || !locations.length} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{ingesting ? "Fetching images…" : "Fetch pair & open Analyze"}</button>
          </form>
          {ingestMessage && <p role="alert" className="mt-3 text-sm text-rose-200">{ingestMessage}</p>}
          {!sentinelProcessingReady && <p className="mt-3 text-xs text-amber-200">Automatic downloads need a Copernicus OAuth client. Set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET in the backend .env, then restart the API. Keep the secret on the backend.</p>}
        </div>
        <p className="mt-4 text-xs text-slate-500">Catalog search is public and needs no API key. Sentinel-2 image retrieval uses the server-side Copernicus Process API.</p>
      </section>

      <section className="glass-card rounded-2xl p-6 border border-emerald-400/15 bg-[#0C1C2C]/72 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Pixabay environmental imagery</h2>
            <p className="mt-1 text-sm text-slate-400">Find supporting landscape and earth observation visuals for your project.</p>
          </div>
          <form onSubmit={searchPixabay} className="flex w-full gap-2 sm:w-auto">
            <input value={pixabayQuery} onChange={(event) => setPixabayQuery(event.target.value)} maxLength={100} aria-label="Search Pixabay images" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#071522] px-3 py-2 text-sm text-white sm:w-64" placeholder="e.g. aerial forest" />
            <button type="submit" disabled={pixabayLoading || pixabayQuery.trim().length < 2} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"><Search className="h-4 w-4" />{pixabayLoading ? "Searching…" : "Search"}</button>
          </form>
        </div>
        {pixabayMessage && <p role="status" className="mt-4 text-sm text-slate-300">{pixabayMessage}</p>}
        {pixabayImages.length > 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{pixabayImages.map((image) => <article key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#071522]/80"><img src={api.getAssetUrl(image.image_url)} alt={image.tags} loading="lazy" className="h-44 w-full object-cover" /><div className="flex items-center justify-between gap-2 p-3"><div className="min-w-0"><p className="truncate text-xs text-slate-200">{image.tags}</p><p className="mt-1 text-[11px] text-slate-500">Photo by {image.photographer} · Pixabay</p></div><a href={image.source_url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-cyan-300 hover:underline">Source</a></div></article>)}</div>}
      </section>

      {/* Upload Section */}
      <div className="glass-card rounded-2xl p-6 border border-white/6 bg-[#0C1C2C]/72 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Upload New Images</h2>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
          >
            <Upload className="h-4 w-4" />
            New Upload
          </Link>
        </div>
        <p className="text-sm text-slate-400">
          Upload satellite or drone image pairs for temporal change detection analysis
        </p>
      </div>

      {/* Uploaded Images */}
      <div className="glass-card rounded-2xl border border-white/6 bg-[#0C1C2C]/72 backdrop-blur-xl overflow-hidden">
        <div className="p-6 border-b border-white/6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ImageIcon aria-hidden="true" className="h-5 w-5" />
            Uploaded Images
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {scans.length} image pairs uploaded across {locations.length} monitoring locations
          </p>
        </div>

        {scans.length === 0 ? (
          <div className="p-12 text-center">
            <ImageIcon aria-hidden="true" className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No images uploaded yet</p>
            <p className="text-sm text-slate-500">
              Start by uploading your first satellite or drone image pair
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/6">
                <tr>
                  <th className="p-4 font-medium text-slate-300">Scan ID</th>
                  <th className="p-4 font-medium text-slate-300">Location</th>
                  <th className="p-4 font-medium text-slate-300">Upload Date</th>
                  <th className="p-4 font-medium text-slate-300">Status</th>
                  <th className="p-4 font-medium text-slate-300">GSD (m)</th>
                  <th className="p-4 font-medium text-slate-300">Georeferenced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {scans.map((scan) => {
                  const location = locations.find(loc => loc.id === scan.location_id);
                  return (
                    <tr key={scan.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <span className="font-mono text-cyan-400">
                          #{scan.id.toString().padStart(3, "0")}
                        </span>
                      </td>
                      <td className="p-4 text-white">
                        {location?.name || `Zone ${scan.location_id}`}
                      </td>
                      <td className="p-4 text-slate-300 flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {new Date(scan.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          scan.status === 'completed' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : scan.status === 'processing'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {scan.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">
                        {scan.gsd_meters.toFixed(2)}m
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          scan.has_georef 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {scan.has_georef ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
