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
    const r = document.documentElement;
    r.style.setProperty("--va-bg", interp("#080808","#e5e7eb",f));
    r.style.setProperty("--va-surface", interp("#111827","#f3f4f6",f));
    r.style.setProperty("--va-border", interp("#1f2937","#d1d5db",f));
    r.style.setProperty("--va-text", interp("#f9fafb","#111827",f));
    r.style.setProperty("--va-text-muted", interp("#6b7280","#4b5563",f));
    r.style.setProperty("--va-accent", a);
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

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("va-theme-update", handleUpdate);
    };
  }, []);

  return <>{children}</>;
}