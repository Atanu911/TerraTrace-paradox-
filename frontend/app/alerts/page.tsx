"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, AlertItem, LocationItem } from "@/lib/api";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLocId, setSelectedLocId] = useState<number>(1);
  const [thresholdHa, setThresholdHa] = useState<number>(1.0);
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchAlerts = async () => {
    setErrorMessage("");
    try {
      const [alList, locList] = await Promise.all([api.getAlerts(), api.getLocations()]);
      setAlerts(alList);
      setLocations(locList);
      setSelectedLocId((current) => locList.some((location) => location.id === current) ? current : locList[0]?.id ?? 0);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load alert rules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchAlerts(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    try {
      await api.createAlert({
        location_id: selectedLocId,
        threshold_ha: thresholdHa,
        change_type_filter: changeTypeFilter,
      });
      setShowCreateModal(false);
      await fetchAlerts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create alert rule.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (alertId: number, status: AlertItem["status"]) => {
    setErrorMessage("");
    try {
      await api.updateAlert(alertId, status);
      await fetchAlerts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update alert status.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-900/40 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>THRESHOLD ENGINE & NOTIFICATION DISPATCH</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Autonomous Alert Monitor
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure automated polygon area thresholds and change-type triggers across sensitive environmental reserves.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={loading || locations.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:scale-105 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Alert Rule</span>
          </button>
        </div>
      </div>

      {errorMessage && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{errorMessage}</p>}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center text-sm text-slate-400" role="status">Loading alert rules...</div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-blue-900/50 bg-[#071329]/70 p-10 text-center">
          <p className="text-white">No alert rules yet</p>
          <p className="mt-2 text-sm text-slate-400">Create a rule to monitor a location for configured change thresholds.</p>
        </div>
      ) : null}

      {/* Alert Rules List */}
      {!loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {alerts.map((al) => (
          <div
            key={al.id}
            className={`glass-panel rounded-2xl p-6 relative overflow-hidden transition-all ${
              al.status === "triggered"
                ? "border-red-500/50 shadow-[0_0_25px_rgba(255,45,61,0.2)]"
                : "border-blue-900/40"
            }`}
          >
            <div className="hud-corner-tl" />
            <div className="hud-corner-tr" />

            <div className="flex items-center justify-between mb-3 text-xs font-mono">
              <span className="text-slate-400">RULE #{al.id.toString().padStart(3, "0")}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  al.status === "triggered"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse"
                    : al.status === "active"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {al.status.toUpperCase()}
              </span>
            </div>

            <h3 className="font-display text-base font-bold text-white mb-1">
              {al.location_name}
            </h3>

            <div className="rounded-lg bg-[#071329] p-3 border border-blue-950/80 space-y-1.5 my-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Area Threshold</span>
                <span className="text-white font-bold">&gt; {al.threshold_ha} ha</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Change Filter</span>
                <span className="text-cyan-300 capitalize">{al.change_type_filter}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dispatch Target</span>
                <span className="text-slate-300 capitalize">{al.notification_method}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-blue-950 text-xs font-mono">
              <span className="text-[10px] text-slate-500">
                Created: {new Date(al.created_at).toLocaleDateString()}
              </span>

              {al.status === "triggered" ? (
                <button
                  type="button"
                  onClick={() => void handleUpdateStatus(al.id, "resolved")}
                  className="min-h-11 px-2 text-xs text-cyan-400 hover:underline"
                >
                  Mark Acknowledged
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleUpdateStatus(al.id, "triggered")}
                  className="min-h-11 px-2 text-xs text-red-400 hover:underline"
                >
                  Simulate trigger
                </button>
              )}
            </div>
          </div>
        ))}
      </div>}

      {/* Modal for Rule Creation */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full border-cyan-400/50 shadow-[0_0_40px_rgba(34,211,238,0.3)]">
            <div className="flex items-center justify-between border-b border-blue-950 pb-3 mb-4">
              <h3 className="font-display text-base font-bold text-white">
                Create Monitoring Alert Rule
              </h3>
              <button
                type="button"
                aria-label="Close create alert dialog"
                onClick={() => setShowCreateModal(false)}
                className="flex h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1">Target Zone</label>
                <select
                  value={selectedLocId}
                  onChange={(e) => setSelectedLocId(parseInt(e.target.value))}
                  disabled={locations.length === 0 || saving}
                  className="w-full rounded-lg border border-blue-900 bg-[#071329] px-3 py-2 text-white focus:outline-none"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">
                  Threshold Area: {thresholdHa} hectares
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="10.0"
                  step="0.5"
                  value={thresholdHa}
                  onChange={(e) => setThresholdHa(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Change Type Filter</label>
                <select
                  value={changeTypeFilter}
                  onChange={(e) => setChangeTypeFilter(e.target.value)}
                  className="w-full rounded-lg border border-blue-900 bg-[#071329] px-3 py-2 text-white focus:outline-none"
                >
                  <option value="all">All Changes</option>
                  <option value="Deforestation">Deforestation Only</option>
                  <option value="Construction">Construction Only</option>
                  <option value="Mining">Mining Only</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-blue-900 text-slate-300 hover:bg-blue-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || locations.length === 0}
                  className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white shadow-[0_0_12px_rgba(31,107,255,0.5)] hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
