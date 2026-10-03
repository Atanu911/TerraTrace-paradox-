import Link from "next/link";
import { Satellite, Shield, Cpu, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-blue-900/40 bg-[#040914] text-slate-400 py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/40 bg-blue-950">
                <Satellite className="h-4 w-4 text-cyan-400" />
              </div>
              <span className="font-display text-lg font-bold text-white">
                Terra<span className="text-cyan-400">Trace</span>
              </span>
            </div>
            <p className="text-sm text-slate-300 max-w-md font-display italic">
              &quot;Don&apos;t just detect what is there. Detect what has changed.&quot;
            </p>
            <p className="text-xs text-slate-400 max-w-md">
              Autonomous satellite and drone image change-forensics engine. Generates tamper-evident multi-temporal reports for environmental monitoring, illegal deforestation, illicit mining, and unauthorized land development.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Team AA Boys — Animesh Bera & Atanu Rana (Hackinverse)</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-display text-xs font-semibold tracking-wider text-slate-200 uppercase mb-3">
              Platform Modules
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/dashboard" className="hover:text-cyan-300 transition-colors">
                  Command Center
                </Link>
              </li>
              <li>
                <Link href="/analyze" className="hover:text-cyan-300 transition-colors">
                  Forensic Pipeline & Upload
                </Link>
              </li>
              <li>
                <Link href="/map" className="hover:text-cyan-300 transition-colors">
                  Geospatial Interactive Map
                </Link>
              </li>
              <li>
                <Link href="/timeline" className="hover:text-cyan-300 transition-colors">
                  Historical Change Timeline
                </Link>
              </li>
              <li>
                <Link href="/alerts" className="hover:text-cyan-300 transition-colors">
                  Threshold Alert Rules
                </Link>
              </li>
            </ul>
          </div>

          {/* Technology & Evidence */}
          <div>
            <h4 className="font-display text-xs font-semibold tracking-wider text-slate-200 uppercase mb-3">
              Forensic Core
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-cyan-400" />
                <span>ORB + RANSAC Registration</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-cyan-400" />
                <span>SSIM & Spectral Vegetation Differencing</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-cyan-400" />
                <span>Morphological Polygon Extraction</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-cyan-400" />
                <span>SHA-256 Chain of Custody</span>
              </li>
              <li className="pt-2">
                <a
                  href="http://127.0.0.1:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono text-[11px]"
                >
                  <span>Interactive API Swagger</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-blue-950/80 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-mono">
          <div>
            © {new Date().getFullYear()} TerraTrace Engine. Built for Hackinverse by Team AA Boys.
          </div>
          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <span>FastAPI Backend Active</span>
            <span>•</span>
            <span>SQLite Embedded</span>
            <span>•</span>
            <span>ReportLab PDF Certified</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
