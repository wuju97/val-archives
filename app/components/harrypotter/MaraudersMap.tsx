"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { loadArchive } from "@/lib/archiveEngine";
import { geminiQualityCallFor, hasGeminiQualityKey3, hasGeminiQualityKey, hasGeminiQualityKey2 } from "@/lib/geminiEngine";

// ════════════════════════════════════════════════════════════════════════
// LOCATIONS — fixed anchor points (not loop shapes). Characters travel
// BETWEEN these along the drawn path network below, never freelancing
// off-path. Matches the user's sketch composition.
// ════════════════════════════════════════════════════════════════════════

type IconKind = "castle" | "hut" | "tree" | "hoops" | "shed" | "greenhouse" | "station" | "none";

interface LocationPoint {
  name: string;
  icon: IconKind;
  x: number; y: number;
  labelOffset?: { x: number; y: number };
}

const LOCATIONS: LocationPoint[] = [
  { name: "Hogwarts", icon: "castle", x: 48, y: 46, labelOffset: { x: 0, y: 5 } },
  { name: "Broom Shed", icon: "shed", x: 26, y: 44, labelOffset: { x: 0, y: 3.5 } },
  { name: "Quidditch Ground", icon: "hoops", x: 26, y: 20, labelOffset: { x: 0, y: -3.5 } },
  { name: "Hagrid's Hut", icon: "hut", x: 76, y: 16, labelOffset: { x: 0, y: 4 } },
  { name: "Whomping Willow", icon: "tree", x: 70, y: 34, labelOffset: { x: 0, y: 4.5 } },
  { name: "Greenhouses", icon: "greenhouse", x: 66, y: 50, labelOffset: { x: 0, y: 4.5 } },
  { name: "Hogsmeade Station", icon: "station", x: 64, y: 88, labelOffset: { x: 0, y: 4 } },
];

const LOCATION_BY_NAME: Record<string, LocationPoint> = LOCATIONS.reduce(
  (acc, l) => ({ ...acc, [l.name]: l }), {} as Record<string, LocationPoint>
);

interface PathLink { from: string; to: string; control?: { x: number; y: number } }

const PATH_LINKS: PathLink[] = [
  { from: "Hogwarts", to: "Broom Shed", control: { x: 32, y: 38 } },
  { from: "Broom Shed", to: "Quidditch Ground", control: { x: 22, y: 32 } },
  { from: "Hogwarts", to: "Whomping Willow", control: { x: 62, y: 36 } },
  { from: "Whomping Willow", to: "Hagrid's Hut", control: { x: 76, y: 24 } },
  { from: "Hogwarts", to: "Greenhouses", control: { x: 58, y: 50 } },
  { from: "Greenhouses", to: "Hogsmeade Station", control: { x: 68, y: 70 } },
  { from: "Hogwarts", to: "Hogsmeade Station", control: { x: 50, y: 70 } },
];

function quadraticPoint(p0: { x: number; y: number }, ctrl: { x: number; y: number }, p1: { x: number; y: number }, t: number) {
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ctrl.x + t * t * p1.x;
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * ctrl.y + t * t * p1.y;
  return { x, y };
}

function buildCurvedRoute(link: PathLink): Array<{ x: number; y: number }> {
  const from = LOCATION_BY_NAME[link.from];
  const to = LOCATION_BY_NAME[link.to];
  const ctrl = link.control ?? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const SAMPLES = 40;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= SAMPLES; i++) {
    pts.push(quadraticPoint(from, ctrl, to, i / SAMPLES));
  }
  return pts;
}

const ROUTES: Array<{ from: string; to: string; points: Array<{ x: number; y: number }> }> =
  PATH_LINKS.map(link => ({ from: link.from, to: link.to, points: buildCurvedRoute(link) }));

const ROUTE_BY_PAIR: Record<string, Array<{ x: number; y: number }>> = {};
for (const r of ROUTES) {
  ROUTE_BY_PAIR[`${r.from}::${r.to}`] = r.points;
  ROUTE_BY_PAIR[`${r.to}::${r.from}`] = [...r.points].reverse();
}
const ADJACENCY: Record<string, string[]> = {};
for (const r of ROUTES) {
  (ADJACENCY[r.from] ||= []).push(r.to);
  (ADJACENCY[r.to] ||= []).push(r.from);
}
const LOCATION_NAMES = Object.keys(ADJACENCY);

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
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

// ════════════════════════════════════════════════════════════════════════
// TERRAIN
// ════════════════════════════════════════════════════════════════════════

const WALL_POINTS: Array<{ x: number; y: number }> = [
  { x: 52, y: 4 }, { x: 30, y: 6 }, { x: 14, y: 14 }, { x: 6, y: 30 }, { x: 5, y: 50 },
  { x: 8, y: 70 }, { x: 18, y: 84 }, { x: 36, y: 92 }, { x: 56, y: 92 }, { x: 72, y: 84 },
  { x: 78, y: 68 }, { x: 78, y: 48 }, { x: 76, y: 28 }, { x: 68, y: 10 }, { x: 52, y: 4 },
];
const GATE_POS = { x: 52, y: 4 };
const LAKE_PATH = "M 30 60 Q 22 56 24 48 Q 28 42 38 44 Q 46 40 54 44 Q 62 42 66 50 Q 70 58 62 64 Q 56 70 46 68 Q 36 70 30 60 Z";

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

function LocationIcon({ kind, x, y }: { kind: IconKind; x: number; y: number }) {
  const stroke = "#3d2814";
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

interface MapCharacter { id: string; name: string; location: string; rumor: string }

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

AVAILABLE LOCATIONS: ${LOCATION_NAMES.join(", ")}

Pick EXACTLY 2 characters who would plausibly be active right now (prefer named vault characters — including any player character if present — otherwise generic Hogwarts staff/students). For each, assign:
- "name": their name
- "location": one location from the AVAILABLE LOCATIONS list where they'd plausibly be right now
- "rumor": a short (max 12 words) in-character one-liner about what they're doing right now, written like an amusing rumor

Output ONLY a valid JSON array with EXACTLY 2 entries, no markdown fences, no preamble:
[{"name": "...", "location": "...", "rumor": "..."}]`;
}

async function fetchMaraudersPopulation(): Promise<MapCharacter[]> {
  try {
    const hasAnyKey = hasGeminiQualityKey3() || hasGeminiQualityKey() || hasGeminiQualityKey2();
    if (!hasAnyKey) throw new Error("no key");
    const archive = loadArchive();
    const allEntries = [...(archive.entries || []), ...(archive.playerEntries || [])];
    const characterNames = Array.from(new Set(
      allEntries.filter(e => e.category === "characters" || e.category === "player-character")
        .map(e => (e as any).entity).filter(Boolean)
    )) as string[];
    const contextText = allEntries.slice(-30).map(e => e.text).join(" / ");
    const prompt = buildMaraudersPrompt(characterNames, contextText);
    const raw = await geminiQualityCallFor("general", prompt);
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    const parsed: Array<{ name: string; location: string; rumor: string }> = match ? JSON.parse(match[0]) : JSON.parse(cleaned);
    const valid = parsed.filter(p => p.name && LOCATION_NAMES.includes(p.location));
    return valid.slice(0, 2).map((p, i) => ({ id: `ai-${i}-${Date.now()}`, name: p.name, location: p.location, rumor: p.rumor || "" }));
  } catch {
    const names = [...GENERIC_WALKER_NAMES].sort(() => Math.random() - 0.5).slice(0, 2);
    const shuffledLocs = [...LOCATION_NAMES].sort(() => Math.random() - 0.5);
    return names.map((name, i) => ({
      id: `fallback-${i}-${Date.now()}`, name,
      location: shuffledLocs[i % shuffledLocs.length], rumor: "",
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
  const [trails, setTrails] = useState<Record<string, Array<{ x: number; y: number; angle: number; side: 1 | -1; stepIndex: number; widthVariation: number; rotationVariation: number }>>>({});
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
      const loc = LOCATION_BY_NAME[c.location];
      if (loc) initialUnits[c.id] = { x: loc.x, y: loc.y, angle: 0 };
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
      let currentLocation = char.location;
      let stepSide: 1 | -1 = 1;
      let stepIndex = 0;

      function dropTrailPoint(x: number, y: number, angle: number) {
        const side = stepSide;
        stepSide = stepSide === 1 ? -1 : 1;
        stepIndex++;
        
        const widthVariation = (Math.random() - 0.5) * 0.03; 
        const rotationVariation = (Math.random() - 0.5) * 4; 
        setTrails(prev => {
          const existing = prev[char.id] || [];
          const next = [...existing, { x, y, angle, side, stepIndex, widthVariation, rotationVariation }];
          return { ...prev, [char.id]: next.slice(-14) };
        });
      }

      function walkTo(nextLocation: string, onDone: () => void) {
        const route = ROUTE_BY_PAIR[`${currentLocation}::${nextLocation}`];
        if (!route) { onDone(); return; }
        const totalLen = polylineLength(route);
        const durationMs = Math.max(totalLen * 1300, 18000); 
        const SPEED_PER_MS = totalLen / durationMs;
        
        // CALIBRATION: The perfect human stride spacing on this map coordinate grid
        const TRAIL_SPACING = 0.52; 

        let lastTrailDist = 0;
        let startTime: number | null = null;

        function tick(now: number) {
          if (startTime === null) startTime = now;
          const elapsed = now - startTime;
          const traveled = Math.min(elapsed * SPEED_PER_MS, totalLen);
          const { x, y, angle } = pointAtDistance(route, traveled);

          setUnits(prev => ({ ...prev, [char.id]: { x, y, angle } }));

          if (traveled - lastTrailDist >= TRAIL_SPACING || traveled >= totalLen) {
            dropTrailPoint(x, y, angle);
            lastTrailDist = traveled;
          }

          if (traveled >= totalLen) {
            currentLocation = nextLocation;
            onDone();
            return;
          }
          const rafId = requestAnimationFrame(tick);
          rafIds.push(rafId);
        }
        const rafId = requestAnimationFrame(tick);
        rafIds.push(rafId);
      }

      function scheduleNextMove() {
        const lingering = Math.random() < 0.5;
        const delay = lingering ? 6000 + Math.random() * 8000 : 1500 + Math.random() * 1500;
        const t = setTimeout(() => {
          const connections = ADJACENCY[currentLocation] || [];
          if (connections.length === 0) { scheduleNextMove(); return; }
          const next = connections[Math.floor(Math.random() * connections.length)];
          walkTo(next, scheduleNextMove);
        }, delay);
        timersRef.current.push(t);
      }
      scheduleNextMove();
    });

    return () => { clearAllTimers(); rafIds.forEach(id => cancelAnimationFrame(id)); };
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

            <path d={polylineToPathD(WALL_POINTS) + " Z"} fill="none" stroke="#3d2814" strokeWidth="0.3"
              strokeOpacity="0.55" strokeDasharray="0.15 0.55" strokeLinecap="round" />
            <text x={GATE_POS.x} y={GATE_POS.y - 1.5} textAnchor="middle"
              style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.6px", fill: "#3d2814", opacity: 0.7 }}>
              ✦ Gate to Hogsmeade ✦
            </text>

            <path d={LAKE_PATH} fill="#7a8c8a" fillOpacity="0.28" stroke="#3d2814" strokeWidth="0.15" strokeOpacity="0.5" />
            <text x="46" y="58" textAnchor="middle" style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.8px", fill: "#3d2814", opacity: 0.55, fontStyle: "italic" }}>
              the lake
            </text>

            {FOREST_TREES.map((t, i) => (
              <g key={i} transform={`translate(${t.x} ${t.y})`} opacity="0.4">
                <circle cx="0" cy={-t.r * 0.6} r={t.r} fill="none" stroke="#3d2814" strokeWidth="0.12" />
                <line x1="0" x2="0" y1={t.r * 0.1} y2={t.r * 0.7} stroke="#3d2814" strokeWidth="0.12" />
              </g>
            ))}
            <text x="90" y="62" textAnchor="middle" style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.6px", fill: "#3d2814", opacity: 0.55 }}>
              Forbidden Forest
            </text>

            <g opacity="0.45">
              <line x1="40" x2="58" y1="98" y2="90" stroke="#3d2814" strokeWidth="0.18" />
              {Array.from({ length: 7 }, (_, i) => {
                const t = i / 6;
                const x = 40 + (58 - 40) * t, y = 98 + (90 - 98) * t;
                return <line key={i} x1={x - 1} x2={x + 1} y1={y + 0.6} y2={y - 0.6} stroke="#3d2814" strokeWidth="0.12" />;
              })}
            </g>

            {/* Hidden behind footprints to keep layout clear */}
            {ROUTES.map((r, i) => (
              <path key={i} d={polylineToPathD(r.points)} fill="none"
                stroke="#5c3a1e" strokeWidth="0.14" strokeOpacity="0.15" strokeDasharray="0.4 0.5" strokeLinecap="round" />
            ))}

            <TitleBanner />

            {LOCATIONS.map(loc => (
              <g key={loc.name}>
                <LocationIcon kind={loc.icon} x={loc.x} y={loc.y} />
                <text x={loc.x + (loc.labelOffset?.x ?? 0)} y={loc.y + (loc.labelOffset?.y ?? 4.5)} textAnchor="middle"
                  style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.5px", fill: "#3d2814", opacity: 0.55, letterSpacing: "0.02em" }}>
                  {loc.name}
                </text>
              </g>
            ))}

            {/* ════════════════════════════════════════════════════════════════════════
                PERFECT MOVIE-ACCURATE MARAUDER FOOTSTEPS - THE ULTIMATE CALIBRATION
                ════════════════════════════════════════════════════════════════════════ */}
            {characters.map(char => {
              const trail = trails[char.id] || [];
              const unit = units[char.id];
              const isMatched = matchedCharId === char.id;
              const dimmed = !!searchQuery && !isMatched;

              // Distinct left/right asymmetric high-fidelity boot prints
              const leftSolePath = "M -0.05,-0.32 C 0.03,-0.34 0.12,-0.26 0.14,-0.14 C 0.15,-0.03 0.11,0.06 0.03,0.14 L -0.08,0.12 C -0.11,0.08 -0.10,0.00 -0.09,-0.11 C -0.10,-0.22 -0.12,-0.29 -0.05,-0.32 Z";
              const leftHeelPath = "M 0.05,0.21 C 0.09,0.24 0.06,0.32 -0.01,0.32 L -0.09,0.30 C -0.11,0.26 -0.10,0.21 -0.05,0.20 Z";

              const rightSolePath = "M 0.05,-0.32 C -0.03,-0.34 -0.12,-0.26 -0.14,-0.14 C -0.15,-0.03 -0.11,0.06 -0.03,0.14 L 0.08,0.12 C 0.11,0.08 0.10,0.00 0.09,-0.11 C 0.10,-0.22 0.12,-0.29 0.05,-0.32 Z";
              const rightHeelPath = "M -0.05,0.21 C -0.09,0.24 -0.06,0.32 0.01,0.32 L 0.09,0.30 C 0.11,0.26 0.10,0.21 0.05,0.20 Z";

              return (
                <g key={char.id} opacity={dimmed ? 0.2 : 1}>
                  {trail.map((t, i) => {
                    const ageFactor = 1 - i / trail.length;
                    const opacity = Math.max(0.85 * (1 - ageFactor * 0.75), 0.08);
                    
                    const perpRad = (t.angle + 90) * Math.PI / 180;

                    // Perfect Stance Calibration: tight, natural track footprint profile
                    const stanceSeparation = 0.12 + t.widthVariation;
                    
                    // Inverted tracking assignment logic matches movement directions perfectly
                    const fx = t.x + Math.cos(perpRad) * stanceSeparation * t.side;
                    const fy = t.y + Math.sin(perpRad) * stanceSeparation * t.side;

                    const toeOutAngle = t.side === 1 ? 5 : -5;
                    const footRotation = t.angle + 90 + toeOutAngle + t.rotationVariation;

                    return (
                      <g 
                        key={i} 
                        opacity={opacity} 
                        transform={`translate(${fx} ${fy}) rotate(${footRotation}) scale(1.15)`}
                      >
                        <path d={t.side === 1 ? leftSolePath : rightSolePath} fill="#4a2e1b" />
                        <path d={t.side === 1 ? leftHeelPath : rightHeelPath} fill="#4a2e1b" />
                      </g>
                    );
                  })}

                  {unit && (() => {
                    const nameDist = 3.0;
                    const nameRad = unit.angle * Math.PI / 180;
                    const nameX = unit.x + Math.cos(nameRad) * nameDist;
                    const nameY = unit.y + Math.sin(nameRad) * nameDist;
                    return (
                      <text x={nameX} y={nameY} textAnchor="middle" dominantBaseline="middle"
                        onClick={() => setSelected(char)} style={{ cursor: "pointer" }}
                        className="va-hogwarts-glow"
                      >
                        <tspan style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.7px", fill: isMatched ? "#a84a2f" : "#2f1b10", letterSpacing: "0.02em" }}>
                          {char.name}
                        </tspan>
                      </text>
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
              <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.85rem", color: "#5c3a1e", marginBottom: "0.6rem" }}>📍 {selected.location}</p>
              {selected.rumor && <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.8rem", color: "#3d2814", fontStyle: "italic", lineHeight: 1.5 }}>"{selected.rumor}"</p>}
              <button onClick={() => setSelected(null)} style={{ marginTop: "0.75rem", background: "#7a3b2e", color: "#e9d6a8", border: "none", borderRadius: "0.25rem", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.75rem" }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}