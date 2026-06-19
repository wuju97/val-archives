"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSoundEffects } from "./SoundEffects";
import { loadArchive } from "@/lib/archiveEngine";

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

// ── Marauder's Map — simplified castle floor plan ──────────────────────────
// Each room is a labeled rectangle in percent-of-screen coordinates; corridors
// are straight-line connections between room centers. Walkers move room-to-room
// along these connections rather than wandering freely, so it actually reads as
// someone moving through a castle rather than scattering randomly.
const CASTLE_ROOMS: Array<{ name: string; x: number; y: number; w: number; h: number }> = [
  { name: "Great Hall", x: 38, y: 8, w: 24, h: 16 },
  { name: "Entrance Hall", x: 38, y: 28, w: 24, h: 10 },
  { name: "Gryffindor Tower", x: 8, y: 8, w: 18, h: 14 },
  { name: "Slytherin Dungeon", x: 8, y: 60, w: 18, h: 16 },
  { name: "Ravenclaw Tower", x: 74, y: 8, w: 18, h: 14 },
  { name: "Hufflepuff Basement", x: 74, y: 60, w: 18, h: 16 },
  { name: "Library", x: 38, y: 42, w: 24, h: 14 },
  { name: "Potions Classroom", x: 8, y: 42, w: 18, h: 12 },
  { name: "Astronomy Tower", x: 74, y: 42, w: 18, h: 12 },
  { name: "Great Staircase", x: 44, y: 60, w: 12, h: 16 },
  { name: "Forbidden Corridor", x: 38, y: 80, w: 24, h: 10 },
  { name: "Hagrid's Hut", x: 8, y: 80, w: 16, h: 10 },
  { name: "Quidditch Pitch", x: 74, y: 80, w: 18, h: 10 },
];

// Adjacency — which rooms connect to which, so walkers move along plausible paths
const CASTLE_CONNECTIONS: Record<string, string[]> = {
  "Great Hall": ["Entrance Hall", "Library"],
  "Entrance Hall": ["Great Hall", "Gryffindor Tower", "Slytherin Dungeon", "Great Staircase"],
  "Gryffindor Tower": ["Entrance Hall", "Potions Classroom"],
  "Slytherin Dungeon": ["Entrance Hall", "Potions Classroom", "Forbidden Corridor"],
  "Ravenclaw Tower": ["Library", "Astronomy Tower"],
  "Hufflepuff Basement": ["Library", "Astronomy Tower", "Forbidden Corridor"],
  "Library": ["Great Hall", "Ravenclaw Tower", "Hufflepuff Basement", "Great Staircase"],
  "Potions Classroom": ["Gryffindor Tower", "Slytherin Dungeon", "Hagrid's Hut"],
  "Astronomy Tower": ["Ravenclaw Tower", "Hufflepuff Basement", "Quidditch Pitch"],
  "Great Staircase": ["Entrance Hall", "Library", "Forbidden Corridor"],
  "Forbidden Corridor": ["Slytherin Dungeon", "Hufflepuff Basement", "Great Staircase"],
  "Hagrid's Hut": ["Potions Classroom"],
  "Quidditch Pitch": ["Astronomy Tower"],
};

const GENERIC_WALKER_NAMES = [
  "Argus Filch", "Peeves", "Minerva McGonagall", "Severus Snape", "Albus Dumbledore",
  "Rubeus Hagrid", "Pomona Sprout", "Filius Flitwick", "Madam Pince", "Madam Pomfrey",
  "Nearly Headless Nick", "The Fat Friar", "Cho Chang", "Cedric Diggory", "Luna Lovegood",
  "Neville Longbottom", "Fred Weasley", "George Weasley", "Oliver Wood", "Marcus Flint",
];

function getMarauderWalkerNames(count: number): string[] {
  const names: string[] = [];
  try {
    const archive = loadArchive();
    const vaultNames = new Set<string>();
    for (const entry of [...(archive.entries || []), ...(archive.playerEntries || [])]) {
      if (entry.category === "characters" && entry.entity) vaultNames.add(entry.entity);
    }
    const shuffledVault = Array.from(vaultNames).sort(() => Math.random() - 0.5);
    names.push(...shuffledVault.slice(0, count));
  } catch {}
  // Fall back to generic names to fill any remaining slots
  const shuffledGeneric = [...GENERIC_WALKER_NAMES].sort(() => Math.random() - 0.5);
  for (const n of shuffledGeneric) {
    if (names.length >= count) break;
    if (!names.includes(n)) names.push(n);
  }
  return names.slice(0, count);
}

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

    // ── Hogwarts Archive Mode — sets its own dedicated variables only.
    // Deliberately does NOT touch --va-bg/--va-surface/--va-text/--va-border, since those
    // are used by every UI control on every page (including Settings' own buttons and
    // pickers) — overwriting them globally made the whole app's controls unreadable.
    // Pages that want the parchment look apply var(--hp-parchment) etc. themselves,
    // typically scoped to actual vault/archive content rather than UI chrome.
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

// Global keyframes + Hogwarts-specific element styling — injected once, always present.
// Scoped under [data-hogwarts="true"] so it has zero effect unless Hogwarts Mode is on.
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
@keyframes va-marauder-fade {
  0% { opacity: 0; }
  10% { opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes va-footstep-fade {
  0% { opacity: 0; transform: scale(0.6); }
  20% { opacity: .8; transform: scale(1); }
  100% { opacity: 0; transform: scale(1); }
}

[data-hogwarts="true"] {
  --va-glow-color: var(--hp-magic-blue, #5DADE2);
}
/* Opt-in glow class — apply this explicitly to elements that should get the spell-cast
   hover effect (e.g. primary action buttons). Deliberately NOT a blanket button/a selector,
   since that would glow every single interactive element on every page, including tiny
   icon buttons and close buttons where it looks like a mistake rather than a feature. */
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

  // Reapply on every route change
  useEffect(() => {
    applyStoredTheme();
    const t = setTimeout(applyStoredTheme, 100);
    return () => clearTimeout(t);
  }, [pathname]);

  // Page-turn sound — fires once per actual route change, not on the initial mount,
  // since the initial load isn't really "turning a page."
  const isFirstRender = useState(true);
  useEffect(() => {
    if (isFirstRender[0]) { isFirstRender[1](false); return; }
    playSound("pageTurn");
  }, [pathname]);

  // Global keystroke + click sound effects — attached once, independent of route,
  // so they keep firing across every page without needing to re-bind on navigation.
  useEffect(() => {
    function handleGlobalKeydown(e: KeyboardEvent) {
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      const isTextField = target && (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && target.getAttribute("type") !== "checkbox" && target.getAttribute("type") !== "radio"));
      // Quill Scratch takes priority over the generic Keystroke sound while actively
      // typing in a text area or text input, since that's the "writing" context;
      // everywhere else (shortcuts, navigating with arrow keys, etc.) uses Keystroke.
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

  // Floating dust particles — only rendered while Hogwarts Mode + dust are both on.
  // Re-checks on every route change since theme can change between page visits.
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

  // Marauder's Map easter egg — typing "Mischief Managed" anywhere triggers a brief
  // overlay of the castle floor plan with 2–4 named dots walking room-to-room along
  // real corridor connections. Walker names try the vault's actual characters first,
  // falling back to generic Hogwarts staff/students; starting rooms and paths are
  // randomized every trigger so no two activations look the same.
  const [marauderActive, setMarauderActive] = useState(false);
  const [walkers, setWalkers] = useState<Array<{ id: number; name: string; x: number; y: number; roomName: string }>>([]);
  useEffect(() => {
    let typed = "";
    const target = "mischief managed";
    function handleKeydown(e: KeyboardEvent) {
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-target.length);
      if (typed === target) {
        setMarauderActive(true);

        const walkerCount = 2 + Math.floor(Math.random() * 3);
        const names = getMarauderWalkerNames(walkerCount);
        const roomNames = Object.keys(CASTLE_CONNECTIONS);

        const timers: ReturnType<typeof setInterval>[] = [];
        names.forEach((name, i) => {
          let currentRoom = roomNames[Math.floor(Math.random() * roomNames.length)];
          const walkerId = Date.now() + i;

          function roomCenter(roomName: string) {
            const room = CASTLE_ROOMS.find(r => r.name === roomName)!;
            return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
          }

          function placeAt(roomName: string) {
            const c = roomCenter(roomName);
            setWalkers(prev => {
              const filtered = prev.filter(w => w.id !== walkerId);
              return [...filtered, { id: walkerId, name, x: c.x, y: c.y, roomName }];
            });
          }
          placeAt(currentRoom);

          // Every 700–1100ms (varies per walker), move to a connected room —
          // a slightly different pace per person so they don't all march in lockstep.
          const moveDelay = 700 + Math.random() * 400;
          const moveInterval = setInterval(() => {
            const connections = CASTLE_CONNECTIONS[currentRoom] || [];
            if (connections.length === 0) return;
            currentRoom = connections[Math.floor(Math.random() * connections.length)];
            placeAt(currentRoom);
          }, moveDelay);
          timers.push(moveInterval);
        });

        setTimeout(() => {
          setMarauderActive(false);
          setWalkers([]);
          timers.forEach(t => clearInterval(t));
        }, 4500);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

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

      {marauderActive && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none",
          // Aged-parchment texture as the map surface
          background: `
            radial-gradient(circle at 20% 30%, rgba(212,175,55,0.08) 0%, transparent 35%),
            radial-gradient(circle at 80% 70%, rgba(139,111,63,0.1) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(233,223,200,0.06) 0%, transparent 60%),
            linear-gradient(135deg, rgba(139,111,63,0.18) 0%, rgba(15,15,18,0.65) 100%)
          `,
          animation: "va-marauder-fade 4.5s ease-in-out forwards",
        }}>
          <p style={{
            position: "absolute", top: "3%", left: "50%", transform: "translateX(-50%)",
            fontFamily: "'IM Fell English', serif", fontSize: "1.4rem", color: "#D4AF37",
            letterSpacing: "0.15em", textShadow: "0 0 12px rgba(212,175,55,0.6)", zIndex: 2,
          }}>
            ✦ Mischief Managed ✦
          </p>

          {/* Castle floor plan — rooms drawn as parchment-outlined rectangles with labels */}
          {CASTLE_ROOMS.map(room => (
            <div key={room.name} style={{
              position: "absolute", left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%`,
              border: "1px solid rgba(212,175,55,0.35)", borderRadius: "4px",
              background: "rgba(212,175,55,0.04)",
            }}>
              <span style={{
                position: "absolute", top: "3px", left: "5px",
                fontFamily: "'IM Fell English', serif", fontSize: "0.6rem", color: "rgba(212,175,55,0.55)",
                letterSpacing: "0.04em", whiteSpace: "nowrap",
              }}>
                {room.name}
              </span>
            </div>
          ))}

          {/* Named walkers — smoothly glide between room centers via CSS transition
              on left/top, rather than snapping, so movement reads as actual walking. */}
          {walkers.map(w => (
            <div key={w.id} style={{
              position: "absolute", left: `${w.x}%`, top: `${w.y}%`,
              transform: "translate(-50%, -50%)",
              transition: "left 0.7s ease-in-out, top 0.7s ease-in-out",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            }}>
              <span style={{ fontSize: "0.9rem", filter: "sepia(1) opacity(0.85)" }}>👣</span>
              <span style={{
                fontFamily: "'IM Fell English', serif", fontSize: "0.55rem", color: "#D4AF37",
                background: "rgba(15,15,18,0.55)", padding: "0 3px", borderRadius: "2px", whiteSpace: "nowrap",
              }}>
                {w.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {children}
    </>
  );
}