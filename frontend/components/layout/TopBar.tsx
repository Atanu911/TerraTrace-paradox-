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
    <header className="sticky top-0 z-30 border-b border-[var(--theme-border)] bg-[var(--theme-surface)]/95 backdrop-blur-xl transition-colors duration-300">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
        {/* Logo + Title */}
        <div className="flex items-center gap-4">
          {onSidebarToggle && (
            <button
              type="button"
              onClick={onSidebarToggle}
              aria-label="Toggle navigation menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-panel)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Link href="/dashboard" className="text-[var(--theme-text)] hover:opacity-90 transition-opacity">
            <h1 className="text-lg font-display font-bold">
              Terra<span className="text-[var(--theme-accent)]">Trace</span>
            </h1>
            <p className="text-xs text-[var(--theme-muted)] font-mono tracking-wider">
              Monitor • Detect • Protect
            </p>
          </Link>
        </div>

        {/* Center - Search Bar */}
        <form onSubmit={handleSearch} className="order-3 w-full sm:order-none sm:flex-1 sm:max-w-lg sm:mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--theme-muted)]" />
            <input
              type="search"
              aria-label="Search monitoring locations"
              placeholder="Search a monitoring location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/80 py-2 pl-10 pr-12 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] transition-all focus:border-[var(--theme-accent)] focus:bg-[var(--theme-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/20"
            />
            <button type="submit" aria-label="Search locations" className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--theme-accent)] hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)]">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Right - Date Range + User */}
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link
            href="/timeline"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/60 px-3 text-sm text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)]"
          >
              <Calendar className="h-4 w-4 text-[var(--theme-accent)]" />
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
