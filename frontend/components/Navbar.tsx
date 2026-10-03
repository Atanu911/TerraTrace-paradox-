"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Radar, 
  LayoutDashboard, 
  ScanSearch, 
  MapPin, 
  History, 
  BellRing, 
  ShieldCheck, 
  UploadCloud,
  Satellite
} from "lucide-react";
import TerraCoreControl from "@/components/theme/TerraCoreControl";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Overview", href: "/", icon: Radar },
    { label: "Command Center", href: "/dashboard", icon: LayoutDashboard },
    { label: "Forensic Analysis", href: "/analyze", icon: ScanSearch },
    { label: "Geospatial Map", href: "/map", icon: MapPin },
    { label: "Timeline", href: "/timeline", icon: History },
    { label: "Alerts", href: "/alerts", icon: BellRing },
    { label: "Methodology", href: "/about", icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-blue-900/40 bg-[#060E20]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/40 bg-blue-950/80 shadow-[0_0_15px_rgba(34,211,238,0.25)] transition-all group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]">
            <Satellite className="h-5 w-5 text-cyan-400 transition-transform group-hover:rotate-12" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-tight text-white">
                Terra<span className="text-cyan-400">Trace</span>
              </span>
            </div>
            <p className="text-[10px] text-blue-300/60 font-mono tracking-wider">
              CHANGE-FORENSICS ENGINE
            </p>
          </div>
        </Link>

        {/* Center Nav items */}
        <nav className="hidden lg:flex items-center gap-1 rounded-full border border-blue-900/50 bg-[#0A1630]/70 p-1 shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(31,107,255,0.5)]"
                    : "text-slate-300 hover:bg-blue-950/60 hover:text-white"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-cyan-300" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <TerraCoreControl />
          <Link
            href="/analyze"
            className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-gradient-to-r from-blue-600 to-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(34,211,238,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_24px_rgba(34,211,238,0.5)]"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Run analysis</span>
          </Link>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex lg:hidden overflow-x-auto px-4 py-2 border-t border-blue-950/80 bg-[#081228] gap-2 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                isActive
                  ? "bg-blue-600/80 text-white"
                  : "text-slate-400 hover:bg-blue-950 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
