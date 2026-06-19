"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { loadArchive } from "@/lib/archiveEngine";
import { geminiQualityCallFor, hasGeminiQualityKey3, hasGeminiQualityKey, hasGeminiQualityKey2 } from "@/lib/geminiEngine";

// ════════════════════════════════════════════════════════════════════════
// FLOOR PLAN — rooms as rectangles, corridors as wall-lined hallway paths.
// This is an architectural layout, not a node graph: every room is a
// drawn floor outline, every connection is a drawn hallway with walls,
// and footprints travel along the corridor's actual centerline.
// ════════════════════════════════════════════════════════════════════════

interface RoomRect {
  name: string;
  x: number; y: number; w: number; h: number; // floor outline, 0-100 viewBox units
  labelAngle?: number;
  doors: Array<"top" | "right" | "bottom" | "left">; // which walls have door gaps
}

const ROOMS: RoomRect[] = [
  { name: "Gryffindor Tower", x: 4, y: 4, w: 18, h: 14, doors: ["bottom"] },
  { name: "Ravenclaw Tower", x: 78, y: 4, w: 18, h: 14, doors: ["bottom"] },
  { name: "Great Hall", x: 38, y: 6, w: 24, h: 16, doors: ["bottom", "left", "right"] },
  { name: "Entrance Hall", x: 40, y: 30, w: 20, h: 12, doors: ["top", "bottom", "left", "right"] },
  { name: "Library", x: 14, y: 32, w: 18, h: 14, doors: ["right", "bottom"] },
  { name: "Astronomy Tower", x: 68, y: 32, w: 18, h: 14, doors: ["left", "bottom"] },
  { name: "Great Staircase", x: 42, y: 50, w: 16, h: 16, doors: ["top", "left", "right", "bottom"] },
  { name: "Potions Classroom", x: 10, y: 52, w: 18, h: 14, doors: ["right"] },
  { name: "Slytherin Dungeon", x: 6, y: 74, w: 18, h: 16, doors: ["top"] },
  { name: "Hufflepuff Basement", x: 76, y: 74, w: 18, h: 16, doors: ["top"] },
  { name: "Forbidden Corridor", x: 60, y: 54, w: 18, h: 14, doors: ["left", "bottom"] },
  { name: "Hagrid's Hut", x: 14, y: 84, w: 16, h: 12, doors: ["top"] },
  { name: "Quidditch Pitch", x: 70, y: 84, w: 16, h: 12, doors: ["top"] },
];

const ROOM_BY_NAME: Record<string, RoomRect> = ROOMS.reduce(
  (acc, r) => ({ ...acc, [r.name]: r }), {} as Record<string, RoomRect>
);

// A corridor is a polyline (sequence of points) connecting a door on one
// room to a door on another — may bend (L-shapes), giving it a real
// hallway feel rather than a straight ruler line between centers.
interface Corridor {
  from: string; to: string;
  points: Array<{ x: number; y: number }>; // includes both endpoints
  kind: "hallway" | "stairs";
}

function doorPoint(room: RoomRect, wall: "top" | "right" | "bottom" | "left", offset = 0.5): { x: number; y: number } {
  switch (wall) {
    case "top": return { x: room.x + room.w * offset, y: room.y };
    case "bottom": return { x: room.x + room.w * offset, y: room.y + room.h };
    case "left": return { x: room.x, y: room.y + room.h * offset };
    case "right": return { x: room.x + room.w, y: room.y + room.h * offset };
  }
}

const CORRIDORS: Corridor[] = [
  { from: "Gryffindor Tower", to: "Great Hall",
    points: [doorPoint(ROOM_BY_NAME["Gryffindor Tower"], "bottom"), { x: 13, y: 22 }, { x: 13, y: 14 }, doorPoint(ROOM_BY_NAME["Great Hall"], "left")],
    kind: "hallway" },
  { from: "Ravenclaw Tower", to: "Great Hall",
    points: [doorPoint(ROOM_BY_NAME["Ravenclaw Tower"], "bottom"), { x: 87, y: 22 }, { x: 87, y: 14 }, doorPoint(ROOM_BY_NAME["Great Hall"], "right")],
    kind: "hallway" },
  { from: "Great Hall", to: "Entrance Hall",
    points: [doorPoint(ROOM_BY_NAME["Great Hall"], "bottom"), doorPoint(ROOM_BY_NAME["Entrance Hall"], "top")],
    kind: "hallway" },
  { from: "Entrance Hall", to: "Library",
    points: [doorPoint(ROOM_BY_NAME["Entrance Hall"], "left"), { x: 32, y: 36 }, doorPoint(ROOM_BY_NAME["Library"], "right")],
    kind: "hallway" },
  { from: "Entrance Hall", to: "Astronomy Tower",
    points: [doorPoint(ROOM_BY_NAME["Entrance Hall"], "right"), { x: 68, y: 36 }, doorPoint(ROOM_BY_NAME["Astronomy Tower"], "left")],
    kind: "hallway" },
  { from: "Entrance Hall", to: "Great Staircase",
    points: [doorPoint(ROOM_BY_NAME["Entrance Hall"], "bottom"), doorPoint(ROOM_BY_NAME["Great Staircase"], "top")],
    kind: "stairs" },
  { from: "Library", to: "Potions Classroom",
    points: [doorPoint(ROOM_BY_NAME["Library"], "bottom"), { x: 23, y: 48 }, doorPoint(ROOM_BY_NAME["Potions Classroom"], "top", 0.3)],
    kind: "hallway" },
  { from: "Great Staircase", to: "Potions Classroom",
    points: [doorPoint(ROOM_BY_NAME["Great Staircase"], "left"), doorPoint(ROOM_BY_NAME["Potions Classroom"], "right")],
    kind: "hallway" },
  { from: "Great Staircase", to: "Forbidden Corridor",
    points: [doorPoint(ROOM_BY_NAME["Great Staircase"], "right"), doorPoint(ROOM_BY_NAME["Forbidden Corridor"], "left")],
    kind: "hallway" },
  { from: "Astronomy Tower", to: "Forbidden Corridor",
    points: [doorPoint(ROOM_BY_NAME["Astronomy Tower"], "bottom"), { x: 77, y: 50 }, doorPoint(ROOM_BY_NAME["Forbidden Corridor"], "right")],
    kind: "hallway" },
  { from: "Potions Classroom", to: "Slytherin Dungeon",
    points: [doorPoint(ROOM_BY_NAME["Potions Classroom"], "bottom", 0.3), doorPoint(ROOM_BY_NAME["Slytherin Dungeon"], "top")],
    kind: "stairs" },
  { from: "Forbidden Corridor", to: "Hufflepuff Basement",
    points: [doorPoint(ROOM_BY_NAME["Forbidden Corridor"], "bottom"), { x: 85, y: 68 }, doorPoint(ROOM_BY_NAME["Hufflepuff Basement"], "top")],
    kind: "stairs" },
  { from: "Slytherin Dungeon", to: "Hagrid's Hut",
    points: [doorPoint(ROOM_BY_NAME["Slytherin Dungeon"], "bottom", 0.4), doorPoint(ROOM_BY_NAME["Hagrid's Hut"], "top")],
    kind: "hallway" },
  { from: "Hufflepuff Basement", to: "Quidditch Pitch",
    points: [doorPoint(ROOM_BY_NAME["Hufflepuff Basement"], "bottom", 0.4), doorPoint(ROOM_BY_NAME["Quidditch Pitch"], "top")],
    kind: "hallway" },
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

// ── Path math: total length + point-at-distance, since we're in React SVG
// and can't call the DOM's path.getPointAtLength on a declarative <path>
// without a ref + layout effect. Manual polyline sampling does the same job.
function polylineLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
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
      return {
        x: a.x + dx * t,
        y: a.y + dy * t,
        angle: Math.atan2(dy, dx) * 180 / Math.PI,
      };
    }
    remaining -= segLen;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

function polylineToPathD(points: Array<{ x: number; y: number }>): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

// Offsets a polyline perpendicular to its segments by a fixed distance, to
// draw the two parallel "hallway wall" lines on either side of the centerline.
function offsetPolyline(points: Array<{ x: number; y: number }>, offset: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    let nx = 0, ny = 0;
    if (prev && next) {
      const d1x = curr.x - prev.x, d1y = curr.y - prev.y;
      const d2x = next.x - curr.x, d2y = next.y - curr.y;
      const n1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
      const n2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1;
      nx = (-d1y / n1 + -d2y / n2) / 2;
      ny = (d1x / n1 + d2x / n2) / 2;
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
// BACKGROUND TEXTURE — zoned dense scribble, kept from before, but now
// confined to filling the gaps BETWEEN rooms/corridors rather than the
// whole canvas, since rooms+corridors now occupy most of the space.
// ════════════════════════════════════════════════════════════════════════

interface ScribbleZone { x0: number; y0: number; x1: number; y1: number; angle: number }
const SCRIBBLE_ZONES: ScribbleZone[] = [
  { x0: 0, y0: 0, x1: 100, y1: 4, angle: 5 },
  { x0: 0, y0: 96, x1: 100, y1: 100, angle: -5 },
  { x0: 0, y0: 0, x1: 4, y1: 100, angle: 80 },
  { x0: 96, y0: 0, x1: 100, y1: 100, angle: -80 },
  { x0: 26, y0: 18, x1: 38, y1: 30, angle: 15 },
  { x0: 62, y0: 18, x1: 78, y1: 30, angle: -15 },
  { x0: 32, y0: 46, x1: 42, y1: 50, angle: 10 },
  { x0: 58, y0: 46, x1: 60, y1: 54, angle: -10 },
  { x0: 30, y0: 66, x1: 60, y1: 74, angle: 0 },
  { x0: 32, y0: 96, x1: 70, y1: 100, angle: 4 },
];

function buildScribbleClusters(): Array<{ d: string; size: number }> {
  const clusters: Array<{ d: string; size: number }> = [];
  let seed = 7;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (const zone of SCRIBBLE_ZONES) {
    const w = zone.x1 - zone.x0;
    const h = zone.y1 - zone.y0;
    const area = Math.max(w * h, 1);
    const clusterCount = Math.max(4, Math.floor(area * 0.5));
    const rad = (zone.angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    for (let i = 0; i < clusterCount; i++) {
      const baseX = zone.x0 + rand() * w;
      const baseY = zone.y0 + rand() * h;
      const strokeCount = 2 + Math.floor(rand() * 3);
      let d = "";
      let cursorX = 0;
      for (let s = 0; s < strokeCount; s++) {
        const letterW = 0.4 + rand() * 0.7;
        const letterH = 0.4 + rand() * 0.9;
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
const SCRIBBLE_CLUSTERS = buildScribbleClusters();

// ════════════════════════════════════════════════════════════════════════
// BANNER SHAPE — rolled scroll end, fishtail cut, curling tail (unchanged)
// ════════════════════════════════════════════════════════════════════════

function BannerShape({ cx, cy, width, fill, onClick }: { cx: number; cy: number; width: number; fill: string; onClick?: () => void }) {
  const w = width / 2;
  return (
    <g transform={`translate(${cx} ${cy})`} style={{ cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <path
        d={`M ${-w * 0.55} ${1.3} Q ${-w * 0.75} ${2.3} ${-w * 0.5} ${2.7} Q ${-w * 0.3} ${3.0} ${-w * 0.5} ${2.0} Q ${-w * 0.6} ${1.5} ${-w * 0.4} ${1.4}`}
        fill="none" stroke={fill} strokeWidth="0.14" strokeOpacity="0.9"
      />
      <path
        d={`M ${-w} ${-1.1} L ${w * 0.6} ${-1.2} L ${w} ${-0.5} L ${w * 0.72} ${0} L ${w} ${0.5} L ${w * 0.6} ${1.2} L ${-w} ${1.1} L ${-w * 0.75} ${0} Z`}
        fill={fill} fillOpacity="0.85" stroke="#3d2814" strokeWidth="0.1"
      />
      <g transform={`translate(${-w * 0.92} 0)`}>
        <path d="M 0 -1.3 Q -0.9 -1.3 -0.9 -0.55 Q -0.9 0 -0.3 0.05 Q 0.15 0.05 0.15 -0.3 Q 0.15 -0.55 -0.15 -0.55"
          fill="none" stroke="#3d2814" strokeWidth="0.12" />
        <path d="M -0.9 -0.55 Q -0.9 0.3 0 1.3 L 0 -1.3 Z"
          fill={fill} fillOpacity="0.7" stroke="#3d2814" strokeWidth="0.1" />
      </g>
    </g>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TYPES + AI POPULATION
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
      id: `fallback-${i}-${Date.now()}`,
      name,
      room: ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)],
      rumor: "",
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
  const [footprints, setFootprints] = useState<Array<{ id: number; x: number; y: number; angle: number; bornAt: number }>>([]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selected, setSelected] = useState<MapCharacter | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
    const initialPositions: Record<string, { x: number; y: number }> = {};
    chars.forEach(c => {
      const room = ROOM_BY_NAME[c.room];
      if (room) initialPositions[c.id] = { x: room.x + room.w / 2, y: room.y + room.h / 2 };
    });
    setPositions(initialPositions);
    setLoadingChars(false);
    setTimeout(() => setPhase("open"), 700);
  }, [phase]);

  const closeMap = useCallback(() => {
    setPhase("closing");
    clearAllTimers();
    setTimeout(() => {
      setPhase("closed");
      setCharacters([]);
      setFootprints([]);
      setPositions({});
      setSelected(null);
      setSearchQuery("");
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }, 500);
  }, [clearAllTimers]);

  // ── Movement constrained to actual corridor paths ──────────────────────
  useEffect(() => {
    if (phase !== "open" || characters.length === 0) return;

    characters.forEach(char => {
      let currentRoom = char.room;

      function dropPrint(x: number, y: number, angle: number) {
        const id = ++printIdRef.current;
        setFootprints(prev => [...prev, { id, x, y, angle, bornAt: Date.now() }]);
        const cleanup = setTimeout(() => setFootprints(prev => prev.filter(p => p.id !== id)), 2200);
        timersRef.current.push(cleanup);
      }

      // Walks along the corridor polyline's actual centerline between two
      // rooms, sampling evenly-spaced points by distance — not a free
      // straight-line lerp between arbitrary coordinates. This is what
      // makes movement follow the drawn hallway instead of cutting across
      // open parchment.
      function walkToRoom(nextRoomName: string, onDone: () => void) {
        const corridor = CORRIDOR_BY_PAIR[`${currentRoom}::${nextRoomName}`];
        if (!corridor) { onDone(); return; }
        const totalLen = polylineLength(corridor.points);
        const STEP_DIST = totalLen / 7;
        let traveled = 0;
        const stepInterval = setInterval(() => {
          traveled += STEP_DIST;
          const { x, y, angle } = pointAtDistance(corridor.points, Math.min(traveled, totalLen));
          dropPrint(x, y, angle);
          setPositions(prev => ({ ...prev, [char.id]: { x, y } }));
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
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
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
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: phase === "closing" ? 0 : 1,
      transition: "opacity 0.5s ease",
    }}>
      <div style={{
        position: "relative", width: "min(92vw, 1100px)", height: "min(88vh, 800px)",
        transform: phase === "opening" ? "scaleY(0.05)" : "scaleY(1)",
        transformOrigin: "center",
        transition: "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        borderRadius: "0.5rem",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.6rem 0.9rem", background: "rgba(15,15,18,0.7)",
        }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 Find witch or wizard..."
            style={{
              flex: 1, background: "rgba(233,214,168,0.15)", border: "1px solid rgba(233,214,168,0.3)",
              borderRadius: "0.375rem", padding: "0.4rem 0.7rem", color: "#e9d6a8",
              fontFamily: "'IM Fell English', serif", fontSize: "0.85rem", outline: "none",
            }}
          />
          <span style={{ color: "#e9d6a8", fontSize: "0.75rem", opacity: 0.7 }}>scroll to zoom · drag to pan</span>
          <button
            onClick={closeMap}
            style={{
              background: "rgba(122,59,46,0.9)", color: "#e9d6a8", border: "1px solid #3d2814",
              borderRadius: "0.375rem", padding: "0.4rem 0.8rem", cursor: "pointer",
              fontFamily: "'Pirata One', serif", fontSize: "0.8rem",
            }}
          >
            ✦ Mischief Managed
          </button>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }}
        >
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

          <g transform={`translate(${pan.x / 8} ${pan.y / 8}) scale(${zoom})`} style={{ transformOrigin: "50% 50%" }}>
            <rect x="0" y="0" width="100" height="100" fill="url(#va-parchment-grad)" />

            <circle cx="12" cy="20" r="9" fill="url(#va-ink-stain)" />
            <circle cx="88" cy="30" r="7" fill="url(#va-ink-stain)" />
            <circle cx="30" cy="85" r="10" fill="url(#va-ink-stain)" />
            <circle cx="70" cy="8" r="6" fill="url(#va-ink-stain)" />
            <circle cx="95" cy="90" r="8" fill="url(#va-ink-stain)" />

            <g stroke="#5c3a1e" strokeOpacity="0.28" fill="none" strokeLinecap="round">
              {SCRIBBLE_CLUSTERS.map((c, i) => <path key={i} d={c.d} strokeWidth={c.size} />)}
            </g>

            {/* ── Corridors: wall-lined hallways, drawn as parallel double
                lines with a centerline dash for stairs ── */}
            {CORRIDORS.map((c, i) => {
              const wallA = offsetPolyline(c.points, 1.1);
              const wallB = offsetPolyline(c.points, -1.1);
              return (
                <g key={i}>
                  <path d={polylineToPathD(wallA)} fill="none" stroke="#3d2814" strokeWidth="0.22" strokeOpacity="0.65" strokeLinejoin="round" />
                  <path d={polylineToPathD(wallB)} fill="none" stroke="#3d2814" strokeWidth="0.22" strokeOpacity="0.65" strokeLinejoin="round" />
                  {c.kind === "stairs" ? (
                    <path d={polylineToPathD(c.points)} fill="none" stroke="#3d2814" strokeWidth="0.16"
                      strokeOpacity="0.5" strokeDasharray="0.6 0.5" />
                  ) : (
                    <path d={polylineToPathD(c.points)} fill="none" stroke="#5c3a1e" strokeWidth="0.06" strokeOpacity="0.25" />
                  )}
                </g>
              );
            })}

            {/* ── Rooms: actual floor outlines with door gaps in the walls ── */}
            {ROOMS.map(room => {
              const doorGap = 1.6;
              const corners = [
                { x: room.x, y: room.y }, { x: room.x + room.w, y: room.y },
                { x: room.x + room.w, y: room.y + room.h }, { x: room.x, y: room.y + room.h },
              ];
              return (
                <g key={room.name}>
                  <rect x={room.x} y={room.y} width={room.w} height={room.h}
                    fill="#e9d6a8" fillOpacity="0.25" stroke="#3d2814" strokeWidth="0.35" strokeOpacity="0.8" />
                  {/* door gaps: short lighter-colored overpaint segments where a door breaks the wall */}
                  {room.doors.map((wall, di) => {
                    const dp = doorPoint(room, wall, 0.5);
                    const isHoriz = wall === "top" || wall === "bottom";
                    return (
                      <rect key={di}
                        x={isHoriz ? dp.x - doorGap / 2 : (wall === "left" ? room.x - 0.2 : room.x + room.w - 0.2)}
                        y={isHoriz ? (wall === "top" ? room.y - 0.2 : room.y + room.h - 0.2) : dp.y - doorGap / 2}
                        width={isHoriz ? doorGap : 0.4}
                        height={isHoriz ? 0.4 : doorGap}
                        fill="#d8bd82"
                      />
                    );
                  })}
                  <text
                    x={room.x + room.w / 2} y={room.y + room.h / 2}
                    transform={`rotate(${room.labelAngle ?? 0} ${room.x + room.w / 2} ${room.y + room.h / 2})`}
                    textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.9px", fill: "#3d2814", opacity: 0.8, letterSpacing: "0.02em" }}
                  >
                    {room.name}
                  </text>
                </g>
              );
            })}

            <BannerShape cx={50} cy={2.5} width={30} fill="#7a3b2e" />
            <text x="50" y="3.1" textAnchor="middle" style={{ fontFamily: "'Pirata One', 'IM Fell English', serif", fontSize: "2.6px", fill: "#e9d6a8", letterSpacing: "0.05em" }}>
              Marauder's Map
            </text>

            {footprints.map(p => {
              const age = Date.now() - p.bornAt;
              const fadeProgress = Math.min(age / 2200, 1);
              const opacity = 0.85 * (1 - fadeProgress);
              return (
                <path key={p.id}
                  d="M 0 -0.62 C 0.32 -0.62 0.42 -0.38 0.4 -0.12 C 0.38 0.08 0.22 0.12 0.16 0.3 C 0.12 0.46 0.18 0.6 0.05 0.66 C -0.1 0.72 -0.28 0.66 -0.32 0.5 C -0.38 0.28 -0.28 0.12 -0.3 -0.1 C -0.32 -0.34 -0.18 -0.62 0 -0.62 Z"
                  fill="#8b2e1f"
                  opacity={Math.max(opacity, 0)}
                  transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(1)`}
                />
              );
            })}

            {characters.map(char => {
              const pos = positions[char.id];
              if (!pos) return null;
              const isMatched = matchedCharId === char.id;
              return (
                <g key={char.id} opacity={searchQuery && !isMatched ? 0.25 : 1}>
                  <BannerShape
                    cx={pos.x} cy={pos.y - 4}
                    width={Math.max(10, char.name.length * 1.4)}
                    fill={isMatched ? "#a84a2f" : "#7a3b2e"}
                    onClick={() => setSelected(char)}
                  />
                  <text
                    x={pos.x} y={pos.y - 3.4} textAnchor="middle"
                    style={{ fontFamily: "'Pirata One', 'IM Fell English', serif", fontSize: "1.5px", fill: "#e9d6a8", letterSpacing: "0.02em", cursor: "pointer", pointerEvents: "none" }}
                  >
                    {char.name}
                  </text>
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
          }}>
            consulting the map...
          </div>
        )}

        {selected && (
          <div onClick={() => setSelected(null)} style={{
            position: "absolute", inset: 0, zIndex: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#e9d6a8", border: "2px solid #3d2814", borderRadius: "0.5rem",
              padding: "1.25rem", maxWidth: "20rem", boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}>
              <p style={{ fontFamily: "'Pirata One', serif", fontSize: "1.1rem", color: "#3d2814", marginBottom: "0.4rem" }}>{selected.name}</p>
              <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.85rem", color: "#5c3a1e", marginBottom: "0.6rem" }}>📍 {selected.room}</p>
              {selected.rumor && (
                <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.8rem", color: "#3d2814", fontStyle: "italic", lineHeight: 1.5 }}>"{selected.rumor}"</p>
              )}
              <button onClick={() => setSelected(null)} style={{ marginTop: "0.75rem", background: "#7a3b2e", color: "#e9d6a8", border: "none", borderRadius: "0.25rem", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.75rem" }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}