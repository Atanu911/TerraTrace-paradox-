"use client";

import { 
  ShieldCheck, 
  Award, 
  Users, 
  ExternalLink
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export default function AboutPage() {
  const comparisonItems = [
    {
      feature: "Image Alignment / Registration",
      type: "Real Algorithm",
      status: "Verified",
      tech: "ORB / SIFT feature keypoints + BFMatcher + RANSAC homography warp with ECC correlation fallback.",
    },
    {
      feature: "Multi-Signal Change Detection",
      type: "Real Algorithm",
      status: "Verified",
      tech: "Calculates per-pixel Structural Similarity Index (SSIM), absolute pixel differencing, and Excess Green vegetation index.",
    },
    {
      feature: "Contour & Polygonal Boundary Extraction",
      type: "Real Algorithm",
      status: "Verified",
      tech: "Applies morphological closing/opening, Otsu binarization, and Douglas-Peucker contour polygon approximation.",
    },
    {
      feature: "Geospatial Projection & Hectare Calculation",
      type: "Real Algorithm",
      status: "Verified",
      tech: "Projects image coordinate matrix to EPSG:4326 WGS-84 (lat/lon) via Ground Sample Distance (GSD) and builds valid GeoJSON.",
    },
    {
      feature: "Source Checksums & PDF Report Generation",
      type: "Real Algorithm",
      status: "Verified",
      tech: "Calculates SHA-256 checksums of input images and includes them in generated PDF reports. Reports support review and are not legal certification.",
    },
    {
      feature: "Cloud & Shadow Masking",
      type: "Spectral Heuristic",
      status: "Rule-Based",
      tech: "Heuristic thresholding based on HSV brightness saturation and low-variance texture masks.",
    },
    {
      feature: "Change Signature Classification",
      type: "Dual: Heuristic + CNN Slot",
      status: "Hybrid",
      tech: "Default ships with deterministic spectral/geometric features (edge density, soil index, rectangularity). Drop-in PyTorch CNN slot supported via MODEL_PATH.",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 flex flex-col gap-12">
      {/* Title */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-900/40 px-3.5 py-1 text-xs font-mono text-cyan-300">
          <Award className="h-3.5 w-3.5 text-cyan-400" />
          <span>HACKINVERSE 2026 • AI & SUSTAINABILITY TRACK</span>
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white">
          Methodology & Forensic Integrity
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          TerraTrace was built from the ground up to solve temporal blindspots in remote sensing. Here is an honest, fully transparent disclosure of our underlying algorithms.
        </p>
      </div>

      {/* ── HONESTY MATRIX: WHAT'S REAL VS HEURISTIC ────── */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border-blue-900/60 shadow-[0_0_40px_rgba(0,10,30,0.7)]">
        <div className="flex items-center justify-between border-b border-blue-950 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h2 className="font-display text-lg font-bold text-white">
              Algorithm Transparency Matrix
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-400">METHODS DISCLOSED</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-blue-900/80 text-slate-400">
                <th className="pb-3 font-semibold">MODULE / FEATURE</th>
                <th className="pb-3 font-semibold">CLASSIFICATION</th>
                <th className="pb-3 font-semibold">STATUS</th>
                <th className="pb-3 font-semibold">ALGORITHMIC DETAIL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-950/60">
              {comparisonItems.map((item, i) => (
                <tr key={i} className="hover:bg-blue-950/30 transition-colors">
                  <td className="py-3.5 font-bold text-white pr-4">
                    {item.feature}
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-cyan-300 font-semibold">{item.type}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                        item.status === "Verified"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-300 text-[11px] leading-relaxed">
                    {item.tech}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TEAM AA BOYS ─────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border-cyan-500/30 relative overflow-hidden">
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />

        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-2">
          <Users className="h-4 w-4" />
          <span>TEAM AA BOYS • PROJECT ARCHITECTS</span>
        </div>

        <h2 className="font-display text-2xl font-bold text-white mb-4">
          Developed for Hackinverse
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="rounded-xl border border-blue-900/60 bg-[#071329] p-4">
            <span className="text-cyan-300 font-bold text-sm block">Animesh Bera</span>
            <span className="text-slate-400 block mt-0.5">Computer Vision & Backend Architecture</span>
            <p className="text-slate-300 text-[11px] mt-2">
              Implemented ORB+RANSAC registration homography, multi-signal SSIM fusion pipeline, and ReportLab forensic PDF generation.
            </p>
          </div>

          <div className="rounded-xl border border-blue-900/60 bg-[#071329] p-4">
            <span className="text-cyan-300 font-bold text-sm block">Atanu Rana</span>
            <span className="text-slate-400 block mt-0.5">Fullstack Interface & Geospatial Systems</span>
            <p className="text-slate-300 text-[11px] mt-2">
              Designed Next.js command center, interactive swipe comparators, DreamFrame dial controls, and GeoJSON polygon renderer.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-blue-950 text-xs font-mono text-slate-400">
          <div>
            Built with: Python 3.10 • FastAPI • OpenCV Headless • Next.js 16 • TailwindCSS
          </div>
          <a
            href={`${API_BASE_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Interactive API Swagger</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
