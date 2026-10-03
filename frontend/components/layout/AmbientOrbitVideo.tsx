"use client";

import { useEffect, useRef } from "react";

/** Creates a lightweight, original orbital-monitoring video stream in the browser. */
export default function AmbientOrbitVideo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !video || !context || typeof canvas.captureStream !== "function") return;

    const stream = canvas.captureStream(20);
    video.srcObject = stream;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let running = false;
    const width = canvas.width;
    const height = canvas.height;
    const draw = (timestamp: number) => {
      if (!running) return;
      const phase = (timestamp % 18000) / 18000;
      const ctx = context;
      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#04111b");
      background.addColorStop(0.52, "#0a2829");
      background.addColorStop(1, "#06121c");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(95,205,190,.07)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y < height; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      const cx = 960;
      const cy = 370;
      const radius = 310;
      const earth = ctx.createRadialGradient(cx - 115, cy - 135, 12, cx, cy, radius);
      earth.addColorStop(0, "rgba(20,112,112,.52)");
      earth.addColorStop(0.62, "rgba(13,68,65,.43)");
      earth.addColorStop(1, "rgba(3,23,32,.16)");
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = earth; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.fillStyle = "rgba(109,160,89,.35)";
      ctx.beginPath(); ctx.moveTo(cx - 205, cy - 42); ctx.bezierCurveTo(cx - 135, cy - 145, cx - 55, cy - 125, cx - 22, cy - 37); ctx.bezierCurveTo(cx + 42, cy + 40, cx - 26, cy + 116, cx - 85, cy + 104); ctx.bezierCurveTo(cx - 161, cy + 104, cx - 229, cy + 51, cx - 205, cy - 42); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 75, cy - 161); ctx.bezierCurveTo(cx + 170, cy - 193, cx + 229, cy - 99, cx + 206, cy - 27); ctx.bezierCurveTo(cx + 188, cy + 22, cx + 116, cy + 12, cx + 94, cy - 45); ctx.fill();
      ctx.strokeStyle = "rgba(70,218,195,.20)";
      for (let i = 0; i < 8; i++) { const y = cy - 225 + i * 62 + Math.sin(i) * 14; ctx.beginPath(); ctx.moveTo(cx - radius, y); ctx.bezierCurveTo(cx - 85, y + 39, cx + 80, y - 37, cx + radius, y + 8); ctx.stroke(); }
      const scanY = cy - radius + phase * radius * 2;
      const scan = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
      scan.addColorStop(0, "rgba(45,232,203,0)"); scan.addColorStop(.5, "rgba(45,232,203,.17)"); scan.addColorStop(1, "rgba(45,232,203,0)");
      ctx.fillStyle = scan; ctx.fillRect(cx - radius, scanY - 60, radius * 2, 120);
      for (let i = 0; i < 22; i++) {
        const x = cx - 238 + ((i * 83) % 470);
        const y = cy - 224 + ((i * 131) % 445);
        const alert = i % 5 === 0;
        const pulse = alert ? 3.5 + 2 * (.5 + .5 * Math.sin(phase * Math.PI * 2 + i)) : 2.5;
        ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2);
        ctx.fillStyle = alert ? "rgba(255,83,71,.88)" : "rgba(99,237,176,.67)"; ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(80,225,205,.42)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

      // Orbital path and simplified satellite, moving around the globe.
      ctx.strokeStyle = "rgba(65,211,210,.34)"; ctx.setLineDash([5, 9]); ctx.beginPath(); ctx.ellipse(865, 370, 365, 94, -.14, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const orbit = phase * Math.PI * 2 - .3;
      const sx = 865 + Math.cos(orbit) * 365;
      const sy = 370 + Math.sin(orbit) * 94;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(orbit * .3);
      ctx.fillStyle = "rgba(189,221,224,.92)"; ctx.fillRect(-13, -9, 26, 18);
      ctx.fillStyle = "rgba(48,134,206,.84)"; ctx.fillRect(-53, -7, 34, 14); ctx.fillRect(19, -7, 34, 14);
      ctx.restore();

      const sweepY = (timestamp * .024) % (height + 100) - 50;
      const sweep = ctx.createLinearGradient(0, sweepY - 35, 0, sweepY + 35);
      sweep.addColorStop(0, "rgba(40,205,179,0)"); sweep.addColorStop(.5, "rgba(40,205,179,.055)"); sweep.addColorStop(1, "rgba(40,205,179,0)");
      ctx.fillStyle = sweep; ctx.fillRect(0, sweepY - 35, width, 70);
      frame = window.requestAnimationFrame(draw);
    };

    const syncMotion = () => {
      const shouldRun = !reducedMotion.matches && document.documentElement.dataset.reduceMotion !== "true";
      if (shouldRun && !running) { running = true; frame = window.requestAnimationFrame(draw); void video.play().catch(() => undefined); }
      if (!shouldRun && running) { running = false; window.cancelAnimationFrame(frame); video.pause(); }
    };
    const observer = new MutationObserver(syncMotion);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    reducedMotion.addEventListener("change", syncMotion);
    syncMotion();
    return () => { running = false; window.cancelAnimationFrame(frame); observer.disconnect(); reducedMotion.removeEventListener("change", syncMotion); video.pause(); video.srcObject = null; stream.getTracks().forEach((track) => track.stop()); };
  }, []);

  return <>
    <canvas ref={canvasRef} width={1280} height={720} aria-hidden="true" className="ambient-orbit-canvas" />
    <video ref={videoRef} aria-hidden="true" muted autoPlay loop playsInline tabIndex={-1} className="site-background-video" />
  </>;
}
