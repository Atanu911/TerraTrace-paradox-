"use client";

import { Suspense } from "react";
import GlobeOverviewView from "@/components/map/GlobeOverviewView";

export default function MapPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-[var(--theme-muted)]">Loading 3D Globe telemetry...</div>}>
      <div className="relative flex flex-col min-h-[calc(100vh-4rem)] w-full">
        <div className="flex-1">
          <GlobeOverviewView />
        </div>
      </div>
    </Suspense>
  );
}
