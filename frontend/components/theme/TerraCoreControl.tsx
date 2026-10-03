"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, X } from "lucide-react";
import { THEME_MODES, useThemeSettings, type ThemeMode } from "./ThemeProvider";

const labels: Record<ThemeMode, string> = { midnight: "Midnight", ocean: "Ocean", earth: "Earth", daylight: "Daylight", "high-contrast": "High Contrast", auto: "Auto (system)" };
const levels = [10, 25, 50, 75, 100];

export default function TerraCoreControl() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const theme = useThemeSettings();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    const onOutside = (event: PointerEvent) => { if (!panelRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onOutside); };
  }, [open]);

  return <div className="terra-core">
    <button ref={buttonRef} type="button" aria-label={`Terra Core theme settings, current mode ${labels[theme.mode]}`} aria-expanded={open} aria-controls="terra-core-panel" title="Appearance settings" onClick={() => setOpen((value) => !value)} className="terra-core-button">
      {open ? <X aria-hidden="true" size={20} /> : <Palette aria-hidden="true" size={20} />}
    </button>
    {open && <div ref={panelRef} id="terra-core-panel" className="terra-core-panel" role="dialog" aria-label="Appearance settings">
      <div className="terra-core-heading"><div><strong>Terra Core</strong><span>Appearance settings</span></div><button type="button" aria-label="Close appearance settings" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}>×</button></div>
      <fieldset><legend>Theme</legend><div className="terra-core-modes" role="radiogroup" aria-label="Color theme">
        {THEME_MODES.map((mode) => <button key={mode} type="button" role="radio" aria-checked={theme.mode === mode} className={theme.mode === mode ? "selected" : ""} onClick={() => theme.setMode(mode)}>{labels[mode]}</button>)}
      </div></fieldset>
      <label className="terra-core-intensity">Visual intensity <output>{theme.intensity}%</output>
        <input type="range" min="0" max="4" step="1" value={levels.indexOf(theme.intensity as (typeof levels)[number])} aria-label="Visual intensity" onChange={(event) => theme.setIntensity(levels[Number(event.target.value)])} />
        <span className="terra-core-range-labels"><span>Subtle</span><span>Vivid</span></span>
      </label>
      <label className="terra-core-check"><input type="checkbox" checked={theme.reduceMotion} onChange={(event) => theme.setReduceMotion(event.target.checked)} /> Reduce motion</label>
      <label className="terra-core-check"><input type="checkbox" checked={theme.remember} onChange={(event) => theme.setRemember(event.target.checked)} /> Remember preference</label>
      <p className="sr-only" aria-live="polite">Theme set to {labels[theme.mode]}</p>
    </div>}
  </div>;
}
