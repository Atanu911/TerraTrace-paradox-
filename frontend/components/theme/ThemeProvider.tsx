"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEME_MODES = ["midnight", "ocean", "earth", "daylight", "high-contrast", "auto"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
const INTENSITIES = [10, 25, 50, 75, 100] as const;
type ThemeSettings = { mode: ThemeMode; intensity: number; reduceMotion: boolean; remember: boolean };
type ThemeContextValue = ThemeSettings & { setMode: (mode: ThemeMode) => void; setIntensity: (value: number) => void; setReduceMotion: (value: boolean) => void; setRemember: (value: boolean) => void };
const defaults: ThemeSettings = { mode: "ocean", intensity: 50, reduceMotion: false, remember: true };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("terratrace-theme");
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<ThemeSettings>;
          setSettings({ ...defaults, ...parsed, mode: THEME_MODES.includes(parsed.mode as ThemeMode) ? parsed.mode as ThemeMode : defaults.mode });
        }
      } catch { /* Ignore invalid or unavailable local storage. */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.dataset.theme = settings.mode;
    root.dataset.reduceMotion = String(settings.reduceMotion);
    const normalized = (INTENSITIES.indexOf(settings.intensity as (typeof INTENSITIES)[number]) + 1) / INTENSITIES.length;
    root.style.setProperty("--visual-intensity", String(normalized));
    try {
      if (settings.remember) localStorage.setItem("terratrace-theme", JSON.stringify(settings));
      else localStorage.removeItem("terratrace-theme");
    } catch { /* Theme still works for this session when storage is unavailable. */ }
  }, [settings, ready]);

  const update = useCallback((change: Partial<ThemeSettings>) => setSettings((current) => ({ ...current, ...change })), []);
  const value = useMemo<ThemeContextValue>(() => ({ ...settings, setMode: (mode) => update({ mode }), setIntensity: (intensity) => update({ intensity }), setReduceMotion: (reduceMotion) => update({ reduceMotion }), setRemember: (remember) => update({ remember }) }), [settings, update]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useThemeSettings must be used within ThemeProvider");
  return value;
}
