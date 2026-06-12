"use client";

import { useEffect } from "react";

export function applyStoredTheme() {
  try {
    const t = JSON.parse(localStorage.getItem("valArchivesTheme") || "{}");
    const b = typeof t.brightness === "number" ? t.brightness : 0;
    const a = t.accentColor || "#3b82f6";

    function lerp(x: number, y: number, t: number) { return Math.round(x + (y - x) * t); }
    function hex(h: string): [number,number,number] { return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }
    function interp(h1: string, h2: string, t: number) {
      const c1=hex(h1),c2=hex(h2);
      return `rgb(${lerp(c1[0],c2[0],t)},${lerp(c1[1],c2[1],t)},${lerp(c1[2],c2[2],t)})`;
    }

    const f = b / 100;
    const bg = interp("#080808","#e5e7eb",f);
    const surface = interp("#111827","#f3f4f6",f);
    const border = interp("#1f2937","#d1d5db",f);
    const text = interp("#f9fafb","#111827",f);
    const muted = interp("#6b7280","#4b5563",f);

    // Inject a <style> tag that overrides :root — this beats CSS file specificity
    let styleEl = document.getElementById("va-theme-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "va-theme-style";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `:root {
      --va-bg: ${bg} !important;
      --va-surface: ${surface} !important;
      --va-border: ${border} !important;
      --va-text: ${text} !important;
      --va-text-muted: ${muted} !important;
      --va-accent: ${a} !important;
    }`;
  } catch {}
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyStoredTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "valArchivesTheme") applyStoredTheme();
    };
    const handleUpdate = () => applyStoredTheme();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("va-theme-update", handleUpdate);

    // Also reapply on any route change by watching document title changes
    const observer = new MutationObserver(() => applyStoredTheme());
    observer.observe(document.head, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("va-theme-update", handleUpdate);
      observer.disconnect();
    };
  }, []);

  return <>{children}</>;
}