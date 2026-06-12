"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function applyStoredTheme() {
  try {
    const t = JSON.parse(localStorage.getItem("valArchivesTheme") || "{}");
    const b = typeof t.brightness === "number" ? t.brightness : 0;
    const a = t.accentColor || "#3b82f6";

    // Read full theme colors (set by presets)
    const bgColor = t.bgColor || "#080808";
    const surfaceColor = t.surfaceColor || "#111827";
    const borderColor = t.borderColor || "#1f2937";
    const textColor = t.textColor || "#f9fafb";
    const mutedColor = t.mutedColor || "#6b7280";

    const r = document.documentElement;

    if (b > 0) {
      // Brightness mode — interpolate toward light
      function lerp(x: number, y: number, n: number) { return Math.round(x + (y - x) * n); }
      function hex(h: string): [number,number,number] { return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }
      function interp(h1: string, h2: string, n: number) {
        const c1=hex(h1),c2=hex(h2);
        return `rgb(${lerp(c1[0],c2[0],n)},${lerp(c1[1],c2[1],n)},${lerp(c1[2],c2[2],n)})`;
      }
      const f = b / 100;
      r.style.setProperty("--va-bg", interp(bgColor,"#e5e7eb",f));
      r.style.setProperty("--va-surface", interp(surfaceColor,"#f3f4f6",f));
      r.style.setProperty("--va-border", interp(borderColor,"#d1d5db",f));
      r.style.setProperty("--va-text", interp(textColor,"#111827",f));
      r.style.setProperty("--va-text-muted", interp(mutedColor,"#4b5563",f));
    } else {
      // No brightness — use theme colors directly
      r.style.setProperty("--va-bg", bgColor);
      r.style.setProperty("--va-surface", surfaceColor);
      r.style.setProperty("--va-border", borderColor);
      r.style.setProperty("--va-text", textColor);
      r.style.setProperty("--va-text-muted", mutedColor);
    }
    r.style.setProperty("--va-accent", a);
  } catch {}
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Reapply on every route change
  useEffect(() => {
    applyStoredTheme();
    const t = setTimeout(applyStoredTheme, 100);
    return () => clearTimeout(t);
  }, [pathname]);

  // Listen for storage/custom events
  useEffect(() => {
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