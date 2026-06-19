"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSoundEffects } from "./SoundEffects";

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

const HOGWARTS_PALETTES: Record<string, { gold: string; black: string; parchment: string; burgundy: string; bronze: string; magicBlue: string }> = {
  classic: { gold: "#D4AF37", black: "#0F0F12", parchment: "#E9DFC8", burgundy: "#5C1A1B", bronze: "#8B6B3F", magicBlue: "#5DADE2" },
  gryffindor: { gold: "#D3A625", black: "#0F0F12", parchment: "#E9DFC8", burgundy: "#740001", bronze: "#AE0001", magicBlue: "#5DADE2" },
  ravenclaw: { gold: "#946B2D", black: "#0F0F12", parchment: "#E9DFC8", burgundy: "#0E1A40", bronze: "#222F5B", magicBlue: "#5DADE2" },
  slytherin: { gold: "#AAAAAA", black: "#0F0F12", parchment: "#E9DFC8", burgundy: "#1A472A", bronze: "#2A623D", magicBlue: "#5DADE2" },
  hufflepuff: { gold: "#FFDB00", black: "#0F0F12", parchment: "#E9DFC8", burgundy: "#372E29", bronze: "#726255", magicBlue: "#5DADE2" },
};

function lerpColor(h1: string, h2: string, t: number): string {
  function hex(h: string): [number, number, number] { return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
  const c1 = hex(h1), c2 = hex(h2);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(c1[0],c2[0])},${lerp(c1[1],c2[1])},${lerp(c1[2],c2[2])})`;
}

let animFrame = 0;
let animIntervalId: ReturnType<typeof setInterval> | null = null;

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
      const t = (Math.sin(animFrame / 40) + 1) / 2;
      r.style.setProperty("--va-accent", lerpColor(h.primary, h.secondary, t));
    } else if (mode === "hp-house-cycle") {
      const cycleLength = 300;
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

    const bgColor = t.bgColor || "#080808";
    const surfaceColor = t.surfaceColor || "#111827";
    const borderColor = t.borderColor || "#1f2937";
    const textColor = t.textColor || "#f9fafb";
    const mutedColor = t.mutedColor || "#6b7280";

    const r = document.documentElement;

    if (b > 0) {
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
      r.style.setProperty("--va-bg", bgColor);
      r.style.setProperty("--va-surface", surfaceColor);
      r.style.setProperty("--va-border", borderColor);
      r.style.setProperty("--va-text", textColor);
      r.style.setProperty("--va-text-muted", mutedColor);
    }

    const animatedAccent = t.animatedAccent || "none";
    const hpHouse = t.hpHouse || "gryffindor";
    const animSpeedForAccent = t.animSpeed || "normal";
    if (animatedAccent === "none") {
      r.style.setProperty("--va-accent", a);
    }
    startAnimatedAccent(animatedAccent, hpHouse, animSpeedForAccent);

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

    const density = t.density || "comfortable";
    r.style.setProperty("--va-density-scale", DENSITY_SCALE[density] || DENSITY_SCALE.comfortable);

    const cornerStyle = t.cornerStyle || "soft";
    const shadowIntensity = t.shadowIntensity || "subtle";
    const animSpeed = t.animSpeed || "normal";
    const glowEffects = t.glowEffects !== false;
    r.style.setProperty("--va-radius", CORNER_RADIUS[cornerStyle] || CORNER_RADIUS.soft);
    r.style.setProperty("--va-shadow", SHADOW_VAL[shadowIntensity] || SHADOW_VAL.subtle);
    r.style.setProperty("--va-anim-duration", ANIM_DURATION[animSpeed] || ANIM_DURATION.normal);
    r.style.setProperty("--va-glow-opacity", glowEffects ? "1" : "0");

    r.style.setProperty("--va-link", t.linkColor || "#3b82f6");
    r.style.setProperty("--va-success", t.successColor || "#22c55e");
    r.style.setProperty("--va-error", t.errorColor || "#ef4444");
    r.style.setProperty("--va-warning", t.warningColor || "#f59e0b");
    r.style.setProperty("--va-card-border", t.cardBorderColor || borderColor);

    const navTabColors = t.navTabColors || {};
    for (const key of NAV_TAB_KEYS) {
      r.style.setProperty(`--va-navcolor-${key}`, navTabColors[key] || a);
    }

    if (t.hogwartsMode) {
      const palette = HOGWARTS_PALETTES[t.hogwartsPalette] || HOGWARTS_PALETTES.classic;
      r.style.setProperty("--hp-gold", palette.gold);
      r.style.setProperty("--hp-black", palette.black);
      r.style.setProperty("--hp-parchment", palette.parchment);
      r.style.setProperty("--hp-burgundy", palette.burgundy);
      r.style.setProperty("--hp-bronze", palette.bronze);
      r.style.setProperty("--hp-magic-blue", palette.magicBlue);
      r.style.setProperty("--hp-dust-enabled", t.hogwartsDust !== false ? "1" : "0");
      r.style.setProperty("--hp-glow-enabled", t.hogwartsGlow !== false ? "1" : "0");
      r.style.setProperty("--hp-scroll-enabled", t.hogwartsScrollReveal !== false ? "1" : "0");
      r.setAttribute("data-hogwarts", "true");
    } else {
      r.removeAttribute("data-hogwarts");
    }
  } catch {}
}

// Global keyframes + Hogwarts-specific element styling — injected once, always
// present. Scoped under [data-hogwarts="true"] so it has zero effect unless
// Hogwarts Mode is on. Marauder's Map now lives entirely in its own component
// (components/harrypotter/MaraudersMap.tsx) — this file only owns themes,
// colors, fonts, dust particles, and the global sound-effect listeners.
const HOGWARTS_GLOBAL_CSS = `
@keyframes va-floating-dust {
  0% { transform: translateY(0px); opacity: .2; }
  50% { transform: translateY(-14px); opacity: .55; }
  100% { transform: translateY(0px); opacity: .2; }
}
@keyframes va-pensieve-ripple {
  0% { transform: scale(.8); opacity: 0; }
  60% { opacity: .9; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes va-reveal-scroll {
  0% { clip-path: inset(0 0 100% 0); opacity: 0; transform: scaleY(0.85); }
  40% { opacity: 1; }
  100% { clip-path: inset(0 0 0% 0); opacity: 1; transform: scaleY(1); }
}

[data-hogwarts="true"] {
  --va-glow-color: var(--hp-magic-blue, #5DADE2);
}
[data-hogwarts="true"] .va-hogwarts-glow:hover {
  box-shadow: 0 0 10px var(--va-glow-color), 0 0 20px var(--va-glow-color);
  transition: box-shadow 0.25s ease, transform 0.15s ease;
}
[data-hogwarts="true"] .va-hogwarts-dust-particle {
  position: fixed;
  border-radius: 50%;
  background: radial-gradient(circle, var(--hp-gold, #D4AF37) 0%, transparent 70%);
  pointer-events: none;
  z-index: 1;
  animation: va-floating-dust ease-in-out infinite;
}
`;

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { playSound, enabled: soundsEnabled } = useSoundEffects();

  useEffect(() => {
    applyStoredTheme();
    const t = setTimeout(applyStoredTheme, 100);
    return () => clearTimeout(t);
  }, [pathname]);

  const isFirstRender = useState(true);
  useEffect(() => {
    if (isFirstRender[0]) { isFirstRender[1](false); return; }
    playSound("pageTurn");
  }, [pathname]);

  useEffect(() => {
    function handleGlobalKeydown(e: KeyboardEvent) {
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      const isTextField = target && (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && target.getAttribute("type") !== "checkbox" && target.getAttribute("type") !== "radio"));
      if (isTextField) playSound("quillScratch");
      else playSound("keystroke");
    }
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button, a")) playSound("buttonClick");
    }
    window.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);
      window.removeEventListener("click", handleGlobalClick);
    };
  }, [soundsEnabled]);

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

  const [hogwartsActive, setHogwartsActive] = useState(false);
  const [dustOn, setDustOn] = useState(false);
  useEffect(() => {
    function checkHogwarts() {
      try {
        const t = JSON.parse(localStorage.getItem("valArchivesTheme") || "{}");
        setHogwartsActive(!!t.hogwartsMode);
        setDustOn(t.hogwartsDust !== false);
      } catch { setHogwartsActive(false); }
    }
    checkHogwarts();
    window.addEventListener("va-theme-update", checkHogwarts);
    window.addEventListener("storage", checkHogwarts);
    return () => {
      window.removeEventListener("va-theme-update", checkHogwarts);
      window.removeEventListener("storage", checkHogwarts);
    };
  }, [pathname]);

  const dustParticles = (hogwartsActive && dustOn)
    ? Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 5.7) % 100}%`,
        top: `${(i * 13.3) % 100}%`,
        size: 2 + (i % 4),
        duration: 4 + (i % 5),
        delay: (i % 7) * 0.6,
      }))
    : [];

  return (
    <>
      <style>{HOGWARTS_GLOBAL_CSS}</style>

      {dustParticles.map(p => (
        <div key={p.id} className="va-hogwarts-dust-particle" style={{
          left: p.left, top: p.top, width: `${p.size}px`, height: `${p.size}px`,
          animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
        }} />
      ))}

      {children}
    </>
  );
}