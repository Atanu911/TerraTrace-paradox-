"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Calendar, Menu, ArrowRight } from "lucide-react";
import { useState } from "react";
import TerraCoreControl from "@/components/theme/TerraCoreControl";

interface TopBarProps {
  onSidebarToggle?: () => void;
}

export default function TopBar({ onSidebarToggle }: TopBarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/map?search=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/6 bg-[#0A1626]/90 backdrop-blur-xl">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
        {/* Logo + Title */}
        <div className="flex items-center gap-4">
          {onSidebarToggle && (
            <button
              type="button"
              onClick={onSidebarToggle}
              aria-label="Toggle navigation menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-slate-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Link href="/dashboard" className="text-white hover:opacity-90 transition-opacity">
            <h1 className="text-lg font-display font-bold">
              Terra<span className="text-cyan-400">Trace</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono tracking-wider">
              Monitor • Detect • Protect
            </p>
          </Link>
        </div>

        {/* Center - Search Bar */}
        <form onSubmit={handleSearch} className="order-3 w-full sm:order-none sm:flex-1 sm:max-w-lg sm:mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              aria-label="Search monitoring locations"
              placeholder="Search a monitoring location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-12 text-sm text-white placeholder-slate-400 transition-all focus:border-cyan-400/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
            />
            <button type="submit" aria-label="Search locations" className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-cyan-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Right - Date Range + User */}
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link
            href="/timeline"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
          </Link>
          <TerraCoreControl />

          {/* User Profile */}
          <div className="hidden items-center gap-3 md:flex">
            <div className="text-right text-sm">
              <div className="font-medium text-white">Analyst</div>
              <div className="text-xs text-slate-400">Environmental Monitoring</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-sm font-semibold text-cyan-400">
              AN
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
