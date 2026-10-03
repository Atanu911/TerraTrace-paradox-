"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Download, ExternalLink } from "lucide-react";
import { api, LocationItem, ScanItem } from "@/lib/api";

export default function ReportsPage() {
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaUnits] = useState<"hectares" | "km2">(() =>
    typeof window !== "undefined" && localStorage.getItem("terraTrace_areaUnits") === "hectares" ? "hectares" : "km2"
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const [scanData, locationData] = await Promise.all([api.getScans(), api.getLocations()]);
        setScans(scanData.filter(scan => scan.status === 'completed'));
        setLocations(locationData);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not load reports.");
      } finally {
        setLoading(false);
      }
    };

    fetchScans();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-2">
          <FileText className="h-3 w-3" />
          <span>FORENSIC REPORTS • DOWNLOAD CENTER</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Reports</h1>
        <p className="text-slate-400">Download generated reports for completed image analyses.</p>
      </div>

      {errorMessage && <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{errorMessage}</p>}

      <div className="glass-card rounded-2xl border border-white/6 bg-[#0C1C2C]/72 backdrop-blur-xl overflow-hidden">
        {scans.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No reports available yet</p>
            <p className="text-sm text-slate-500">
              Complete a scan analysis to generate forensic reports
            </p>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
            >
              <span>Start New Analysis</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/6">
                <tr>
                  <th className="p-4 font-medium text-slate-300">Scan ID</th>
                  <th className="p-4 font-medium text-slate-300">Location</th>
                  <th className="p-4 font-medium text-slate-300">Date</th>
                  <th className="p-4 font-medium text-slate-300">Detections</th>
                  <th className="p-4 font-medium text-slate-300">Area ({areaUnits === "hectares" ? "ha" : "km²"})</th>
                  <th className="p-4 font-medium text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {scans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <span className="font-mono text-cyan-400">
                        #{scan.id.toString().padStart(3, "0")}
                      </span>
                    </td>
                    <td className="p-4 text-white">{locations.find((location) => location.id === scan.location_id)?.name ?? `Location ${scan.location_id}`}</td>
                    <td className="p-4 text-slate-300">
                      {scan.completed_at ? new Date(scan.completed_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-4 text-slate-300">{scan.detection_count}</td>
                    <td className="p-4 text-slate-300">
                      {scan.total_area_ha ? (areaUnits === "hectares" ? `${scan.total_area_ha.toFixed(2)} ha` : `${(scan.total_area_ha / 100).toFixed(2)} km²`) : "—"}
                    </td>
                    <td className="p-4 text-right">
                      <a
                        href={api.getReportDownloadUrl(scan.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors text-xs"
                      >
                        <Download className="h-3 w-3" />
                        Download PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}