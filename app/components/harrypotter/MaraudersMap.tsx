"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { loadArchive } from "@/lib/archiveEngine";
import { geminiQualityCallFor, hasGeminiQualityKey3, hasGeminiQualityKey, hasGeminiQualityKey2 } from "@/lib/geminiEngine";

// ════════════════════════════════════════════════════════════════════════
// PHILOSOPHY SHIFT — the map is a fixed, decorative parchment backdrop,
// not a navigable architectural floor plan. Characters wander along a
// handful of fixed decorative paths drawn directly on the parchment.
// The map itself never regenerates or changes structure; only the
// characters move. This matches the film's actual mechanic: beautiful
// static parchment + moving names/footprints, nothing more.
// ════════════════════════════════════════════════════════════════════════

// ── Fixed wander paths — decorative routes baked into the parchment.
// Each is a named "zone" purely for flavor (shown in the click popup),
// not a real navigable room graph. Paths loop back on themselves so
// characters can wander indefinitely without needing a room network.
interface WanderPath {
  zoneName: string;
  points: Array<{ x: number; y: number }>; // loops: last point connects back near the first
}

const WANDER_PATHS: WanderPath[] = [
  { zoneName: "Gryffindor Tower", points: [
    { x: 12, y: 10 }, { x: 22, y: 8 }, { x: 30, y: 16 }, { x: 24, y: 26 }, { x: 14, y: 24 }, { x: 8, y: 16 }, { x: 12, y: 10 },
  ]},
  { zoneName: "Great Hall", points: [
    { x: 40, y: 14 }, { x: 58, y: 12 }, { x: 64, y: 22 }, { x: 56, y: 30 }, { x: 42, y: 28 }, { x: 36, y: 20 }, { x: 40, y: 14 },
  ]},
  { zoneName: "Ravenclaw Tower", points: [
    { x: 78, y: 10 }, { x: 90, y: 12 }, { x: 92, y: 22 }, { x: 82, y: 26 }, { x: 74, y: 18 }, { x: 78, y: 10 },
  ]},
  { zoneName: "The Library", points: [
    { x: 10, y: 42 }, { x: 24, y: 38 }, { x: 32, y: 46 }, { x: 26, y: 56 }, { x: 12, y: 54 }, { x: 6, y: 48 }, { x: 10, y: 42 },
  ]},
  { zoneName: "Great Staircase", points: [
    { x: 42, y: 44 }, { x: 56, y: 40 }, { x: 64, y: 50 }, { x: 58, y: 60 }, { x: 44, y: 58 }, { x: 38, y: 50 }, { x: 42, y: 44 },
  ]},
  { zoneName: "Forbidden Corridor", points: [
    { x: 74, y: 44 }, { x: 88, y: 42 }, { x: 92, y: 52 }, { x: 82, y: 58 }, { x: 70, y: 52 }, { x: 74, y: 44 },
  ]},
  { zoneName: "Dungeons", points: [
    { x: 12, y: 72 }, { x: 26, y: 70 }, { x: 32, y: 80 }, { x: 22, y: 88 }, { x: 10, y: 86 }, { x: 6, y: 78 }, { x: 12, y: 72 },
  ]},
  { zoneName: "Hagrid's Hut & Grounds", points: [
    { x: 44, y: 76 }, { x: 60, y: 72 }, { x: 68, y: 82 }, { x: 58, y: 90 }, { x: 42, y: 88 }, { x: 36, y: 80 }, { x: 44, y: 76 },
  ]},
  { zoneName: "Quidditch Pitch", points: [
    { x: 78, y: 74 }, { x: 92, y: 72 }, { x: 94, y: 84 }, { x: 84, y: 90 }, { x: 72, y: 84 }, { x: 78, y: 74 },
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
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

// ════════════════════════════════════════════════════════════════════════
// STATIC PARCHMENT — built once, never regenerates. Dense scribble texture,
// ink stains, a handful of fixed decorative label fragments, secret-passage
// style dashed lines for flavor. Original artwork, inspired by the film's
// aged-parchment aesthetic, not copied from it.
// ════════════════════════════════════════════════════════════════════════

interface ScribbleZone { x0: number; y0: number; x1: number; y1: number; angle: number }
const SCRIBBLE_ZONES: ScribbleZone[] = [
  { x0: 0, y0: 0, x1: 100, y1: 8, angle: 5 },
  { x0: 0, y0: 92, x1: 100, y1: 100, angle: -5 },
  { x0: 0, y0: 0, x1: 8, y1: 100, angle: 80 },
  { x0: 92, y0: 0, x1: 100, y1: 100, angle: -80 },
  { x0: 32, y0: 0, x1: 68, y1: 10, angle: 0 },
  { x0: 0, y0: 30, x1: 8, y1: 64, angle: 75 },
  { x0: 92, y0: 30, x1: 100, y1: 64, angle: -75 },
  { x0: 32, y0: 32, x1: 42, y1: 42, angle: 20 },
  { x0: 58, y0: 32, x1: 68, y1: 42, angle: -20 },
  { x0: 32, y0: 60, x1: 42, y1: 70, angle: 15 },
  { x0: 58, y0: 60, x1: 68, y1: 70, angle: -15 },
  { x0: 0, y0: 64, x1: 40, y1: 72, angle: 8 },
  { x0: 60, y0: 64, x1: 100, y1: 72, angle: -8 },
  { x0: 32, y0: 90, x1: 70, y1: 100, angle: 0 },
];

function buildScribbleClusters(): Array<{ d: string; size: number }> {
  const clusters: Array<{ d: string; size: number }> = [];
  let seed = 17;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (const zone of SCRIBBLE_ZONES) {
    const w = zone.x1 - zone.x0, h = zone.y1 - zone.y0;
    const area = Math.max(w * h, 1);
    const clusterCount = Math.max(6, Math.floor(area * 0.5));
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

// Fixed decorative secret-passage style dashed lines — pure flavor, drawn
// once, never regenerated, crossing between wander-path zones diagonally.
const SECRET_PASSAGE_LINES: Array<Array<{ x: number; y: number }>> = [
  [{ x: 18, y: 20 }, { x: 38, y: 38 }, { x: 50, y: 44 }],
  [{ x: 82, y: 20 }, { x: 62, y: 38 }, { x: 50, y: 44 }],
  [{ x: 20, y: 56 }, { x: 38, y: 64 }, { x: 50, y: 76 }],
  [{ x: 80, y: 56 }, { x: 62, y: 64 }, { x: 50, y: 76 }],
  [{ x: 28, y: 30 }, { x: 50, y: 50 }, { x: 72, y: 30 }],
];

function CompassRose({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`} opacity="0.45">
      <circle r="3.2" fill="none" stroke="#3d2814" strokeWidth="0.1" />
      <path d="M 0 -3.2 L 0.5 -0.5 L 0 0 L -0.5 -0.5 Z" fill="#3d2814" />
      <path d="M 0 3.2 L 0.5 0.5 L 0 0 L -0.5 0.5 Z" fill="#3d2814" opacity="0.6" />
      <path d="M -3.2 0 L -0.5 0.5 L 0 0 L -0.5 -0.5 Z" fill="#3d2814" opacity="0.6" />
      <path d="M 3.2 0 L 0.5 0.5 L 0 0 L 0.5 -0.5 Z" fill="#3d2814" opacity="0.6" />
      <text x="0" y="-4" textAnchor="middle" style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.6px", fill: "#3d2814" }}>N</text>
    </g>
  );
}

function TitleBanner() {
  const w = 17;
  return (
    <g transform="translate(50 5)">
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

// A single character "unit": position + facing angle, rendered as ONE
// rigid group (two footprints + nameplate, fixed local offsets) so the
// name and feet can never visually separate or slide independently.
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

  // ── Movement: each character wanders its zone's fixed loop path forever.
  // The unit (position + angle) updates every animation frame; trail points
  // are derived FROM the unit's own path (not a separately-tracked footprint
  // system), so feet and name can never drift apart — they're one object.
  useEffect(() => {
    if (phase !== "open" || characters.length === 0) return;
    const rafIds: number[] = [];

    characters.forEach(char => {
      const path = WANDER_PATHS.find(p => p.zoneName === char.zone);
      if (!path) return;
      const points = path.points; // re-bind so TS keeps the non-null narrowing inside tick()
      const totalLen = polylineLength(points);
      const durationMs = Math.max(totalLen * 900, 16000); // gentle wandering pace around the loop
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

        const traveled = (elapsedActive * SPEED_PER_MS) % totalLen; // loops forever
        const { x, y, angle } = pointAtDistance(points, traveled);

        // Single atomic unit update — position AND angle change together,
        // in one state write, so nothing can render mid-update as "name
        // here, feet there." There is exactly one source of truth.
        setUnits(prev => ({ ...prev, [char.id]: { x, y, angle } }));

        if (traveled - lastTrailDist >= TRAIL_SPACING || Math.abs(traveled - lastTrailDist) > totalLen / 2) {
          setTrails(prev => {
            const existing = prev[char.id] || [];
            const next = [...existing, { x, y, angle }];
            // Keep only the most recent 26 trail points — a long visible
            // walking trail without growing unbounded.
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

          {/* ── STATIC PARCHMENT — built once, never regenerates. Everything
              below this point except the character units is permanently fixed. ── */}
          <g transform={`translate(${pan.x / 8} ${pan.y / 8}) scale(${zoom})`} style={{ transformOrigin: "50% 50%" }}>
            <rect x="0" y="0" width="100" height="100" fill="url(#va-parchment-grad)" />
            <circle cx="12" cy="20" r="9" fill="url(#va-ink-stain)" />
            <circle cx="88" cy="30" r="7" fill="url(#va-ink-stain)" />
            <circle cx="30" cy="85" r="10" fill="url(#va-ink-stain)" />
            <circle cx="70" cy="8" r="6" fill="url(#va-ink-stain)" />
            <circle cx="95" cy="90" r="8" fill="url(#va-ink-stain)" />

            <g stroke="#5c3a1e" strokeOpacity="0.3" fill="none" strokeLinecap="round">
              {SCRIBBLE_CLUSTERS.map((c, i) => <path key={i} d={c.d} strokeWidth={c.size} />)}
            </g>

            {SECRET_PASSAGE_LINES.map((pts, i) => (
              <path key={i} d={polylineToPathD(pts)} fill="none" stroke="#5c3a1e" strokeWidth="0.1" strokeOpacity="0.3" strokeDasharray="0.3 0.7" />
            ))}

            <CompassRose cx={92} cy={94} />
            <TitleBanner />

            {/* Fixed zone labels — decorative only, dimmed background info,
                drawn once and never regenerated, matching the parchment's
                handwritten-annotation feel rather than architectural labels. */}
            {WANDER_PATHS.map(path => {
              const cx = path.points.reduce((s, p) => s + p.x, 0) / path.points.length;
              const cy = path.points.reduce((s, p) => s + p.y, 0) / path.points.length;
              return (
                <text key={path.zoneName} x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontFamily: "'IM Fell English', serif", fontSize: "1.7px", fill: "#3d2814", opacity: 0.42, letterSpacing: "0.02em" }}>
                  {path.zoneName}
                </text>
              );
            })}

            {/* ── CHARACTER UNITS — each step drops a PAIRED left+right
                footprint (not alternating single prints far apart), and
                the nameplate is plain text that rotates WITH the movement
                angle — no background box, matching the film's plain
                handwritten-on-parchment look. ── */}
            {characters.map(char => {
              const trail = trails[char.id] || [];
              const unit = units[char.id];
              const isMatched = matchedCharId === char.id;
              const dimmed = !!searchQuery && !isMatched;
              const FOOT_SEPARATION = 0.55;
              return (
                <g key={char.id} opacity={dimmed ? 0.2 : 1}>
                  {/* Fading trail — each history point renders as a PAIR of
                      feet (left + right together), close together like the
                      film's "LR  LR  LR" stamped pairs, not spread-out
                      alternating single dots. */}
                  {trail.map((t, i) => {
                    const ageFactor = 1 - i / trail.length;
                    const opacity = 0.6 * (1 - ageFactor * 0.85);
                    const perpAngle = (t.angle + 90) * Math.PI / 180;
                    const leftX = t.x + Math.cos(perpAngle) * FOOT_SEPARATION;
                    const leftY = t.y + Math.sin(perpAngle) * FOOT_SEPARATION;
                    const rightX = t.x - Math.cos(perpAngle) * FOOT_SEPARATION;
                    const rightY = t.y - Math.sin(perpAngle) * FOOT_SEPARATION;
                    const footPath = "M 0 -0.55 C 0.28 -0.55 0.37 -0.34 0.35 -0.1 C 0.33 0.07 0.2 0.1 0.14 0.26 C 0.1 0.4 0.16 0.52 0.04 0.58 C -0.09 0.63 -0.25 0.58 -0.28 0.44 C -0.33 0.24 -0.25 0.1 -0.26 -0.08 C -0.28 -0.3 -0.16 -0.55 0 -0.55 Z";
                    return (
                      <g key={i} opacity={Math.max(opacity, 0.04)}>
                        <path d={footPath} fill="#8b2e1f" transform={`translate(${leftX} ${leftY}) rotate(${t.angle})`} />
                        <path d={footPath} fill="#8b2e1f" transform={`translate(${rightX} ${rightY}) rotate(${t.angle})`} />
                      </g>
                    );
                  })}

                  {/* The leading unit — current paired footprints + the
                      name, all positioned from one (x, y, angle) so they
                      can never visually separate. */}
                  {unit && (() => {
                    const perpAngle = (unit.angle + 90) * Math.PI / 180;
                    const leftX = unit.x + Math.cos(perpAngle) * FOOT_SEPARATION;
                    const leftY = unit.y + Math.sin(perpAngle) * FOOT_SEPARATION;
                    const rightX = unit.x - Math.cos(perpAngle) * FOOT_SEPARATION;
                    const rightY = unit.y - Math.sin(perpAngle) * FOOT_SEPARATION;
                    const footPath = "M 0 -0.55 C 0.28 -0.55 0.37 -0.34 0.35 -0.1 C 0.33 0.07 0.2 0.1 0.14 0.26 C 0.1 0.4 0.16 0.52 0.04 0.58 C -0.09 0.63 -0.25 0.58 -0.28 0.44 C -0.33 0.24 -0.25 0.1 -0.26 -0.08 C -0.28 -0.3 -0.16 -0.55 0 -0.55 Z";
                    // Name sits just ahead of the foot pair along the
                    // direction of travel, and rotates WITH that direction
                    // (matching the film) rather than staying upright.
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