"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const FONT_SIZE_PX: Record<string, string> = { small: "14px", medium: "16px", large: "18px", xlarge: "20px" };
const LINE_SPACING_VAL: Record<string, string> = { compact: "1.3", normal: "1.6", relaxed: "1.9" };
const HEADING_WEIGHT_VAL: Record<string, string> = { normal: "600", bold: "700", xbold: "800" };
const DENSITY_SCALE: Record<string, string> = { compact: "0.7", comfortable: "1", spacious: "1.4" };
const CORNER_RADIUS: Record<string, string> = { sharp: "0px", soft: "0.5rem", rounded: "1rem", pill: "9999px" };
const SHADOW_VAL: Record<string, string> = { none: "none", subtle: "0 2px 12px rgba(0,0,0,0.25)", strong: "0 8px 32px rgba(0,0,0,0.55)" };
const ANIM_DURATION: Record<string, string> = { off: "0s", fast: "0.1s", normal: "0.2s", slow: "0.4s" };

const NAV_TAB_KEYS = ["home", "story", "canon", "timeline", "pensieve", "rulebook", "inbox"];

const HP_HOUSES: Record<string, { primary: string; secondary: string }> = {
  gryffindor: { primary: "#ae0001", secondary: "#eeba30" },
  slytherin: { primary: "#1a472a", secondary: "#aaaaaa" },
  ravenclaw: { primary: "#0e1a40", secondary: "#946b2d" },
  hufflepuff: { primary: "#ecb939", secondary: "#372e29" },
};
const HOUSE_ORDER = ["gryffindor", "slytherin", "ravenclaw", "hufflepuff"];

function lerpColor(h1: string, h2: string, t: number): string {
  function hex(h: string): [number, number, number] { return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
  const c1 = hex(h1), c2 = hex(h2);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(c1[0],c2[0])},${lerp(c1[1],c2[1])},${lerp(c1[2],c2[2])})`;
}

let animFrame = 0;
let animIntervalId: ReturnType<typeof setInterval> | null = null;

// Drives all animated accent modes (Rainbow + HP themes) on a single shared interval
// so it keeps running app-wide regardless of which page is mounted.
function startAnimatedAccent(mode: string, house: string, speed: string) {
  if (animIntervalId) clearInterval(animIntervalId);
  if (mode === "none") return;

  const speedMs: Record<string, number> = { off: 0, fast: 30, normal: 60, slow: 120 };
  const tickMs = speedMs[speed] ?? 60;
  if (tickMs === 0) return;

  const r = document.documentElement;
  animFrame = 0;

  animIntervalId = setInterval(() => {
    animFrame++;
    if (mode === "rainbow") {
      const hue = animFrame % 360;
      r.style.setProperty("--va-accent", `hsl(${hue}, 70%, 60%)`);
    } else if (mode === "hp-house-single") {
      const h = HP_HOUSES[house] || HP_HOUSES.gryffindor;
      const t = (Math.sin(animFrame / 40) + 1) / 2; // breathing pulse between primary/secondary
      r.style.setProperty("--va-accent", lerpColor(h.primary, h.secondary, t));
    } else if (mode === "hp-house-cycle") {
      const cycleLength = 300; // frames per house
      const totalFrame = animFrame % (cycleLength * HOUSE_ORDER.length);
      const houseIdx = Math.floor(totalFrame / cycleLength);
      const nextIdx = (houseIdx + 1) % HOUSE_ORDER.length;
      const within = (totalFrame % cycleLength) / cycleLength;
      const current = HP_HOUSES[HOUSE_ORDER[houseIdx]];
      const next = HP_HOUSES[HOUSE_ORDER[nextIdx]];
      r.style.setProperty("--va-accent", lerpColor(current.primary, next.primary, within));
    } else if (mode === "golden-snitch") {
      const t = (Math.sin(animFrame / 15) + 1) / 2;
      r.style.setProperty("--va-accent", lerpColor("#b8860b", "#ffd700", t));
    } else if (mode === "patronus") {
      const t = (Math.sin(animFrame / 50) + 1) / 2;
      r.style.setProperty("--va-accent", lerpColor("#7fa8c9", "#e8f4ff", t));
    } else if (mode === "marauders-map") {
      const t = (Math.sin(animFrame / 60) + 1) / 2;
      r.style.setProperty("--va-accent", lerpColor("#8b6f47", "#c9a876", t));
    } else if (mode === "felix-felicis") {
      const t = (Math.sin(animFrame / 20) + 1) / 2;
      r.style.setProperty("--va-accent", lerpColor("#d4a017", "#fff4c1", t));
    } else if (mode === "dementor") {
      const t = (Math.sin(animFrame / 80) + 1) / 2;
      r.style.setProperty("--va-accent", lerpColor("#3a4a52", "#1c2428", t));
    }
  }, tickMs);
}

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

    // Animated accent (Rainbow + HP themes) overrides the static accent — when active,
    // skip setting --va-accent here and let the shared interval drive it instead.
    const animatedAccent = t.animatedAccent || "none";
    const hpHouse = t.hpHouse || "gryffindor";
    const animSpeedForAccent = t.animSpeed || "normal";
    if (animatedAccent === "none") {
      r.style.setProperty("--va-accent", a);
    }
    startAnimatedAccent(animatedAccent, hpHouse, animSpeedForAccent);

    // ── Typography ──
    const fontFamily = t.fontFamily || "inherit";
    const fontSize = t.fontSize || "medium";
    const lineSpacing = t.lineSpacing || "normal";
    const headingWeight = t.headingWeight || "bold";
    r.style.setProperty("--va-font-family", fontFamily);
    r.style.setProperty("--va-font-size-base", FONT_SIZE_PX[fontSize] || FONT_SIZE_PX.medium);
    r.style.setProperty("--va-line-height", LINE_SPACING_VAL[lineSpacing] || LINE_SPACING_VAL.normal);
    r.style.setProperty("--va-heading-weight", HEADING_WEIGHT_VAL[headingWeight] || HEADING_WEIGHT_VAL.bold);
    document.body.style.fontFamily = fontFamily;
    document.body.style.fontSize = FONT_SIZE_PX[fontSize] || FONT_SIZE_PX.medium;
    document.body.style.lineHeight = LINE_SPACING_VAL[lineSpacing] || LINE_SPACING_VAL.normal;

    // ── Layout density ──
    const density = t.density || "comfortable";
    r.style.setProperty("--va-density-scale", DENSITY_SCALE[density] || DENSITY_SCALE.comfortable);

    // ── UI effects ──
    const cornerStyle = t.cornerStyle || "soft";
    const shadowIntensity = t.shadowIntensity || "subtle";
    const animSpeed = t.animSpeed || "normal";
    const glowEffects = t.glowEffects !== false; // default true
    r.style.setProperty("--va-radius", CORNER_RADIUS[cornerStyle] || CORNER_RADIUS.soft);
    r.style.setProperty("--va-shadow", SHADOW_VAL[shadowIntensity] || SHADOW_VAL.subtle);
    r.style.setProperty("--va-anim-duration", ANIM_DURATION[animSpeed] || ANIM_DURATION.normal);
    r.style.setProperty("--va-glow-opacity", glowEffects ? "1" : "0");

    // ── Extra colors ──
    r.style.setProperty("--va-link", t.linkColor || "#3b82f6");
    r.style.setProperty("--va-success", t.successColor || "#22c55e");
    r.style.setProperty("--va-error", t.errorColor || "#ef4444");
    r.style.setProperty("--va-warning", t.warningColor || "#f59e0b");
    r.style.setProperty("--va-card-border", t.cardBorderColor || borderColor);

    // ── Per-tab nav colors — falls back to accent if unset ──
    const navTabColors = t.navTabColors || {};
    for (const key of NAV_TAB_KEYS) {
      r.style.setProperty(`--va-navcolor-${key}`, navTabColors[key] || a);
    }
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