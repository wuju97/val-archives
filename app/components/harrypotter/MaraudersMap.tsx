"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { loadArchive } from "@/lib/archiveEngine";
import { geminiQualityCallFor, hasGeminiQualityKey3, hasGeminiQualityKey, hasGeminiQualityKey2 } from "@/lib/geminiEngine";

// ════════════════════════════════════════════════════════════════════════
// FLOORS — vertical Hogwarts structure. Each room belongs to one floor;
// switching floors swaps which rooms/corridors render. Corridors that
// cross floors are drawn as "moving staircase" markers on both floors.
// ════════════════════════════════════════════════════════════════════════

type FloorId = "towers" | "main" | "dungeons";
const FLOORS: Array<{ id: FloorId; label: string }> = [
  { id: "towers", label: "Towers" },
  { id: "main", label: "Main Floor" },
  { id: "dungeons", label: "Dungeons & Grounds" },
];

interface RoomPoint {
  name: string;
  x: number; y: number; // anchor point, 0-100
  labelAngle?: number;
  floor: FloorId;
  flourish?: "underline" | "brackets" | "tower" | "none";
}

const ROOMS: RoomPoint[] = [
  { name: "Gryffindor Tower", x: 14, y: 14, labelAngle: -6, floor: "towers", flourish: "tower" },
  { name: "Ravenclaw Tower", x: 86, y: 14, labelAngle: 5, floor: "towers", flourish: "tower" },
  { name: "Astronomy Tower", x: 50, y: 10, labelAngle: 0, floor: "towers", flourish: "tower" },
  { name: "Owlery", x: 50, y: 30, labelAngle: 3, floor: "towers", flourish: "brackets" },

  { name: "Great Hall", x: 50, y: 16, labelAngle: 0, floor: "main", flourish: "underline" },
  { name: "Entrance Hall", x: 50, y: 36, labelAngle: 0, floor: "main", flourish: "underline" },
  { name: "Library", x: 20, y: 38, labelAngle: -4, floor: "main", flourish: "brackets" },
  { name: "Great Staircase", x: 50, y: 56, labelAngle: 0, floor: "main", flourish: "brackets" },
  { name: "Forbidden Corridor", x: 78, y: 56, labelAngle: 3, floor: "main", flourish: "underline" },
  { name: "Charms Corridor", x: 78, y: 36, labelAngle: 4, floor: "main", flourish: "none" },
  { name: "Trophy Room", x: 22, y: 62, labelAngle: -3, floor: "main", flourish: "brackets" },

  { name: "Potions Classroom", x: 18, y: 16, labelAngle: -8, floor: "dungeons", flourish: "underline" },
  { name: "Slytherin Dungeon", x: 18, y: 40, labelAngle: -5, floor: "dungeons", flourish: "brackets" },
  { name: "Chamber Entrance", x: 50, y: 30, labelAngle: 0, floor: "dungeons", flourish: "none" },
  { name: "Hufflepuff Basement", x: 82, y: 16, labelAngle: 5, floor: "dungeons", flourish: "brackets" },
  { name: "Hagrid's Hut", x: 20, y: 80, labelAngle: -3, floor: "dungeons", flourish: "none" },
  { name: "Quidditch Pitch", x: 80, y: 80, labelAngle: 3, floor: "dungeons", flourish: "none" },
  { name: "Greenhouses", x: 50, y: 84, labelAngle: 0, floor: "dungeons", flourish: "none" },
];

const ROOM_BY_NAME: Record<string, RoomPoint> = ROOMS.reduce(
  (acc, r) => ({ ...acc, [r.name]: r }), {} as Record<string, RoomPoint>
);

interface Corridor {
  from: string; to: string;
  points: Array<{ x: number; y: number }>;
  kind: "hallway" | "stairs" | "floor-change";
}

// Denser branching network per floor, plus a few "floor-change" stair links
// that the floor switcher highlights as moving staircases.
const CORRIDORS: Corridor[] = [
  // Towers floor
  { from: "Gryffindor Tower", to: "Astronomy Tower", points: [{ x: 14, y: 14 }, { x: 30, y: 10 }, { x: 50, y: 10 }], kind: "hallway" },
  { from: "Ravenclaw Tower", to: "Astronomy Tower", points: [{ x: 86, y: 14 }, { x: 70, y: 10 }, { x: 50, y: 10 }], kind: "hallway" },
  { from: "Astronomy Tower", to: "Owlery", points: [{ x: 50, y: 10 }, { x: 50, y: 30 }], kind: "hallway" },
  { from: "Gryffindor Tower", to: "Owlery", points: [{ x: 14, y: 14 }, { x: 14, y: 30 }, { x: 50, y: 30 }], kind: "hallway" },
  { from: "Ravenclaw Tower", to: "Owlery", points: [{ x: 86, y: 14 }, { x: 86, y: 30 }, { x: 50, y: 30 }], kind: "hallway" },

  // Main floor — denser branching, includes a couple of crossing junctions
  { from: "Great Hall", to: "Entrance Hall", points: [{ x: 50, y: 16 }, { x: 50, y: 36 }], kind: "hallway" },
  { from: "Entrance Hall", to: "Library", points: [{ x: 50, y: 36 }, { x: 35, y: 36 }, { x: 20, y: 38 }], kind: "hallway" },
  { from: "Entrance Hall", to: "Charms Corridor", points: [{ x: 50, y: 36 }, { x: 65, y: 36 }, { x: 78, y: 36 }], kind: "hallway" },
  { from: "Entrance Hall", to: "Great Staircase", points: [{ x: 50, y: 36 }, { x: 50, y: 56 }], kind: "stairs" },
  { from: "Great Staircase", to: "Trophy Room", points: [{ x: 50, y: 56 }, { x: 36, y: 60 }, { x: 22, y: 62 }], kind: "hallway" },
  { from: "Great Staircase", to: "Forbidden Corridor", points: [{ x: 50, y: 56 }, { x: 64, y: 56 }, { x: 78, y: 56 }], kind: "hallway" },
  { from: "Charms Corridor", to: "Forbidden Corridor", points: [{ x: 78, y: 36 }, { x: 78, y: 56 }], kind: "hallway" },
  { from: "Library", to: "Trophy Room", points: [{ x: 20, y: 38 }, { x: 21, y: 50 }, { x: 22, y: 62 }], kind: "hallway" },

  // Dungeons floor
  { from: "Potions Classroom", to: "Slytherin Dungeon", points: [{ x: 18, y: 16 }, { x: 18, y: 40 }], kind: "hallway" },
  { from: "Potions Classroom", to: "Chamber Entrance", points: [{ x: 18, y: 16 }, { x: 35, y: 24 }, { x: 50, y: 30 }], kind: "hallway" },
  { from: "Hufflepuff Basement", to: "Chamber Entrance", points: [{ x: 82, y: 16 }, { x: 65, y: 24 }, { x: 50, y: 30 }], kind: "hallway" },
  { from: "Slytherin Dungeon", to: "Hagrid's Hut", points: [{ x: 18, y: 40 }, { x: 19, y: 60 }, { x: 20, y: 80 }], kind: "hallway" },
  { from: "Chamber Entrance", to: "Greenhouses", points: [{ x: 50, y: 30 }, { x: 50, y: 60 }, { x: 50, y: 84 }], kind: "hallway" },
  { from: "Hufflepuff Basement", to: "Quidditch Pitch", points: [{ x: 82, y: 16 }, { x: 81, y: 50 }, { x: 80, y: 80 }], kind: "hallway" },
  { from: "Hagrid's Hut", to: "Greenhouses", points: [{ x: 20, y: 80 }, { x: 35, y: 82 }, { x: 50, y: 84 }], kind: "hallway" },
  { from: "Greenhouses", to: "Quidditch Pitch", points: [{ x: 50, y: 84 }, { x: 65, y: 82 }, { x: 80, y: 80 }], kind: "hallway" },

  // Cross-floor moving staircases
  { from: "Great Staircase", to: "Owlery", points: [{ x: 50, y: 56 }, { x: 50, y: 30 }], kind: "floor-change" },
  { from: "Entrance Hall", to: "Chamber Entrance", points: [{ x: 50, y: 36 }, { x: 50, y: 30 }], kind: "floor-change" },
];

const CORRIDOR_BY_PAIR: Record<string, Corridor> = {};
for (const c of CORRIDORS) {
  CORRIDOR_BY_PAIR[`${c.from}::${c.to}`] = c;
  CORRIDOR_BY_PAIR[`${c.to}::${c.from}`] = { ...c, points: [...c.points].reverse() };
}
const ADJACENCY: Record<string, string[]> = {};
for (const c of CORRIDORS) {
  (ADJACENCY[c.from] ||= []).push(c.to);
  (ADJACENCY[c.to] ||= []).push(c.from);
}
const ROOM_NAMES = Object.keys(ADJACENCY);
const FLOOR_OF_ROOM: Record<string, FloorId> = {};
for (const r of ROOMS) FLOOR_OF_ROOM[r.name] = r.floor;

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
function offsetPolyline(points: Array<{ x: number; y: number }>, offset: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1];
    let nx = 0, ny = 0;
    if (prev && next) {
      const d1x = curr.x - prev.x, d1y = curr.y - prev.y;
      const d2x = next.x - curr.x, d2y = next.y - curr.y;
      const n1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
      const n2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1;
      nx = (-d1y / n1 + -d2y / n2) / 2; ny = (d1x / n1 + d2x / n2) / 2;
    } else if (next) {
      const dx = next.x - curr.x, dy = next.y - curr.y;
      const n = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / n; ny = dx / n;
    } else if (prev) {
      const dx = curr.x - prev.x, dy = curr.y - prev.y;
      const n = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / n; ny = dx / n;
    }
    const mag = Math.sqrt(nx * nx + ny * ny) || 1;
    out.push({ x: curr.x + (nx / mag) * offset, y: curr.y + (ny / mag) * offset });
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════
// DECORATIVE CARTOGRAPHIC CLUTTER — fake dead-end corridor fragments,
// tiny compass rose, scattered annotation flourishes. Pure decoration,
// not part of the navigable graph — fills empty parchment with the kind
// of "fake annotations and map symbols" the real prop is dense with.
// ════════════════════════════════════════════════════════════════════════

interface DecoFragment { d: string }
function buildDecorFragments(floor: FloorId): DecoFragment[] {
  let seed = floor === "towers" ? 11 : floor === "main" ? 23 : 41;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  const frags: DecoFragment[] = [];
  for (let i = 0; i < 9; i++) {
    const x0 = 4 + rand() * 92, y0 = 4 + rand() * 92;
    const segs = 2 + Math.floor(rand() * 3);
    let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;
    let cx = x0, cy = y0;
    for (let s = 0; s < segs; s++) {
      const ang = rand() * Math.PI * 2;
      const len = 2 + rand() * 4;
      cx += Math.cos(ang) * len;
      cy += Math.sin(ang) * len;
      d += ` L ${cx.toFixed(1)} ${cy.toFixed(1)}`;
    }
    frags.push({ d });
  }
  return frags;
}

function CompassRose({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`} opacity="0.5">
      <circle r="3.2" fill="none" stroke="#3d2814" strokeWidth="0.1" />
      <path d="M 0 -3.2 L 0.5 -0.5 L 0 0 L -0.5 -0.5 Z" fill="#3d2814" />
      <path d="M 0 3.2 L 0.5 0.5 L 0 0 L -0.5 0.5 Z" fill="#3d2814" opacity="0.6" />
      <path d="M -3.2 0 L -0.5 0.5 L 0 0 L -0.5 -0.5 Z" fill="#3d2814" opacity="0.6" />
      <path d="M 3.2 0 L 0.5 0.5 L 0 0 L 0.5 -0.5 Z" fill="#3d2814" opacity="0.6" />
      <text x="0" y="-4" textAnchor="middle" style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.6px", fill: "#3d2814" }}>N</text>
    </g>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SCRIBBLE TEXTURE — zoned, dense
// ════════════════════════════════════════════════════════════════════════

interface ScribbleZone { x0: number; y0: number; x1: number; y1: number; angle: number }
function getScribbleZonesForFloor(): ScribbleZone[] {
  return [
    { x0: 0, y0: 0, x1: 100, y1: 6, angle: 5 },
    { x0: 0, y0: 94, x1: 100, y1: 100, angle: -5 },
    { x0: 0, y0: 0, x1: 6, y1: 100, angle: 80 },
    { x0: 94, y0: 0, x1: 100, y1: 100, angle: -80 },
    { x0: 60, y0: 0, x1: 100, y1: 30, angle: -20 },
    { x0: 0, y0: 60, x1: 35, y1: 100, angle: 20 },
    { x0: 65, y0: 65, x1: 100, y1: 100, angle: -12 },
  ];
}
function buildScribbleClusters(zones: ScribbleZone[], seedBase: number): Array<{ d: string; size: number }> {
  const clusters: Array<{ d: string; size: number }> = [];
  let seed = seedBase;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (const zone of zones) {
    const w = zone.x1 - zone.x0, h = zone.y1 - zone.y0;
    const area = Math.max(w * h, 1);
    const clusterCount = Math.max(4, Math.floor(area * 0.45));
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
      clusters.push({ d, size: 0.08 + rand() * 0.05 });
    }
  }
  return clusters;
}

// ════════════════════════════════════════════════════════════════════════
// AI POPULATION (unchanged logic, same as before)
// ════════════════════════════════════════════════════════════════════════

interface MapCharacter { id: string; name: string; room: string; rumor: string }
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

AVAILABLE ROOMS: ${ROOM_NAMES.join(", ")}

Pick 3-6 characters who would plausibly be active right now (prefer named vault characters; you may include 1-2 generic Hogwarts staff/students if it makes sense). For each, assign:
- "name": their name
- "room": one room from the AVAILABLE ROOMS list where they'd plausibly be
- "rumor": a short (max 12 words) in-character one-liner about what they're doing right now, written like an amusing rumor

Output ONLY a valid JSON array, no markdown fences, no preamble:
[{"name": "...", "room": "...", "rumor": "..."}]`;
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
    const parsed: Array<{ name: string; room: string; rumor: string }> = match ? JSON.parse(match[0]) : JSON.parse(cleaned);
    return parsed
      .filter(p => p.name && ROOM_NAMES.includes(p.room))
      .map((p, i) => ({ id: `ai-${i}-${Date.now()}`, name: p.name, room: p.room, rumor: p.rumor || "" }));
  } catch {
    const count = 3 + Math.floor(Math.random() * 3);
    const names = [...GENERIC_WALKER_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
    return names.map((name, i) => ({
      id: `fallback-${i}-${Date.now()}`, name,
      room: ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)], rumor: "",
    }));
  }
}

// ════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════

type MapPhase = "closed" | "opening" | "open" | "closing";

export default function MaraudersMap() {
  const [phase, setPhase] = useState<MapPhase>("closed");
  const [loadingChars, setLoadingChars] = useState(false);
  const [characters, setCharacters] = useState<MapCharacter[]>([]);
  const [footprints, setFootprints] = useState<Array<{ id: number; x: number; y: number; angle: number; bornAt: number; ownerId: string; floor: FloorId }>>([]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; floor: FloorId }>>({});
  const [selected, setSelected] = useState<MapCharacter | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeFloor, setActiveFloor] = useState<FloorId>("main");
  const timersRef = useRef<Array<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>>>([]);
  const printIdRef = useRef(0);

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
    const initialPositions: Record<string, { x: number; y: number; floor: FloorId }> = {};
    chars.forEach(c => {
      const room = ROOM_BY_NAME[c.room];
      if (room) initialPositions[c.id] = { x: room.x, y: room.y, floor: room.floor };
    });
    setPositions(initialPositions);
    if (chars.length > 0 && initialPositions[chars[0].id]) {
      setActiveFloor(initialPositions[chars[0].id].floor);
    }
    setLoadingChars(false);
    setTimeout(() => setPhase("open"), 700);
  }, [phase]);

  const closeMap = useCallback(() => {
    setPhase("closing");
    clearAllTimers();
    setTimeout(() => {
      setPhase("closed");
      setCharacters([]); setFootprints([]); setPositions({}); setSelected(null);
      setSearchQuery(""); setZoom(1); setPan({ x: 0, y: 0 }); setActiveFloor("main");
    }, 500);
  }, [clearAllTimers]);

  // ── Movement constrained to corridor paths, names ride with the walker ──
  useEffect(() => {
    if (phase !== "open" || characters.length === 0) return;

    characters.forEach(char => {
      let currentRoom = char.room;

      function dropPrint(x: number, y: number, angle: number, floor: FloorId) {
        const id = ++printIdRef.current;
        setFootprints(prev => [...prev, { id, x, y, angle, bornAt: Date.now(), ownerId: char.id, floor }]);
        const cleanup = setTimeout(() => setFootprints(prev => prev.filter(p => p.id !== id)), 2600);
        timersRef.current.push(cleanup);
      }

      function walkToRoom(nextRoomName: string, onDone: () => void) {
        const corridor = CORRIDOR_BY_PAIR[`${currentRoom}::${nextRoomName}`];
        if (!corridor) { onDone(); return; }
        const totalLen = polylineLength(corridor.points);
        const STEP_DIST = totalLen / 7;
        let traveled = 0;
        const nextFloor = FLOOR_OF_ROOM[nextRoomName] ?? FLOOR_OF_ROOM[currentRoom];
        const stepInterval = setInterval(() => {
          traveled += STEP_DIST;
          const { x, y, angle } = pointAtDistance(corridor.points, Math.min(traveled, totalLen));
          // While traversing, treat the walker as still on its origin floor
          // until it actually arrives — floor-change corridors visually
          // "teleport" between floor views since they represent a staircase.
          dropPrint(x, y, angle, nextFloor);
          setPositions(prev => ({ ...prev, [char.id]: { x, y, floor: nextFloor } }));
          if (traveled >= totalLen) {
            clearInterval(stepInterval);
            currentRoom = nextRoomName;
            onDone();
          }
        }, 230);
        timersRef.current.push(stepInterval);
      }

      function scheduleNextMove() {
        const lingering = Math.random() < 0.4;
        const delay = lingering ? 2500 + Math.random() * 3000 : 600 + Math.random() * 600;
        const t = setTimeout(() => {
          const connections = ADJACENCY[currentRoom] || [];
          if (connections.length === 0) { scheduleNextMove(); return; }
          const next = connections[Math.floor(Math.random() * connections.length)];
          walkToRoom(next, scheduleNextMove);
        }, delay);
        timersRef.current.push(t);
      }
      scheduleNextMove();
    });

    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, characters]);

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (phase !== "open") return;
    const id = setInterval(() => forceTick(n => n + 1), 80);
    return () => clearInterval(id);
  }, [phase]);

  const svgRef = useRef<SVGSVGElement>(null);
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

  // Auto-switch floor view when the search-matched character is elsewhere
  useEffect(() => {
    if (matchedCharId && positions[matchedCharId]) {
      setActiveFloor(positions[matchedCharId].floor);
    }
  }, [matchedCharId, positions]);

  const visibleRooms = ROOMS.filter(r => r.floor === activeFloor);
  const visibleCorridors = CORRIDORS.filter(c => FLOOR_OF_ROOM[c.from] === activeFloor && FLOOR_OF_ROOM[c.to] === activeFloor);
  const scribbleClusters = useMemo(
    () => buildScribbleClusters(getScribbleZonesForFloor(), activeFloor === "towers" ? 11 : activeFloor === "main" ? 23 : 41),
    [activeFloor]
  );
  const decorFragments = useMemo(() => buildDecorFragments(activeFloor), [activeFloor]);

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
        {/* Top control bar */}
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

        {/* Floor switcher tabs */}
        <div style={{
          position: "absolute", top: "2.7rem", left: 0, right: 0, zIndex: 10,
          display: "flex", justifyContent: "center", gap: "0.4rem", padding: "0.4rem",
        }}>
          {FLOORS.map(f => (
            <button key={f.id} onClick={() => setActiveFloor(f.id)} style={{
              background: activeFloor === f.id ? "#7a3b2e" : "rgba(122,59,46,0.35)",
              color: "#e9d6a8", border: "1px solid #3d2814", borderRadius: "0.3rem",
              padding: "0.25rem 0.7rem", cursor: "pointer",
              fontFamily: "'IM Fell English', serif", fontSize: "0.75rem",
            }}>
              {f.label}
            </button>
          ))}
        </div>

        <svg
          ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
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
            <circle cx="12" cy="20" r="9" fill="url(#va-ink-stain)" />
            <circle cx="88" cy="30" r="7" fill="url(#va-ink-stain)" />
            <circle cx="30" cy="85" r="10" fill="url(#va-ink-stain)" />
            <circle cx="70" cy="8" r="6" fill="url(#va-ink-stain)" />
            <circle cx="95" cy="90" r="8" fill="url(#va-ink-stain)" />

            <g stroke="#5c3a1e" strokeOpacity="0.28" fill="none" strokeLinecap="round">
              {scribbleClusters.map((c, i) => <path key={i} d={c.d} strokeWidth={c.size} />)}
            </g>

            {/* Decorative dead-end fragments — pure ink clutter, not navigable */}
            <g stroke="#3d2814" strokeOpacity="0.2" strokeWidth="0.18" fill="none">
              {decorFragments.map((f, i) => <path key={i} d={f.d} />)}
            </g>

            <CompassRose cx={92} cy={92} />

            {/* Corridors — wall-lined hallways with branching junctions */}
            {visibleCorridors.map((c, i) => {
              const wallA = offsetPolyline(c.points, 1.0);
              const wallB = offsetPolyline(c.points, -1.0);
              return (
                <g key={i}>
                  <path d={polylineToPathD(wallA)} fill="none" stroke="#3d2814" strokeWidth="0.2" strokeOpacity="0.6" strokeLinejoin="round" />
                  <path d={polylineToPathD(wallB)} fill="none" stroke="#3d2814" strokeWidth="0.2" strokeOpacity="0.6" strokeLinejoin="round" />
                  {c.kind === "stairs" ? (
                    <path d={polylineToPathD(c.points)} fill="none" stroke="#3d2814" strokeWidth="0.15" strokeOpacity="0.45" strokeDasharray="0.5 0.45" />
                  ) : (
                    <path d={polylineToPathD(c.points)} fill="none" stroke="#5c3a1e" strokeWidth="0.05" strokeOpacity="0.2" />
                  )}
                  {/* junction tick marks where the corridor bends — gives the
                      "crossing hallway" feel rather than a clean single line */}
                  {c.points.slice(1, -1).map((pt, pi) => (
                    <circle key={pi} cx={pt.x} cy={pt.y} r="0.25" fill="#3d2814" fillOpacity="0.4" />
                  ))}
                </g>
              );
            })}

            {/* Floor-change staircase indicators — small spiral glyph at the
                room end of any corridor leading to another floor */}
            {CORRIDORS.filter(c => c.kind === "floor-change" && (FLOOR_OF_ROOM[c.from] === activeFloor || FLOOR_OF_ROOM[c.to] === activeFloor)).map((c, i) => {
              const onThisFloorEnd = FLOOR_OF_ROOM[c.from] === activeFloor ? c.points[0] : c.points[c.points.length - 1];
              return (
                <g key={`stair-${i}`} transform={`translate(${onThisFloorEnd.x} ${onThisFloorEnd.y})`}>
                  <path d="M 0 -1 A 1 1 0 0 1 0.9 0.3 A 0.6 0.6 0 0 1 -0.3 0.5"
                    fill="none" stroke="#5c3a1e" strokeWidth="0.18" strokeOpacity="0.6" />
                  <text x="0" y="2.2" textAnchor="middle" style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.1px", fill: "#5c3a1e", opacity: 0.7 }}>
                    ↕ stairs
                  </text>
                </g>
              );
            })}

            {/* Rooms — decorative labels, NOT boxes. Underline flourish,
                bracket flourish, or a small tower glyph depending on type. */}
            {visibleRooms.map(room => (
              <g key={room.name}>
                {room.flourish === "tower" && (
                  <path d={`M ${room.x - 2} ${room.y + 3} L ${room.x - 2} ${room.y - 1} L ${room.x - 1} ${room.y - 2.5} L ${room.x} ${room.y - 1.2} L ${room.x + 1} ${room.y - 2.5} L ${room.x + 2} ${room.y - 1} L ${room.x + 2} ${room.y + 3}`}
                    fill="none" stroke="#3d2814" strokeWidth="0.18" strokeOpacity="0.55" />
                )}
                {room.flourish === "brackets" && (
                  <>
                    <path d={`M ${room.x - room.name.length * 0.55} ${room.y - 1.8} L ${room.x - room.name.length * 0.65} ${room.y - 1.8} L ${room.x - room.name.length * 0.65} ${room.y + 1.8} L ${room.x - room.name.length * 0.55} ${room.y + 1.8}`}
                      fill="none" stroke="#3d2814" strokeWidth="0.15" strokeOpacity="0.5" />
                    <path d={`M ${room.x + room.name.length * 0.55} ${room.y - 1.8} L ${room.x + room.name.length * 0.65} ${room.y - 1.8} L ${room.x + room.name.length * 0.65} ${room.y + 1.8} L ${room.x + room.name.length * 0.55} ${room.y + 1.8}`}
                      fill="none" stroke="#3d2814" strokeWidth="0.15" strokeOpacity="0.5" />
                  </>
                )}
                <text
                  x={room.x} y={room.y}
                  transform={`rotate(${room.labelAngle ?? 0} ${room.x} ${room.y})`}
                  textAnchor="middle" dominantBaseline="middle"
                  style={{ fontFamily: "'IM Fell English', serif", fontSize: "2px", fill: "#3d2814", opacity: 0.85, letterSpacing: "0.02em" }}
                >
                  {room.name}
                </text>
                {room.flourish === "underline" && (
                  <path d={`M ${room.x - room.name.length * 0.62} ${room.y + 1.3} Q ${room.x} ${room.y + 1.9} ${room.x + room.name.length * 0.62} ${room.y + 1.3}`}
                    fill="none" stroke="#3d2814" strokeWidth="0.16" strokeOpacity="0.55" />
                )}
              </g>
            ))}

            {/* Footprints + traveling name — the name banner rides with the
                LEAD (most recent) footprint of each character, not a static
                point above a fixed location. */}
            {(() => {
              const visiblePrints = footprints.filter(p => p.floor === activeFloor);
              // group by owner, find the most recent (lead) print per owner
              const leadByOwner: Record<string, typeof visiblePrints[number]> = {};
              for (const p of visiblePrints) {
                if (!leadByOwner[p.ownerId] || p.bornAt > leadByOwner[p.ownerId].bornAt) leadByOwner[p.ownerId] = p;
              }
              return (
                <>
                  {visiblePrints.map(p => {
                    const age = Date.now() - p.bornAt;
                    const fadeProgress = Math.min(age / 2600, 1);
                    const opacity = 0.85 * (1 - fadeProgress);
                    return (
                      <path key={p.id}
                        d="M 0 -0.62 C 0.32 -0.62 0.42 -0.38 0.4 -0.12 C 0.38 0.08 0.22 0.12 0.16 0.3 C 0.12 0.46 0.18 0.6 0.05 0.66 C -0.1 0.72 -0.28 0.66 -0.32 0.5 C -0.38 0.28 -0.28 0.12 -0.3 -0.1 C -0.32 -0.34 -0.18 -0.62 0 -0.62 Z"
                        fill="#8b2e1f" opacity={Math.max(opacity, 0)}
                        transform={`translate(${p.x} ${p.y}) rotate(${p.angle})`}
                      />
                    );
                  })}
                  {characters.map(char => {
                    const lead = leadByOwner[char.id];
                    const pos = positions[char.id];
                    if (!lead && (!pos || pos.floor !== activeFloor)) return null;
                    const point = lead ? { x: lead.x, y: lead.y } : pos!;
                    const isMatched = matchedCharId === char.id;
                    return (
                      <g key={char.id} opacity={searchQuery && !isMatched ? 0.25 : 1}
                        onClick={() => setSelected(char)} style={{ cursor: "pointer" }}>
                        <text x={point.x + 2.2} y={point.y - 0.3} dominantBaseline="middle"
                          style={{ fontFamily: "'Pirata One', 'IM Fell English', serif", fontSize: "1.6px", fill: isMatched ? "#a84a2f" : "#7a3b2e", letterSpacing: "0.02em" }}>
                          {char.name}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
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
              <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.85rem", color: "#5c3a1e", marginBottom: "0.6rem" }}>📍 {selected.room}</p>
              {selected.rumor && <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.8rem", color: "#3d2814", fontStyle: "italic", lineHeight: 1.5 }}>"{selected.rumor}"</p>}
              <button onClick={() => setSelected(null)} style={{ marginTop: "0.75rem", background: "#7a3b2e", color: "#e9d6a8", border: "none", borderRadius: "0.25rem", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.75rem" }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}