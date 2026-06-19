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

// ════════════════════════════════════════════════════════════════════════
// MARAUDER'S MAP v2 — organic film-map-style castle layout
// ════════════════════════════════════════════════════════════════════════

interface CastleRoom {
  name: string;
  cx: number; // center x (0-100)
  cy: number; // center y (0-100)
  labelAngle?: number; // degrees, slight hand-lettered tilt
}

// Rooms positioned diagonally/asymmetrically (towers top corners, grounds
// bottom, central hall) rather than a grid, matching the real map's sprawl.
const CASTLE_ROOMS: CastleRoom[] = [
  { name: "Gryffindor Tower", cx: 14, cy: 12, labelAngle: -6 },
  { name: "Ravenclaw Tower", cx: 86, cy: 14, labelAngle: 5 },
  { name: "Great Hall", cx: 50, cy: 22, labelAngle: 0 },
  { name: "Entrance Hall", cx: 50, cy: 38, labelAngle: 0 },
  { name: "Library", cx: 27, cy: 40, labelAngle: -4 },
  { name: "Astronomy Tower", cx: 73, cy: 40, labelAngle: 4 },
  { name: "Great Staircase", cx: 50, cy: 54, labelAngle: 0 },
  { name: "Potions Classroom", cx: 18, cy: 58, labelAngle: -8 },
  { name: "Slytherin Dungeon", cx: 12, cy: 76, labelAngle: -5 },
  { name: "Hufflepuff Basement", cx: 88, cy: 76, labelAngle: 5 },
  { name: "Forbidden Corridor", cx: 62, cy: 64, labelAngle: 3 },
  { name: "Hagrid's Hut", cx: 22, cy: 92, labelAngle: -3 },
  { name: "Quidditch Pitch", cx: 78, cy: 92, labelAngle: 3 },
];

const CASTLE_CONNECTIONS: Record<string, string[]> = {
  "Gryffindor Tower": ["Great Hall", "Library"],
  "Ravenclaw Tower": ["Great Hall", "Astronomy Tower"],
  "Great Hall": ["Gryffindor Tower", "Ravenclaw Tower", "Entrance Hall"],
  "Entrance Hall": ["Great Hall", "Library", "Astronomy Tower", "Great Staircase"],
  "Library": ["Gryffindor Tower", "Entrance Hall", "Potions Classroom"],
  "Astronomy Tower": ["Ravenclaw Tower", "Entrance Hall", "Forbidden Corridor"],
  "Great Staircase": ["Entrance Hall", "Potions Classroom", "Forbidden Corridor"],
  "Potions Classroom": ["Library", "Great Staircase", "Slytherin Dungeon"],
  "Slytherin Dungeon": ["Potions Classroom", "Hagrid's Hut"],
  "Hufflepuff Basement": ["Forbidden Corridor", "Quidditch Pitch"],
  "Forbidden Corridor": ["Astronomy Tower", "Great Staircase", "Hufflepuff Basement"],
  "Hagrid's Hut": ["Slytherin Dungeon"],
  "Quidditch Pitch": ["Hufflepuff Basement"],
};

const ROOM_BY_NAME: Record<string, CastleRoom> = CASTLE_ROOMS.reduce(
  (acc, r) => ({ ...acc, [r.name]: r }), {} as Record<string, CastleRoom>
);

// Dense illegible wavy "writing" filling empty parchment — deterministic,
// computed once at module load, matching the busy look of the real map.
function buildScribbleLines(): string[] {
  const lines: string[] = [];
  for (let row = 0; row < 22; row++) {
    const y = 2 + row * 4.4;
    let d = `M 1 ${y}`;
    const segs = 14;
    for (let i = 1; i <= segs; i++) {
      const x = 1 + (i * 98) / segs;
      const wob = Math.sin(row * 1.7 + i * 0.9) * 1.1;
      d += ` L ${x.toFixed(1)} ${(y + wob).toFixed(1)}`;
    }
    lines.push(d);
  }
  return lines;
}
const SCRIBBLE_LINES = buildScribbleLines();

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
      if (entry.category === "characters" && (entry as any).entity) vaultNames.add((entry as any).entity);
    }
    const shuffledVault = Array.from(vaultNames).sort(() => Math.random() - 0.5);
    names.push(...shuffledVault.slice(0, count));
  } catch {}
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

  // Marauder's Map easter egg
  const [marauderActive, setMarauderActive] = useState(false);
  const [footprints, setFootprints] = useState<Array<{ id: number; x: number; y: number; angle: number; bornAt: number; side: 1 | -1 }>>([]);
  const [labels, setLabels] = useState<Array<{ id: number; name: string; x: number; y: number }>>([]);
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

        const timers: ReturnType<typeof setInterval | typeof setTimeout>[] = [];
        let printIdCounter = 0;

        names.forEach((name, i) => {
          let currentRoom = roomNames[Math.floor(Math.random() * roomNames.length)];
          const labelId = Date.now() + i;
          let stepCount = 0;

          const startRoom = ROOM_BY_NAME[currentRoom];
          if (startRoom) {
            setLabels(prev => [...prev.filter(l => l.id !== labelId), { id: labelId, name, x: startRoom.cx, y: startRoom.cy }]);
          }

          // Drops a single footprint blot at (x,y), alternating left/right of
          // the direction of travel — this IS the visible trail, there is no
          // separate line. Each print fades out on its own after ~1.8s via
          // the bornAt timestamp read during render.
          function dropPrint(x: number, y: number, angle: number) {
            stepCount++;
            const side: 1 | -1 = stepCount % 2 === 0 ? 1 : -1;
            const perpX = Math.cos((angle + 90) * Math.PI / 180) * 0.5 * side;
            const perpY = Math.sin((angle + 90) * Math.PI / 180) * 0.5 * side;
            const id = ++printIdCounter + i * 10000;
            setFootprints(prev => [
              ...prev,
              { id, x: x + perpX, y: y + perpY, angle, bornAt: Date.now(), side },
            ]);
            const cleanup = setTimeout(() => {
              setFootprints(prev => prev.filter(p => p.id !== id));
            }, 1800);
            timers.push(cleanup);
          }

          function walkToRoom(nextRoomName: string, onDone: () => void) {
            const from = ROOM_BY_NAME[currentRoom];
            const to = ROOM_BY_NAME[nextRoomName];
            if (!from || !to) { onDone(); return; }

            const dx = to.cx - from.cx;
            const dy = to.cy - from.cy;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const STEPS = 6;
            let step = 0;
            const stepInterval = setInterval(() => {
              step++;
              const t = step / STEPS;
              const x = from.cx + dx * t;
              const y = from.cy + dy * t;
              dropPrint(x, y, angle);
              setLabels(prev => prev.map(l => l.id === labelId ? { ...l, x, y } : l));
              if (step >= STEPS) {
                clearInterval(stepInterval);
                currentRoom = nextRoomName;
                onDone();
              }
            }, 220);
            timers.push(stepInterval);
          }

          function scheduleNextMove() {
            const connections = CASTLE_CONNECTIONS[currentRoom] || [];
            if (connections.length === 0) return;
            const next = connections[Math.floor(Math.random() * connections.length)];
            const pauseAtRoom = setTimeout(() => {
              walkToRoom(next, scheduleNextMove);
            }, 400 + Math.random() * 400);
            timers.push(pauseAtRoom);
          }
          scheduleNextMove();
        });

        setTimeout(() => {
          setMarauderActive(false);
          setFootprints([]);
          setLabels([]);
          timers.forEach(t => clearInterval(t as ReturnType<typeof setInterval>));
        }, 6000);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  // Re-render periodically while the map is active so fading footprints
  // (opacity computed from age at render time) actually animate out smoothly.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!marauderActive) return;
    const id = setInterval(() => forceTick(n => n + 1), 80);
    return () => clearInterval(id);
  }, [marauderActive]);

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
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 999999,
          pointerEvents: "none",
          animation: "va-marauder-fade 4.5s ease-in-out forwards",
        }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
            style={{ width: "100%", height: "100%", display: "block" }}>
            <defs>
              <radialGradient id="va-parchment-grad" cx="50%" cy="45%" r="75%">
                <stop offset="0%" stopColor="#e9d6a8" />
                <stop offset="55%" stopColor="#d8bd82" />
                <stop offset="100%" stopColor="#a9824f" />
              </radialGradient>
              <radialGradient id="va-ink-stain" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#5c3a1e" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#5c3a1e" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect x="0" y="0" width="100" height="100" fill="url(#va-parchment-grad)" />

            <circle cx="12" cy="20" r="9" fill="url(#va-ink-stain)" />
            <circle cx="88" cy="30" r="7" fill="url(#va-ink-stain)" />
            <circle cx="30" cy="85" r="10" fill="url(#va-ink-stain)" />
            <circle cx="70" cy="8" r="6" fill="url(#va-ink-stain)" />
            <circle cx="95" cy="90" r="8" fill="url(#va-ink-stain)" />

            <g stroke="#5c3a1e" strokeOpacity="0.12" strokeWidth="0.18" fill="none">
              {SCRIBBLE_LINES.map((d, i) => <path key={i} d={d} />)}
            </g>

            {/* No static corridor lines — the real map has no drawn paths between
                rooms. Movement is shown purely by the footprint trail itself,
                which fades in and out as each walker passes through. */}

            {CASTLE_ROOMS.map(room => (
              <g key={room.name}>
                <circle cx={room.cx} cy={room.cy} r="0.7" fill="#3d2814" fillOpacity="0.6" />
                <text
                  x={room.cx} y={room.cy - 1.6}
                  transform={`rotate(${room.labelAngle ?? 0} ${room.cx} ${room.cy - 1.6})`}
                  textAnchor="middle"
                  style={{
                    fontFamily: "'IM Fell English', serif",
                    fontSize: "2.1px",
                    fill: "#3d2814",
                    opacity: 0.75,
                    letterSpacing: "0.02em",
                  }}
                >
                  {room.name}
                </text>
              </g>
            ))}

            <text x="50" y="6" textAnchor="middle" style={{
              fontFamily: "'IM Fell English', serif", fontSize: "2.8px",
              fill: "#3d2814", letterSpacing: "0.15em", opacity: 0.85,
            }}>
              Mischief Managed
            </text>

            {footprints.map(p => {
              const age = Date.now() - p.bornAt;
              const fadeProgress = Math.min(age / 1800, 1);
              const opacity = 0.85 * (1 - fadeProgress);
              return (
                <ellipse key={p.id}
                  cx={p.x} cy={p.y} rx="0.5" ry="0.75"
                  fill="#8b2e1f"
                  opacity={Math.max(opacity, 0)}
                  transform={`rotate(${p.angle} ${p.x} ${p.y})`}
                />
              );
            })}

            {labels.map(l => (
              <text key={l.id}
                x={l.x} y={l.y - 2.2}
                textAnchor="middle"
                style={{
                  fontFamily: "'IM Fell English', cursive, serif",
                  fontSize: "2px",
                  fontStyle: "italic",
                  fill: "#3d2814",
                  opacity: 0.85,
                  letterSpacing: "0.02em",
                }}
              >
                {l.name}
              </text>
            ))}
          </svg>
        </div>
      )}

      {children}
    </>
  );
}