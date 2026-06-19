"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { loadArchive } from "@/lib/archiveEngine";
import { geminiQualityCallFor, hasGeminiQualityKey3, hasGeminiQualityKey, hasGeminiQualityKey2 } from "@/lib/geminiEngine";

// ════════════════════════════════════════════════════════════════════════
// CASTLE LAYOUT — organic, diagonal, film-map-style composition
// ════════════════════════════════════════════════════════════════════════

interface CastleRoom {
  name: string;
  cx: number;
  cy: number;
  labelAngle?: number;
}

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
const ROOM_NAMES = Object.keys(CASTLE_CONNECTIONS);

// ════════════════════════════════════════════════════════════════════════
// BACKGROUND TEXTURE — zoned dense scribble, deterministic
// ════════════════════════════════════════════════════════════════════════

interface ScribbleZone { x0: number; y0: number; x1: number; y1: number; angle: number }
const SCRIBBLE_ZONES: ScribbleZone[] = [
  { x0: 0, y0: 0, x1: 35, y1: 18, angle: 8 },
  { x0: 35, y0: 0, x1: 70, y1: 16, angle: -5 },
  { x0: 70, y0: 0, x1: 100, y1: 20, angle: 22 },
  { x0: 0, y0: 18, x1: 22, y1: 38, angle: -12 },
  { x0: 78, y0: 20, x1: 100, y1: 42, angle: 35 },
  { x0: 0, y0: 38, x1: 24, y1: 58, angle: 4 },
  { x0: 76, y0: 42, x1: 100, y1: 62, angle: -18 },
  { x0: 0, y0: 58, x1: 26, y1: 80, angle: 18 },
  { x0: 74, y0: 62, x1: 100, y1: 84, angle: -8 },
  { x0: 0, y0: 80, x1: 30, y1: 100, angle: -22 },
  { x0: 70, y0: 84, x1: 100, y1: 100, angle: 12 },
  { x0: 30, y0: 84, x1: 70, y1: 100, angle: -6 },
];

function buildScribbleClusters(): Array<{ d: string; size: number }> {
  const clusters: Array<{ d: string; size: number }> = [];
  let seed = 7;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  for (const zone of SCRIBBLE_ZONES) {
    const w = zone.x1 - zone.x0;
    const h = zone.y1 - zone.y0;
    const area = w * h;
    const clusterCount = Math.max(8, Math.floor(area * 0.55));
    const rad = (zone.angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    for (let i = 0; i < clusterCount; i++) {
      const baseX = zone.x0 + rand() * w;
      const baseY = zone.y0 + rand() * h;
      const strokeCount = 3 + Math.floor(rand() * 4);
      let d = "";
      let cursorX = 0;
      for (let s = 0; s < strokeCount; s++) {
        const letterW = 0.5 + rand() * 0.9;
        const letterH = 0.5 + rand() * 1.1;
        const x0 = cursorX;
        const y0 = (rand() - 0.5) * 0.5;
        const x1 = cursorX + letterW * 0.4;
        const y1 = y0 - letterH * (rand() > 0.5 ? 1 : -1) * 0.7;
        const x2 = cursorX + letterW;
        const y2 = y0 + (rand() - 0.5) * 0.4;
        const rx0 = baseX + (x0 * cos - y0 * sin);
        const ry0 = baseY + (x0 * sin + y0 * cos);
        const rx1 = baseX + (x1 * cos - y1 * sin);
        const ry1 = baseY + (x1 * sin + y1 * cos);
        const rx2 = baseX + (x2 * cos - y2 * sin);
        const ry2 = baseY + (x2 * sin + y2 * cos);
        d += `M ${rx0.toFixed(2)} ${ry0.toFixed(2)} Q ${rx1.toFixed(2)} ${ry1.toFixed(2)} ${rx2.toFixed(2)} ${ry2.toFixed(2)} `;
        cursorX += letterW * 0.8;
      }
      clusters.push({ d, size: 0.1 + rand() * 0.07 });
    }
  }
  return clusters;
}
const SCRIBBLE_CLUSTERS = buildScribbleClusters();

// ════════════════════════════════════════════════════════════════════════
// BANNER SHAPE — rolled scroll end, fishtail cut, curling tail
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

interface MapCharacter {
  id: string;
  name: string;
  room: string;
  rumor: string;
}

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
    // "general" routing = Key 3 → Key 1 → Key 2, matching the rest of the app's
    // existing AI key architecture (Key 3 handles all general/non-canon/non-inbox tasks).
    const raw = await geminiQualityCallFor("general", prompt);
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    const parsed: Array<{ name: string; room: string; rumor: string }> = match ? JSON.parse(match[0]) : JSON.parse(cleaned);

    return parsed
      .filter(p => p.name && ROOM_NAMES.includes(p.room))
      .map((p, i) => ({ id: `ai-${i}-${Date.now()}`, name: p.name, room: p.room, rumor: p.rumor || "" }));
  } catch {
    // Fallback — generic names, random rooms, no rumor text. Also covers
    // ALL_KEYS_LIMITED and any other geminiQualityCallFor error — the map
    // must never break or show an error to the user.
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
  const [footprints, setFootprints] = useState<Array<{ id: number; x: number; y: number; angle: number; bornAt: number; ownerId: string }>>([]);
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

  // ── Open / close phrase detection ──────────────────────────────────────
  useEffect(() => {
    let typed = "";
    const OPEN_PHRASE = "i solemnly swear that i am up to no good";
    const CLOSE_PHRASE = "mischief managed";
    function handleKeydown(e: KeyboardEvent) {
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-OPEN_PHRASE.length);
      if (typed.endsWith(OPEN_PHRASE) && phase === "closed") {
        openMap();
      } else if (typed.endsWith(CLOSE_PHRASE) && (phase === "open" || phase === "opening")) {
        closeMap();
      }
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
      if (room) initialPositions[c.id] = { x: room.cx, y: room.cy };
    });
    setPositions(initialPositions);
    setLoadingChars(false);
    setTimeout(() => setPhase("open"), 700); // unfold animation duration
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

  // ── Continuous wandering movement while open ───────────────────────────
  useEffect(() => {
    if (phase !== "open" || characters.length === 0) return;

    characters.forEach(char => {
      let currentRoom = char.room;

      function dropPrint(x: number, y: number, angle: number) {
        const id = ++printIdRef.current;
        setFootprints(prev => [...prev, { id, x, y, angle, bornAt: Date.now(), ownerId: char.id }]);
        const cleanup = setTimeout(() => {
          setFootprints(prev => prev.filter(p => p.id !== id));
        }, 2200);
        timersRef.current.push(cleanup);
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
        let stepCount = 0;
        const stepInterval = setInterval(() => {
          step++;
          stepCount++;
          const t = step / STEPS;
          const x = from.cx + dx * t;
          const y = from.cy + dy * t;
          const side = stepCount % 2 === 0 ? 1 : -1;
          const perpX = Math.cos((angle + 90) * Math.PI / 180) * 1.1 * side;
          const perpY = Math.sin((angle + 90) * Math.PI / 180) * 1.1 * side;
          dropPrint(x + perpX, y + perpY, angle);
          setPositions(prev => ({ ...prev, [char.id]: { x, y } }));
          if (step >= STEPS) {
            clearInterval(stepInterval);
            currentRoom = nextRoomName;
            onDone();
          }
        }, 220);
        timersRef.current.push(stepInterval);
      }

      function scheduleNextMove() {
        // 40% chance to pause longer (lingering in a room), else move soon —
        // avoids robotic constant motion, per "never feel robotic" requirement.
        const lingering = Math.random() < 0.4;
        const delay = lingering ? 2500 + Math.random() * 3000 : 600 + Math.random() * 600;
        const t = setTimeout(() => {
          const connections = CASTLE_CONNECTIONS[currentRoom] || [];
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

  // ── Re-render tick so fading footprints animate smoothly ──────────────
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (phase !== "open") return;
    const id = setInterval(() => forceTick(n => n + 1), 80);
    return () => clearInterval(id);
  }, [phase]);

  // ── Zoom / pan handlers ─────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom(prev => Math.max(1, Math.min(4, prev + (e.deltaY < 0 ? 0.15 : -0.15))));
  }
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 });
  function handlePointerDown(e: React.PointerEvent) {
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }
  function handlePointerUp() {
    dragState.current.dragging = false;
  }

  // ── Search matching ─────────────────────────────────────────────────────
  const matchedCharId = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    const match = characters.find(c => c.name.toLowerCase().includes(q));
    return match?.id ?? null;
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
        {/* Controls bar */}
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
          <span style={{ color: "#e9d6a8", fontSize: "0.75rem", opacity: 0.7 }}>
            scroll to zoom · drag to pan
          </span>
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

            <g stroke="#5c3a1e" strokeOpacity="0.32" fill="none" strokeLinecap="round">
              {SCRIBBLE_CLUSTERS.map((c, i) => <path key={i} d={c.d} strokeWidth={c.size} />)}
            </g>

            {CASTLE_ROOMS.map(room => (
              <g key={room.name}>
                <circle cx={room.cx} cy={room.cy} r="0.7" fill="#3d2814" fillOpacity="0.6" />
                <text
                  x={room.cx} y={room.cy - 1.6}
                  transform={`rotate(${room.labelAngle ?? 0} ${room.cx} ${room.cy - 1.6})`}
                  textAnchor="middle"
                  style={{ fontFamily: "'IM Fell English', serif", fontSize: "2.1px", fill: "#3d2814", opacity: 0.75, letterSpacing: "0.02em" }}
                >
                  {room.name}
                </text>
              </g>
            ))}

            <BannerShape cx={50} cy={6} width={34} fill="#7a3b2e" />
            <text x="50" y="6.6" textAnchor="middle" style={{ fontFamily: "'Pirata One', 'IM Fell English', serif", fontSize: "3px", fill: "#e9d6a8", letterSpacing: "0.05em" }}>
              Marauder's Map
            </text>

            {footprints.map(p => {
              const age = Date.now() - p.bornAt;
              const fadeProgress = Math.min(age / 2200, 1);
              const opacity = 0.85 * (1 - fadeProgress);
              // Actual foot-sole silhouette: wider rounded toe-ball, narrower
              // waist, rounded heel — built as one closed path, not an ellipse.
              return (
                <path
                  key={p.id}
                  d="M 0 -0.62 C 0.32 -0.62 0.42 -0.38 0.4 -0.12 C 0.38 0.08 0.22 0.12 0.16 0.3 C 0.12 0.46 0.18 0.6 0.05 0.66 C -0.1 0.72 -0.28 0.66 -0.32 0.5 C -0.38 0.28 -0.28 0.12 -0.3 -0.1 C -0.32 -0.34 -0.18 -0.62 0 -0.62 Z"
                  fill="#8b2e1f"
                  opacity={Math.max(opacity, 0)}
                  transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(1.1)`}
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
                    cx={pos.x} cy={pos.y - 4.5}
                    width={Math.max(10, char.name.length * 1.5)}
                    fill={isMatched ? "#a84a2f" : "#7a3b2e"}
                    onClick={() => setSelected(char)}
                  />
                  <text
                    x={pos.x} y={pos.y - 3.9} textAnchor="middle"
                    style={{ fontFamily: "'Pirata One', 'IM Fell English', serif", fontSize: "1.7px", fill: "#e9d6a8", letterSpacing: "0.02em", cursor: "pointer", pointerEvents: "none" }}
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
          <div
            onClick={() => setSelected(null)}
            style={{
              position: "absolute", inset: 0, zIndex: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "#e9d6a8", border: "2px solid #3d2814", borderRadius: "0.5rem",
                padding: "1.25rem", maxWidth: "20rem", boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
              }}
            >
              <p style={{ fontFamily: "'Pirata One', serif", fontSize: "1.1rem", color: "#3d2814", marginBottom: "0.4rem" }}>
                {selected.name}
              </p>
              <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.85rem", color: "#5c3a1e", marginBottom: "0.6rem" }}>
                📍 {selected.room}
              </p>
              {selected.rumor && (
                <p style={{ fontFamily: "'IM Fell English', serif", fontSize: "0.8rem", color: "#3d2814", fontStyle: "italic", lineHeight: 1.5 }}>
                  "{selected.rumor}"
                </p>
              )}
              <button
                onClick={() => setSelected(null)}
                style={{ marginTop: "0.75rem", background: "#7a3b2e", color: "#e9d6a8", border: "none", borderRadius: "0.25rem", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.75rem" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   AI WIRING — CONFIRMED
   ════════════════════════════════════════════════════════════════════════
   Uses geminiQualityCallFor("general", prompt) — your existing Key 3 → Key 1
   → Key 2 routing, same as every other "general" task in the app (Pensieve,
   Chat, Refine buttons). No new key-management code needed.

   The prompt sent to Gemini is built by buildMaraudersPrompt() above and
   expects back ONLY a JSON array like:
   [{"name": "Harry Potter", "room": "Library", "rumor": "Suspiciously checking out books on basilisks."}]

   If the call fails for any reason (no key, ALL_KEYS_LIMITED, network, bad
   JSON), fetchMaraudersPopulation() falls back silently to generic random
   walkers with no rumor text — the map never breaks or shows an error.
   ════════════════════════════════════════════════════════════════════════ */