"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { loadArchive } from "@/lib/archiveEngine";
import { geminiQualityCallFor, hasGeminiQualityKey3, hasGeminiQualityKey, hasGeminiQualityKey2 } from "@/lib/geminiEngine";

// ════════════════════════════════════════════════════════════════════════
// LAYOUT — matches the user's hand-drawn Hogwarts grounds sketch:
// boundary wall ring with a Hogsmeade gate at the top, central lake with
// the castle just north of it, broom shed + Quidditch ground to the west,
// Hagrid's Hut/Pumpkin Patch + Whomping Willow + Greenhouses to the east,
// Forbidden Forest filling the east edge, Hogsmeade Station + railway
// along the bottom. Each location gets a small icon glyph, not just text.
// ════════════════════════════════════════════════════════════════════════

type IconKind = "castle" | "hut" | "tree" | "hoops" | "shed" | "greenhouse" | "station" | "none";

interface WanderPath {
  zoneName: string;
  icon: IconKind;
  iconPos: { x: number; y: number };
  points: Array<{ x: number; y: number }>; // closed loop for wandering
}

const WANDER_PATHS: WanderPath[] = [
  { zoneName: "Hogwarts", icon: "castle", iconPos: { x: 48, y: 46 }, points: [
    { x: 38, y: 42 }, { x: 48, y: 38 }, { x: 60, y: 42 }, { x: 58, y: 52 }, { x: 44, y: 54 }, { x: 36, y: 50 }, { x: 38, y: 42 },
  ]},
  { zoneName: "Broom Shed", icon: "shed", iconPos: { x: 28, y: 44 }, points: [
    { x: 22, y: 38 }, { x: 32, y: 38 }, { x: 34, y: 46 }, { x: 26, y: 50 }, { x: 20, y: 46 }, { x: 22, y: 38 },
  ]},
  { zoneName: "Quidditch Ground", icon: "hoops", iconPos: { x: 28, y: 24 }, points: [
    { x: 16, y: 18 }, { x: 36, y: 16 }, { x: 40, y: 26 }, { x: 30, y: 32 }, { x: 14, y: 28 }, { x: 16, y: 18 },
  ]},
  { zoneName: "Hagrid's Hut", icon: "hut", iconPos: { x: 76, y: 18 }, points: [
    { x: 68, y: 12 }, { x: 80, y: 10 }, { x: 84, y: 18 }, { x: 76, y: 24 }, { x: 66, y: 20 }, { x: 68, y: 12 },
  ]},
  { zoneName: "Whomping Willow", icon: "tree", iconPos: { x: 70, y: 34 }, points: [
    { x: 62, y: 28 }, { x: 76, y: 26 }, { x: 80, y: 36 }, { x: 70, y: 42 }, { x: 60, y: 38 }, { x: 62, y: 28 },
  ]},
  { zoneName: "Greenhouses", icon: "greenhouse", iconPos: { x: 64, y: 50 }, points: [
    { x: 58, y: 46 }, { x: 70, y: 44 }, { x: 72, y: 52 }, { x: 62, y: 56 }, { x: 56, y: 52 }, { x: 58, y: 46 },
  ]},
  { zoneName: "Forbidden Forest", icon: "tree", iconPos: { x: 90, y: 40 }, points: [
    { x: 84, y: 16 }, { x: 96, y: 20 }, { x: 96, y: 60 }, { x: 86, y: 64 }, { x: 80, y: 40 }, { x: 84, y: 16 },
  ]},
  { zoneName: "Hogsmeade Station", icon: "station", iconPos: { x: 68, y: 88 }, points: [
    { x: 58, y: 84 }, { x: 76, y: 82 }, { x: 80, y: 90 }, { x: 70, y: 94 }, { x: 56, y: 92 }, { x: 58, y: 84 },
  ]},
];

function polylineLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x, dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}
function pointAtDistance(points: Array<{ x: number; y: number }>, dist: number): { x: number; y: number; angle: number } {
  let remaining = dist;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (remaining <= segLen || i === points.length - 1) {
      const t = segLen === 0 ? 0 : Math.min(remaining / segLen, 1);
      return { x: a.x + dx * t, y: a.y + dy * t, angle: Math.atan2(dy, dx) * 180 / Math.PI };
    }
    remaining -= segLen;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}
function polylineToPathD(points: Array<{ x: number; y: number }>): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
}

// ════════════════════════════════════════════════════════════════════════
// TERRAIN — boundary wall (ring with a gate gap at the top), lake, and
// the Forbidden Forest's dense tree mass, all drawn as actual shapes
// matching the sketch's composition rather than abstract labels.
// ════════════════════════════════════════════════════════════════════════

// Boundary wall ring — irregular closed loop with a gap at the top for
// the Hogsmeade gate, drawn as a coiled/scalloped line like the sketch.
const WALL_POINTS: Array<{ x: number; y: number }> = [
  { x: 52, y: 4 }, { x: 30, y: 6 }, { x: 14, y: 14 }, { x: 6, y: 30 }, { x: 5, y: 50 },
  { x: 8, y: 70 }, { x: 18, y: 84 }, { x: 36, y: 92 }, { x: 56, y: 92 }, { x: 72, y: 84 },
  { x: 78, y: 68 }, { x: 78, y: 48 }, { x: 76, y: 28 }, { x: 68, y: 10 }, { x: 52, y: 4 },
];
// Gate gap location (top of the wall, matching "Hogsmeade / Gate" in the sketch)
const GATE_POS = { x: 52, y: 4 };

const LAKE_PATH = "M 30 60 Q 22 56 24 48 Q 28 42 38 44 Q 46 40 54 44 Q 62 42 66 50 Q 70 58 62 64 Q 56 70 46 68 Q 36 70 30 60 Z";

// Forbidden Forest dense tree clusters — many small tree glyphs packed
// into the forest zone, giving the dense-mass look from the sketch's
// scribbled forest texture rather than a single label.
function buildForestTrees(): Array<{ x: number; y: number; r: number }> {
  const trees: Array<{ x: number; y: number; r: number }> = [];
  let seed = 31;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (let i = 0; i < 40; i++) {
    const x = 80 + rand() * 18;
    const y = 12 + rand() * 56;
    trees.push({ x, y, r: 0.8 + rand() * 0.7 });
  }
  return trees;
}
const FOREST_TREES = buildForestTrees();

// ════════════════════════════════════════════════════════════════════════
// ICON GLYPHS — small figures per location, matching the request for
// "a hut figure where Hagrid's hut is, a castle figure for the castle"
// etc, instead of plain text labels.
// ════════════════════════════════════════════════════════════════════════

function LocationIcon({ kind, x, y }: { kind: IconKind; x: number; y: number }) {
  const stroke = "#3d2814";
  const fill = "#5c3a1e";
  switch (kind) {
    case "castle":
      return (
        <g transform={`translate(${x} ${y})`} opacity="0.7">
          <rect x="-4" y="-1" width="8" height="4" fill="none" stroke={stroke} strokeWidth="0.25" />
          <rect x="-4.6" y="-2.6" width="1.6" height="2" fill="none" stroke={stroke} strokeWidth="0.2" />
          <rect x="3" y="-3.4" width="1.6" height="2.8" fill="none" stroke={stroke} strokeWidth="0.2" />
          <path d="M -0.8 -1 L -0.8 -3.4 L 0.8 -3.4 L 0.8 -1" fill="none" stroke={stroke} strokeWidth="0.2" />
          <path d="M -0.8 -3.4 L 0 -4.6 L 0.8 -3.4" fill="none" stroke={stroke} strokeWidth="0.2" />
        </g>
      );
    case "hut":
      return (
        <g transform={`translate(${x} ${y})`} opacity="0.7">
          <rect x="-2.2" y="-0.4" width="4.4" height="2.6" fill="none" stroke={stroke} strokeWidth="0.22" />
          <path d="M -2.8 -0.4 L 0 -3 L 2.8 -0.4 Z" fill="none" stroke={stroke} strokeWidth="0.22" />
          <line x1="0.8" x2="0.8" y1="-2.4" y2="-3.6" stroke={stroke} strokeWidth="0.15" />
        </g>
      );
    case "tree":
      return (
        <g transform={`translate(${x} ${y})`} opacity="0.7">
          <circle cx="0" cy="-1.6" r="1.8" fill="none" stroke={stroke} strokeWidth="0.2" />
          <line x1="0" x2="0" y1="0.2" y2="2.2" stroke={stroke} strokeWidth="0.3" />
        </g>
      );
    case "hoops":
      return (
        <g transform={`translate(${x} ${y})`} opacity="0.7">
          {[-2.4, 0, 2.4].map((dx, i) => (
            <g key={i} transform={`translate(${dx} 0)`}>
              <line x1="0" x2="0" y1="-2.6" y2="1" stroke={stroke} strokeWidth="0.15" />
              <ellipse cx="0" cy="-2.6" rx="0.9" ry="0.5" fill="none" stroke={stroke} strokeWidth="0.18" />
            </g>
          ))}
        </g>
      );
    case "shed":
      return (
        <g transform={`translate(${x} ${y})`} opacity="0.7">
          <rect x="-1.6" y="-1.4" width="3.2" height="2.4" fill="none" stroke={stroke} strokeWidth="0.2" />
          <path d="M -1.9 -1.4 L 0 -2.6 L 1.9 -1.4" fill="none" stroke={stroke} strokeWidth="0.2" />
        </g>
      );
    case "greenhouse":
      return (
        <g transform={`translate(${x} ${y})`} opacity="0.7">
          {[-1.6, 1.6].map((dx, i) => (
            <g key={i} transform={`translate(${dx} 0)`}>
              <path d="M -1 1.2 L -1 -0.6 L 0 -1.8 L 1 -0.6 L 1 1.2 Z" fill="none" stroke={stroke} strokeWidth="0.18" />
            </g>
          ))}
        </g>
      );
    case "station":
      return (
        <g transform={`translate(${x} ${y})`} opacity="0.7">
          <rect x="-2" y="-1.6" width="4" height="2" fill="none" stroke={stroke} strokeWidth="0.2" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={-2.6 + i * 0.9} x2={-2.6 + i * 0.9} y1="1" y2="1.6" stroke={stroke} strokeWidth="0.12" />
          ))}
          <line x1="-3" x2="3" y1="1.3" y2="1.3" stroke={stroke} strokeWidth="0.15" />
        </g>
      );
    default:
      return null;
  }
}

// ════════════════════════════════════════════════════════════════════════
// SCRIBBLE TEXTURE — dense ink "writing" filling open ground, unchanged
// in approach but kept lighter near terrain shapes so they stay legible.
// ════════════════════════════════════════════════════════════════════════

interface ScribbleZone { x0: number; y0: number; x1: number; y1: number; angle: number }
const SCRIBBLE_ZONES: ScribbleZone[] = [
  { x0: 0, y0: 0, x1: 100, y1: 8, angle: 5 },
  { x0: 0, y0: 92, x1: 100, y1: 100, angle: -5 },
  { x0: 0, y0: 0, x1: 8, y1: 100, angle: 80 },
  { x0: 32, y0: 0, x1: 68, y1: 8, angle: 0 },
  { x0: 0, y0: 70, x1: 18, y1: 92, angle: 20 },
];

function buildScribbleClusters(): Array<{ d: string; size: number }> {
  const clusters: Array<{ d: string; size: number }> = [];
  let seed = 19;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (const zone of SCRIBBLE_ZONES) {
    const w = zone.x1 - zone.x0, h = zone.y1 - zone.y0;
    const area = Math.max(w * h, 1);
    const clusterCount = Math.max(5, Math.floor(area * 0.4));
    const rad = (zone.angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    for (let i = 0; i < clusterCount; i++) {
      const baseX = zone.x0 + rand() * w, baseY = zone.y0 + rand() * h;
      const strokeCount = 2 + Math.floor(rand() * 3);
      let d = "", cursorX = 0;
      for (let s = 0; s < strokeCount; s++) {
        const letterW = 0.4 + rand() * 0.7, letterH = 0.4 + rand() * 0.9;
        const x0 = cursorX, y0 = (rand() - 0.5) * 0.4;
        const x1 = cursorX + letterW * 0.4, y1 = y0 - letterH * (rand() > 0.5 ? 1 : -1) * 0.6;
        const x2 = cursorX + letterW, y2 = y0 + (rand() - 0.5) * 0.3;
        const rx0 = baseX + (x0 * cos - y0 * sin), ry0 = baseY + (x0 * sin + y0 * cos);
        const rx1 = baseX + (x1 * cos - y1 * sin), ry1 = baseY + (x1 * sin + y1 * cos);
        const rx2 = baseX + (x2 * cos - y2 * sin), ry2 = baseY + (x2 * sin + y2 * cos);
        d += `M ${rx0.toFixed(2)} ${ry0.toFixed(2)} Q ${rx1.toFixed(2)} ${ry1.toFixed(2)} ${rx2.toFixed(2)} ${ry2.toFixed(2)} `;
        cursorX += letterW * 0.8;
      }
      clusters.push({ d, size: 0.07 + rand() * 0.05 });
    }
  }
  return clusters;
}
const SCRIBBLE_CLUSTERS = buildScribbleClusters();

function TitleBanner() {
  const w = 17;
  return (
    <g transform="translate(50 4)">
      <path d={`M ${-w * 0.55} 1.3 Q ${-w * 0.75} 2.3 ${-w * 0.5} 2.7 Q ${-w * 0.3} 3.0 ${-w * 0.5} 2.0 Q ${-w * 0.6} 1.5 ${-w * 0.4} 1.4`}
        fill="none" stroke="#7a3b2e" strokeWidth="0.14" strokeOpacity="0.9" />
      <path d={`M ${-w} -1.1 L ${w * 0.6} -1.2 L ${w} -0.5 L ${w * 0.72} 0 L ${w} 0.5 L ${w * 0.6} 1.2 L ${-w} 1.1 L ${-w * 0.75} 0 Z`}
        fill="#7a3b2e" fillOpacity="0.85" stroke="#3d2814" strokeWidth="0.1" />
      <g transform={`translate(${-w * 0.92} 0)`}>
        <path d="M 0 -1.3 Q -0.9 -1.3 -0.9 -0.55 Q -0.9 0 -0.3 0.05 Q 0.15 0.05 0.15 -0.3 Q 0.15 -0.55 -0.15 -0.55"
          fill="none" stroke="#3d2814" strokeWidth="0.12" />
        <path d="M -0.9 -0.55 Q -0.9 0.3 0 1.3 L 0 -1.3 Z" fill="#7a3b2e" fillOpacity="0.7" stroke="#3d2814" strokeWidth="0.1" />
      </g>
      <text x="0" y="0.6" textAnchor="middle" style={{ fontFamily: "'Pirata One', 'IM Fell English', serif", fontSize: "2.6px", fill: "#e9d6a8", letterSpacing: "0.05em" }}>
        Marauder's Map
      </text>
    </g>
  );
}

// ════════════════════════════════════════════════════════════════════════
// AI POPULATION
// ════════════════════════════════════════════════════════════════════════

interface MapCharacter { id: string; name: string; zone: string; rumor: string }
const ZONE_NAMES = WANDER_PATHS.map(p => p.zoneName);

const GENERIC_WALKER_NAMES = [
  "Argus Filch", "Peeves", "Minerva McGonagall", "Severus Snape", "Albus Dumbledore",
  "Rubeus Hagrid", "Pomona Sprout", "Filius Flitwick", "Madam Pince", "Madam Pomfrey",
  "Nearly Headless Nick", "The Fat Friar", "Cho Chang", "Cedric Diggory", "Luna Lovegood",
  "Neville Longbottom", "Fred Weasley", "George Weasley", "Oliver Wood", "Marcus Flint",
];

function buildMaraudersPrompt(vaultCharacterNames: string[], vaultContext: string): string {
  return `You are populating a "Marauder's Map" feature for a Harry Potter RPG campaign archive. Below is a list of known characters from the user's vault, plus brief story context.

KNOWN CHARACTERS: ${vaultCharacterNames.join(", ") || "(none found in vault)"}

STORY CONTEXT (recent canon/player entries, for plausibility only):
${vaultContext.slice(0, 4000)}

AVAILABLE ZONES: ${ZONE_NAMES.join(", ")}

Pick 3-6 characters who would plausibly be active right now (prefer named vault characters; you may include 1-2 generic Hogwarts staff/students if it makes sense). For each, assign:
- "name": their name
- "zone": one zone from the AVAILABLE ZONES list where they'd plausibly be wandering
- "rumor": a short (max 12 words) in-character one-liner about what they're doing right now, written like an amusing rumor

Output ONLY a valid JSON array, no markdown fences, no preamble:
[{"name": "...", "zone": "...", "rumor": "..."}]`;
}

async function fetchMaraudersPopulation(): Promise<MapCharacter[]> {
  try {
    const hasAnyKey = hasGeminiQualityKey3() || hasGeminiQualityKey() || hasGeminiQualityKey2();
    if (!hasAnyKey) throw new Error("no key");
    const archive = loadArchive();
    const allEntries = [...(archive.entries || []), ...(archive.playerEntries || [])];
    const characterNames = Array.from(new Set(
      allEntries.filter(e => e.category === "characters").map(e => (e as any).entity).filter(Boolean)
    )) as string[];
    const contextText = allEntries.slice(-30).map(e => e.text).join(" / ");
    const prompt = buildMaraudersPrompt(characterNames, contextText);
    const raw = await geminiQualityCallFor("general", prompt);
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    const parsed: Array<{ name: string; zone: string; rumor: string }> = match ? JSON.parse(match[0]) : JSON.parse(cleaned);
    return parsed
      .filter(p => p.name && ZONE_NAMES.includes(p.zone))
      .map((p, i) => ({ id: `ai-${i}-${Date.now()}`, name: p.name, zone: p.zone, rumor: p.rumor || "" }));
  } catch {
    const count = 3 + Math.floor(Math.random() * 3);
    const names = [...GENERIC_WALKER_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
    return names.map((name, i) => ({
      id: `fallback-${i}-${Date.now()}`, name,
      zone: ZONE_NAMES[Math.floor(Math.random() * ZONE_NAMES.length)], rumor: "",
    }));
  }
}

// ════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════

type MapPhase = "closed" | "opening" | "open" | "closing";
interface CharUnit { x: number; y: number; angle: number }

export default function MaraudersMap() {
  const [phase, setPhase] = useState<MapPhase>("closed");
  const [loadingChars, setLoadingChars] = useState(false);
  const [characters, setCharacters] = useState<MapCharacter[]>([]);
  const [units, setUnits] = useState<Record<string, CharUnit>>({});
  const [trails, setTrails] = useState<Record<string, Array<{ x: number; y: number; angle: number }>>>({});
  const [selected, setSelected] = useState<MapCharacter | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const timersRef = useRef<Array<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>>>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(t => { clearInterval(t as any); clearTimeout(t as any); });
    timersRef.current = [];
  }, []);

  useEffect(() => {
    let typed = "";
    const OPEN_PHRASE = "i solemnly swear that i am up to no good";
    const CLOSE_PHRASE = "mischief managed";
    function handleKeydown(e: KeyboardEvent) {
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-OPEN_PHRASE.length);
      if (typed.endsWith(OPEN_PHRASE) && phase === "closed") openMap();
      else if (typed.endsWith(CLOSE_PHRASE) && (phase === "open" || phase === "opening")) closeMap();
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const openMap = useCallback(async () => {
    if (phase !== "closed") return;
    setPhase("opening");
    setLoadingChars(true);
    const chars = await fetchMaraudersPopulation();
    setCharacters(chars);
    const initialUnits: Record<string, CharUnit> = {};
    chars.forEach(c => {
      const path = WANDER_PATHS.find(p => p.zoneName === c.zone);
      if (path) initialUnits[c.id] = { x: path.points[0].x, y: path.points[0].y, angle: 0 };
    });
    setUnits(initialUnits);
    setLoadingChars(false);
    setTimeout(() => setPhase("open"), 700);
  }, [phase]);

  const closeMap = useCallback(() => {
    setPhase("closing");
    clearAllTimers();
    setTimeout(() => {
      setPhase("closed");
      setCharacters([]); setUnits({}); setTrails({}); setSelected(null);
      setSearchQuery(""); setZoom(1); setPan({ x: 0, y: 0 });
    }, 500);
  }, [clearAllTimers]);

  useEffect(() => {
    if (phase !== "open" || characters.length === 0) return;
    const rafIds: number[] = [];

    characters.forEach(char => {
      const path = WANDER_PATHS.find(p => p.zoneName === char.zone);
      if (!path) return;
      const points = path.points;
      const totalLen = polylineLength(points);
      const durationMs = Math.max(totalLen * 900, 16000);
      const SPEED_PER_MS = totalLen / durationMs;
      const TRAIL_SPACING = 0.6;

      let lastTrailDist = 0;
      let loopStartTime: number | null = null;
      let pausedUntil = 0;
      let accumulatedPauseMs = 0;
      let nextPauseCheckAt = 3000 + Math.random() * 4000;

      function tick(now: number) {
        if (loopStartTime === null) loopStartTime = now;
        if (now < pausedUntil) {
          const rafId = requestAnimationFrame(tick);
          rafIds.push(rafId);
          return;
        }
        const elapsedActive = now - loopStartTime - accumulatedPauseMs;
        if (elapsedActive >= nextPauseCheckAt && Math.random() < 0.3) {
          const pauseMs = 1500 + Math.random() * 2500;
          pausedUntil = now + pauseMs;
          accumulatedPauseMs += pauseMs;
          nextPauseCheckAt += 4000 + Math.random() * 4000;
          const rafId = requestAnimationFrame(tick);
          rafIds.push(rafId);
          return;
        }

        const traveled = (elapsedActive * SPEED_PER_MS) % totalLen;
        const { x, y, angle } = pointAtDistance(points, traveled);
        setUnits(prev => ({ ...prev, [char.id]: { x, y, angle } }));

        if (traveled - lastTrailDist >= TRAIL_SPACING || Math.abs(traveled - lastTrailDist) > totalLen / 2) {
          setTrails(prev => {
            const existing = prev[char.id] || [];
            const next = [...existing, { x, y, angle }];
            return { ...prev, [char.id]: next.slice(-26) };
          });
          lastTrailDist = traveled;
        }

        const rafId = requestAnimationFrame(tick);
        rafIds.push(rafId);
      }
      const rafId = requestAnimationFrame(tick);
      rafIds.push(rafId);
    });

    return () => rafIds.forEach(id => cancelAnimationFrame(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, characters]);

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (phase !== "open") return;
    const id = setInterval(() => forceTick(n => n + 1), 80);
    return () => clearInterval(id);
  }, [phase]);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom(prev => Math.max(1, Math.min(4, prev + (e.deltaY < 0 ? 0.15 : -0.15))));
  }
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 });
  function handlePointerDown(e: React.PointerEvent) { dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY }; }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.lastX, dy = e.clientY - dragState.current.lastY;
    dragState.current.lastX = e.clientX; dragState.current.lastY = e.clientY;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }
  function handlePointerUp() { dragState.current.dragging = false; }

  const matchedCharId = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    return characters.find(c => c.name.toLowerCase().includes(q))?.id ?? null;
  }, [searchQuery, characters]);

  if (phase === "closed") {
    return (
      <button
        onClick={openMap}
        className="va-hogwarts-glow"
        style={{
          position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 500,
          background: "linear-gradient(135deg, #7a3b2e, #3d2814)",
          color: "#e9d6a8", border: "1px solid #3d2814", borderRadius: "0.5rem",
          padding: "0.625rem 1.1rem", fontFamily: "'Pirata One', 'IM Fell English', serif",
          fontSize: "0.95rem", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        🗺️ I solemnly swear that I am up to no good
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: phase === "closing" ? 0 : 1, transition: "opacity 0.5s ease",
    }}>
      <div style={{
        position: "relative", width: "min(92vw, 1100px)", height: "min(88vh, 800px)",
        transform: phase === "opening" ? "scaleY(0.05)" : "scaleY(1)",
        transformOrigin: "center", transition: "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)", borderRadius: "0.5rem", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.6rem 0.9rem", background: "rgba(15,15,18,0.7)",
        }}>
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 Find witch or wizard..."
            style={{
              flex: 1, background: "rgba(233,214,168,0.15)", border: "1px solid rgba(233,214,168,0.3)",
              borderRadius: "0.375rem", padding: "0.4rem 0.7rem", color: "#e9d6a8",
              fontFamily: "'IM Fell English', serif", fontSize: "0.85rem", outline: "none",
            }}
          />
          <span style={{ color: "#e9d6a8", fontSize: "0.7rem", opacity: 0.7 }}>scroll to zoom · drag to pan</span>
          <button onClick={closeMap} style={{
            background: "rgba(122,59,46,0.9)", color: "#e9d6a8", border: "1px solid #3d2814",
            borderRadius: "0.375rem", padding: "0.4rem 0.8rem", cursor: "pointer",
            fontFamily: "'Pirata One', serif", fontSize: "0.8rem",
          }}>✦ Mischief Managed</button>
        </div>

        <svg
          viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
          onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
          style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }}
        >
          <defs>
            <radialGradient id="va-parchment-grad" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="#e9d6a8" /><stop offset="55%" stopColor="#d8bd82" /><stop offset="100%" stopColor="#a9824f" />
            </radialGradient>
            <radialGradient id="va-ink-stain" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5c3a1e" stopOpacity="0.18" /><stop offset="100%" stopColor="#5c3a1e" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g transform={`translate(${pan.x / 8} ${pan.y / 8}) scale(${zoom})`} style={{ transformOrigin: "50% 50%" }}>
            <rect x="0" y="0" width="100" height="100" fill="url(#va-parchment-grad)" />
            <circle cx="88" cy="78" r="7" fill="url(#va-ink-stain)" />
            <circle cx="14" cy="60" r="6" fill="url(#va-ink-stain)" />

            <g stroke="#5c3a1e" strokeOpacity="0.28" fill="none" strokeLinecap="round">
              {SCRIBBLE_CLUSTERS.map((c, i) => <path key={i} d={c.d} strokeWidth={c.size} />)}
            </g>

            {/* ── Boundary wall — coiled/scalloped ring with a gate gap
                at the top, matching the sketch's looping wall line ── */}
            <path d={polylineToPathD(WALL_POINTS)} fill="none" stroke="#3d2814" strokeWidth="0.3"
              strokeOpacity="0.55" strokeDasharray="0.15 0.55" strokeLinecap="round" />
            <text x={GATE_POS.x} y={GATE_POS.y - 1.5} textAnchor="middle"
              style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.6px", fill: "#3d2814", opacity: 0.7 }}>
              ✦ Gate to Hogsmeade ✦
            </text>

            {/* ── Lake ── */}
            <path d={LAKE_PATH} fill="#7a8c8a" fillOpacity="0.28" stroke="#3d2814" strokeWidth="0.15" strokeOpacity="0.5" />
            <text x="46" y="58" textAnchor="middle" style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.8px", fill: "#3d2814", opacity: 0.55, fontStyle: "italic" }}>
              the lake
            </text>

            {/* ── Forbidden Forest dense tree mass ── */}
            {FOREST_TREES.map((t, i) => (
              <g key={i} transform={`translate(${t.x} ${t.y})`} opacity="0.4">
                <circle cx="0" cy={-t.r * 0.6} r={t.r} fill="none" stroke="#3d2814" strokeWidth="0.12" />
                <line x1="0" x2="0" y1={t.r * 0.1} y2={t.r * 0.7} stroke="#3d2814" strokeWidth="0.12" />
              </g>
            ))}
            <text x="90" y="62" textAnchor="middle" style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.6px", fill: "#3d2814", opacity: 0.55 }}>
              Forbidden Forest
            </text>

            {/* ── Hogsmeade railway leading off the bottom edge ── */}
            <g opacity="0.45">
              <line x1="40" x2="58" y1="98" y2="90" stroke="#3d2814" strokeWidth="0.18" />
              {Array.from({ length: 7 }, (_, i) => {
                const t = i / 6;
                const x = 40 + (58 - 40) * t, y = 98 + (90 - 98) * t;
                return <line key={i} x1={x - 1} x2={x + 1} y1={y + 0.6} y2={y - 0.6} stroke="#3d2814" strokeWidth="0.12" />;
              })}
            </g>

            <TitleBanner />

            {/* ── Zone labels + location icons ── */}
            {WANDER_PATHS.map(path => {
              const cx = path.points.reduce((s, p) => s + p.x, 0) / path.points.length;
              const cy = path.points.reduce((s, p) => s + p.y, 0) / path.points.length;
              return (
                <g key={path.zoneName}>
                  <LocationIcon kind={path.icon} x={path.iconPos.x} y={path.iconPos.y} />
                  <text x={cx} y={cy + 4.5} textAnchor="middle"
                    style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.5px", fill: "#3d2814", opacity: 0.55, letterSpacing: "0.02em" }}>
                    {path.zoneName}
                  </text>
                </g>
              );
            })}

            {/* ── CHARACTER UNITS — paired L/R footprints, plain rotating
                name text, no background box ── */}
            {characters.map(char => {
              const trail = trails[char.id] || [];
              const unit = units[char.id];
              const isMatched = matchedCharId === char.id;
              const dimmed = !!searchQuery && !isMatched;
              const FOOT_SEPARATION = 0.55;
              const footPath = "M 0 -0.55 C 0.28 -0.55 0.37 -0.34 0.35 -0.1 C 0.33 0.07 0.2 0.1 0.14 0.26 C 0.1 0.4 0.16 0.52 0.04 0.58 C -0.09 0.63 -0.25 0.58 -0.28 0.44 C -0.33 0.24 -0.25 0.1 -0.26 -0.08 C -0.28 -0.3 -0.16 -0.55 0 -0.55 Z";
              return (
                <g key={char.id} opacity={dimmed ? 0.2 : 1}>
                  {trail.map((t, i) => {
                    const ageFactor = 1 - i / trail.length;
                    const opacity = 0.6 * (1 - ageFactor * 0.85);
                    const perpAngle = (t.angle + 90) * Math.PI / 180;
                    const leftX = t.x + Math.cos(perpAngle) * FOOT_SEPARATION;
                    const leftY = t.y + Math.sin(perpAngle) * FOOT_SEPARATION;
                    const rightX = t.x - Math.cos(perpAngle) * FOOT_SEPARATION;
                    const rightY = t.y - Math.sin(perpAngle) * FOOT_SEPARATION;
                    return (
                      <g key={i} opacity={Math.max(opacity, 0.04)}>
                        <path d={footPath} fill="#8b2e1f" transform={`translate(${leftX} ${leftY}) rotate(${t.angle})`} />
                        <path d={footPath} fill="#8b2e1f" transform={`translate(${rightX} ${rightY}) rotate(${t.angle})`} />
                      </g>
                    );
                  })}

                  {unit && (() => {
                    const perpAngle = (unit.angle + 90) * Math.PI / 180;
                    const leftX = unit.x + Math.cos(perpAngle) * FOOT_SEPARATION;
                    const leftY = unit.y + Math.sin(perpAngle) * FOOT_SEPARATION;
                    const rightX = unit.x - Math.cos(perpAngle) * FOOT_SEPARATION;
                    const rightY = unit.y - Math.sin(perpAngle) * FOOT_SEPARATION;
                    const nameDist = 2.4;
                    const nameRad = unit.angle * Math.PI / 180;
                    const nameX = unit.x + Math.cos(nameRad) * nameDist;
                    const nameY = unit.y + Math.sin(nameRad) * nameDist;
                    return (
                      <g onClick={() => setSelected(char)} style={{ cursor: "pointer" }}>
                        <path d={footPath} fill="#8b2e1f" opacity="0.92" transform={`translate(${leftX} ${leftY}) rotate(${unit.angle})`} />
                        <path d={footPath} fill="#8b2e1f" opacity="0.92" transform={`translate(${rightX} ${rightY}) rotate(${unit.angle})`} />
                        <text x={nameX} y={nameY} textAnchor="middle" dominantBaseline="middle"
                          transform={`rotate(${unit.angle} ${nameX} ${nameY})`}
                          style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.7px", fill: isMatched ? "#a84a2f" : "#3d2814", letterSpacing: "0.02em" }}>
                          {char.name}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        </svg>

        {loadingChars && (
          <div style={{
            position: "absolute", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
            color: "#e9d6a8", fontFamily: "'IM Fell English', serif", fontSize: "0.85rem",
            background: "rgba(15,15,18,0.6)", padding: "0.3rem 0.8rem", borderRadius: "0.375rem",
          }}>consulting the map...</div>
        )}

        {selected && (
          <div onClick={() => setSelected(null)} style={{
            position: "absolute", inset: 0, zIndex: 20, display: "flex",
            alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#e9d6a8", border: "2px solid #3d2814", borderRadius: "0.5rem",
              padding: "1.25rem", maxWidth: "20rem", boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}>
              <p style={{ fontFamily: "'Pirata One', serif", fontSize: "1.1rem", color: "#3d2814", marginBottom: "0.4rem" }}>{selected.name}</p>
              <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.85rem", color: "#5c3a1e", marginBottom: "0.6rem" }}>📍 {selected.zone}</p>
              {selected.rumor && <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.8rem", color: "#3d2814", fontStyle: "italic", lineHeight: 1.5 }}>"{selected.rumor}"</p>}
              <button onClick={() => setSelected(null)} style={{ marginTop: "0.75rem", background: "#7a3b2e", color: "#e9d6a8", border: "none", borderRadius: "0.25rem", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.75rem" }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}