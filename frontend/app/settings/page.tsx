"use client";

import { useEffect, useState } from "react";
import { Settings, Globe, Clock, Save } from "lucide-react";
import { api, HealthStatus } from "@/lib/api";

export default function SettingsPage() {
  const [areaUnits, setAreaUnits] = useState<"hectares" | "km2">(() =>
    typeof window !== "undefined" && localStorage.getItem("terraTrace_areaUnits") === "hectares" ? "hectares" : "km2"
  );
  const [autoRefresh, setAutoRefresh] = useState(() =>
    typeof window === "undefined" || localStorage.getItem("terraTrace_autoRefresh") !== "false"
  );
  const [refreshInterval, setRefreshInterval] = useState(() => {
    if (typeof window === "undefined") return "30";
    const saved = localStorage.getItem("terraTrace_refreshInterval");
    return saved && ["15", "30", "60", "300"].includes(saved) ? saved : "30";
  });
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let active = true;
    api.getHealth().then((result) => {
      if (active) setHealth(result);
    }).catch(() => {
      if (active) setHealth(null);
    });
    return () => { active = false; };
  }, []);

  const saveSettings = () => {
    localStorage.setItem("terraTrace_areaUnits", areaUnits);
    localStorage.setItem("terraTrace_autoRefresh", JSON.stringify(autoRefresh));
    localStorage.setItem("terraTrace_refreshInterval", refreshInterval);
    setSaved(true);
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-2">
          <Settings className="h-3 w-3" />
          <span>SYSTEM CONFIGURATION • USER PREFERENCES</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">
          Configure your TerraTrace experience and preferences
        </p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Display Preferences */}
        <div className="glass-card rounded-2xl p-6 border border-white/6 bg-[#0C1C2C]/72 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Display Preferences
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Area Units
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="km2"
                    checked={areaUnits === "km2"}
                    onChange={(e) => { setAreaUnits(e.target.value as "km2"); setSaved(false); }}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 mr-2 ${
                    areaUnits === "km2" 
                      ? 'border-cyan-400 bg-cyan-400/20' 
                      : 'border-slate-600'
                  }`}>
                    {areaUnits === "km2" && <div className="w-2 h-2 rounded-full bg-cyan-400 m-0.5" />}
                  </div>
                  <span className="text-sm text-slate-300">Square Kilometers (km²)</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="hectares"
                    checked={areaUnits === "hectares"}
                    onChange={(e) => { setAreaUnits(e.target.value as "hectares"); setSaved(false); }}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 mr-2 ${
                    areaUnits === "hectares" 
                      ? 'border-cyan-400 bg-cyan-400/20' 
                      : 'border-slate-600'
                  }`}>
                    {areaUnits === "hectares" && <div className="w-2 h-2 rounded-full bg-cyan-400 m-0.5" />}
                  </div>
                  <span className="text-sm text-slate-300">Hectares (ha)</span>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Choose units for dashboard and report area summaries
              </p>
            </div>
          </div>
        </div>

        {/* Data & Monitoring */}
        <div className="glass-card rounded-2xl p-6 border border-white/6 bg-[#0C1C2C]/72 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Data & Monitoring
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => { setAutoRefresh(e.target.checked); setSaved(false); }}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 mr-3 ${
                  autoRefresh 
                    ? 'border-cyan-400 bg-cyan-400/20' 
                    : 'border-slate-600'
                }`}>
                  {autoRefresh && <div className="w-3 h-3 bg-cyan-400 rounded m-0.5" />}
                </div>
                <span className="text-sm font-medium text-slate-300">
                  Auto-refresh dashboard data
                </span>
              </label>
              
              {autoRefresh && (
                <div className="ml-8 mt-2">
                  <label className="block text-sm text-slate-400 mb-1">
                    Refresh interval
                  </label>
                  <select
                    value={refreshInterval}
                    onChange={(e) => { setRefreshInterval(e.target.value); setSaved(false); }}
                    className="w-32 px-3 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
                  >
                    <option value="15">15 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="glass-card rounded-2xl p-6 border border-white/6 bg-[#0C1C2C]/72 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            System Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Version:</span>
              <span className="text-white ml-2">TerraTrace {health?.version ?? "version unavailable"}</span>
            </div>
            <div>
              <span className="text-slate-400">API Status:</span>
              <span className={`${health?.status === "healthy" ? "text-green-400" : "text-amber-300"} ml-2`}>● {health?.status === "healthy" ? "Connected" : "Unavailable"}</span>
            </div>
            <div>
              <span className="text-slate-400">Last Updated:</span>
              <span className="text-white ml-2">{health ? new Date(health.timestamp).toLocaleString() : "Not available"}</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved && <p role="status" className="text-sm text-emerald-300">Preferences saved</p>}
          <button
            type="button"
            onClick={saveSettings}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-cyan-600 px-6 py-3 font-medium text-white transition-colors hover:bg-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}