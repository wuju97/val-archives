"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadArchive, saveArchive, addCustomTab, removeCustomTab,
  regenerateMasterPrompt, setPriority, getPriorityLevel, ArchiveData,
  getActiveVaultId, saveVaultById,
} from "@/lib/archiveEngine";
import { hasGeminiKey, geminiCall } from "../../lib/geminiEngine";

const QUICK_EMOJIS = ["📖","🌌","⚔️","🔮","🧙","🏰","🗺️","📜","🌙","☀️","🔥","❄️","⚡","🌊","🌿","💀","👁️","🎭","🎲","🏛️","🐉","⚗️","🗡️","🛡️","📿","🔑","🌺","🦅","🐺","💎"];

const ACCENT_COLORS = ["#3b82f6","#7c3aed","#10b981","#f43f5e","#f59e0b"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface CharacterCard {
  id: string;
  name: string;
  accentColor: string;
  overrideTraits?: string[];
  overrideGoals?: string[];
  overrideAchievements?: string[];
}

// ─── Arc Gauge ────────────────────────────────────────────────────────────────

function ArcGauge({ value, label, color, size = 90 }: { value: number; label: string; color: string; size?: number }) {
  const r = size * 0.37;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 200;
  const endAngle = 340;
  const totalArc = endAngle - startAngle;
  const filled = Math.max(0, Math.min(100, value)) / 100 * totalArc;

  function polar(angle: number, radius: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  function arcPath(start: number, end: number, r: number) {
    const s = polar(start, r);
    const e = polar(end, r);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
        <path d={arcPath(startAngle, startAngle + totalArc, r)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" strokeLinecap="round" />
        {value > 0 && <path d={arcPath(startAngle, startAngle + filled, r)} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />}
        <text x={cx} y={cy * 0.9} textAnchor="middle" fill="white" fontSize={size * 0.18} fontWeight="700">{value}%</text>
        <text x={cx} y={cy * 1.12} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={size * 0.1} letterSpacing="0.5">{label}</text>
      </svg>
    </div>
  );
}

// ─── Extract character data ───────────────────────────────────────────────────

function extractForCharacter(archive: ArchiveData, name: string) {
  const lower = name.toLowerCase();
  const relevant = archive.entries.filter(e => e.text.toLowerCase().includes(lower));

  const traitWords = relevant.flatMap(e =>
    e.text.match(/\b(brave|cunning|loyal|ruthless|mysterious|kind|dark|noble|feared|loved|reckless|wise|haunted|determined|cold|passionate|secretive|ambitious|proud|broken|resilient|charismatic|solitary|dangerous|gentle|fierce|calculating|impulsive|stoic|volatile|enigmatic|devoted|vengeful|hopeful|cynical|playful|serious|protective|rebellious)\b/gi) ?? []
  ).map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  const traits = [...new Set(traitWords)].slice(0, 5);

  const questEntries = relevant.filter(e => e.category === "quests-plotlines");
  const completedKw = ["completed","done","finished","resolved","succeeded","achieved","won"];
  const goals = questEntries.filter(e => !completedKw.some(k => e.text.toLowerCase().includes(k))).slice(0, 2).map(e => e.text.slice(0, 55) + (e.text.length > 55 ? "..." : ""));
  const achievements = [...questEntries.filter(e => completedKw.some(k => e.text.toLowerCase().includes(k))), ...relevant.filter(e => e.category === "history" || e.category === "timeline-continuity")].slice(0, 2).map(e => e.text.slice(0, 55) + (e.text.length > 55 ? "..." : ""));

  const allyCount = relevant.filter(e => /loyal|trust|friend|ally|partner|love/i.test(e.text)).length;
  const enemyCount = relevant.filter(e => /enemy|hate|rival|betray|oppose/i.test(e.text)).length;
  const questTotal = questEntries.length;
  const questDone = questEntries.filter(e => completedKw.some(k => e.text.toLowerCase().includes(k))).length;
  const questProgress = questTotal > 0 ? Math.round((questDone / questTotal) * 100) : 0;
  const archiveScore = Math.min(100, Math.round((relevant.length / 20) * 100));

  return { traits, goals, achievements, allyCount, enemyCount, questProgress, archiveScore, entryCount: relevant.length };
}

// ─── Priority Dot ─────────────────────────────────────────────────────────────

function PriorityDot({ id, archive, onUpdate }: { id: string; archive: ArchiveData; onUpdate: (a: ArchiveData) => void }) {
  const level = getPriorityLevel(archive, id);
  function handleClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    let updated;
    if (level === "none") updated = setPriority(archive, id, "blue");
    else if (level === "blue") updated = setPriority(archive, id, "red");
    else updated = setPriority(archive, id, "none");
    saveArchive(updated); onUpdate(updated);
  }
  const color = level === "red" ? "#ef4444" : level === "blue" ? "#3b82f6" : "var(--va-text-muted)";
  return (
    <button onClick={handleClick} title={level === "none" ? "Set priority" : level === "blue" ? "🔵 2nd · click for 🔴 1st" : "🔴 1st · click to remove"}
      style={{ width: "18px", height: "18px", borderRadius: "50%", background: level !== "none" ? color : "transparent", border: `2px solid ${color}`, cursor: "pointer", flexShrink: 0, padding: 0, transition: "all 0.15s" }} />
  );
}

// ─── Character Panel ──────────────────────────────────────────────────────────

function CharacterPanel({ card, archive, onRemove, onUpdate }: {
  card: CharacterCard;
  archive: ArchiveData;
  onRemove: () => void;
  onUpdate: (updated: CharacterCard) => void;
}) {
  const data = extractForCharacter(archive, card.name);
  const traits = card.overrideTraits ?? data.traits;
  const goals = card.overrideGoals ?? data.goals;
  const achievements = card.overrideAchievements ?? data.achievements;
  const [refining, setRefining] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(card.name);
  const accent = card.accentColor;

  async function handleAIRefine() {
    if (!hasGeminiKey()) return;
    setRefining(true);
    const relevant = archive.entries.filter(e => e.text.toLowerCase().includes(card.name.toLowerCase()));
    const context = relevant.map(e => `[${e.category}] ${e.text}`).join("\n").slice(0, 3000);
    const prompt = "Extract character info for \"" + card.name + "\" from these archive entries.\n\nReturn ONLY JSON:\n{\"traits\": [\"up to 5 personality traits\"], \"goals\": [\"up to 2 current goals\"], \"achievements\": [\"up to 2 achievements or notable history\"]}\n\nEntries:\n" + context;
    try {
      const result = await geminiCall(prompt);
      const clean = result.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      onUpdate({ ...card, overrideTraits: parsed.traits, overrideGoals: parsed.goals, overrideAchievements: parsed.achievements });
    } catch {}
    setRefining(false);
  }

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)", border: `1px solid ${accent}44`, borderRadius: "1rem", padding: "0.875rem 1.1rem", position: "relative", overflow: "hidden" }}>

      {/* Accent glow */}
      <div style={{ position: "absolute", top: 0, right: 0, width: "100px", height: "100px", background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`, borderRadius: "50%", transform: "translate(30%, -30%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.25rem" }}>Character</p>
          {editingName ? (
            <input value={nameVal} onChange={e => setNameVal(e.target.value)}
              onBlur={() => { setEditingName(false); onUpdate({ ...card, name: nameVal }); }}
              onKeyDown={e => { if (e.key === "Enter") { setEditingName(false); onUpdate({ ...card, name: nameVal }); } }}
              autoFocus style={{ fontSize: "1.4rem", fontWeight: "800", background: "transparent", border: "none", borderBottom: `1px solid ${accent}`, outline: "none", color: "white", width: "100%" }} />
          ) : (
            <h2 onClick={() => setEditingName(true)} style={{ fontSize: "1.6rem", fontWeight: "800", color: "white", cursor: "text", lineHeight: 1.1, marginBottom: "0.25rem" }}>{card.name}</h2>
          )}
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>{data.entryCount} archive entries</p>
        </div>
        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
          {hasGeminiKey() && (
            <button onClick={handleAIRefine} disabled={refining}
              style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent, padding: "0.25rem 0.625rem", borderRadius: "0.375rem", fontSize: "0.7rem", cursor: "pointer", fontWeight: "600", opacity: refining ? 0.6 : 1 }}>
              {refining ? "✨..." : "✨ AI"}
            </button>
          )}
          <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", fontSize: "1rem", padding: "0.125rem 0.25rem" }}>×</button>
        </div>
      </div>

      {/* Traits */}
      <div style={{ marginBottom: "0.5rem" }}>
        <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.375rem" }}>Traits</p>
        {traits.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
            {traits.map(t => (
              <span key={t} style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "9999px", background: `${accent}18`, border: `1px solid ${accent}44`, color: accent, fontWeight: "600" }}>{t}</span>
            ))}
          </div>
        ) : <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.18)" }}>No traits detected yet</p>}
      </div>

      {/* Gauges */}
      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "0.5rem" }}>
        <ArcGauge value={data.questProgress} label="QUESTS" color={accent} size={65} />
        <ArcGauge value={data.archiveScore} label="ARCHIVE" color="#22c55e" size={65} />
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem", marginBottom: "0.5rem" }}>
        {[
          { label: "Allies", value: data.allyCount },
          { label: "Rivals", value: data.enemyCount },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.375rem", padding: "0.35rem 0.5rem" }}>
            <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</p>
            <p style={{ fontSize: "1rem", fontWeight: "700", color: "white" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div style={{ marginBottom: "0.375rem" }}>
          <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.375rem" }}>Goals</p>
          {goals.map((g, i) => (
            <div key={i} style={{ display: "flex", gap: "0.375rem", alignItems: "flex-start", marginBottom: "0.25rem" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: accent, marginTop: "0.35rem", flexShrink: 0, boxShadow: `0 0 5px ${accent}` }} />
              <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.4" }}>{g}</p>
            </div>
          ))}
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.375rem" }}>Achievements</p>
          {achievements.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: "0.375rem", alignItems: "flex-start", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "0.65rem", marginTop: "0.1rem", flexShrink: 0 }}>⚡</span>
              <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.4" }}>{a}</p>
            </div>
          ))}
        </div>
      )}

      {data.entryCount === 0 && (
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "0.5rem 0" }}>
          No entries found for "{card.name}" — add info via Inbox or Story
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

const CARDS_KEY = "valArchivesDashboardCards";

export default function DashboardPage() {
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [archiveName, setArchiveName] = useState("Untitled Archive");
  const [lastSave, setLastSave] = useState("Never");
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [newTabEmoji, setNewTabEmoji] = useState("📖");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [vaultFont, setVaultFont] = useState("inherit");

  useEffect(() => {
    const loaded = loadArchive();
    setArchive(loaded);
    setArchiveName(loaded.archiveName);
    setLastSave(loaded.lastSaved ? new Date(loaded.lastSaved).toLocaleString() : "Never");
    setVaultFont(localStorage.getItem("valArchivesVaultFont") || "inherit");
    try {
      const savedCards = localStorage.getItem(CARDS_KEY);
      if (savedCards) setCards(JSON.parse(savedCards));
    } catch {}
  }, []);

  function saveCards(updated: CharacterCard[]) {
    setCards(updated);
    localStorage.setItem(CARDS_KEY, JSON.stringify(updated));
  }

  function handleAddCard() {
    if (!newCardName.trim() || cards.length >= 5) return;
    const newCard: CharacterCard = {
      id: crypto.randomUUID(),
      name: newCardName.trim(),
      accentColor: ACCENT_COLORS[cards.length % ACCENT_COLORS.length],
    };
    saveCards([...cards, newCard]);
    setNewCardName(""); setShowAddCard(false);
  }

  function handleRemoveCard(id: string) {
    saveCards(cards.filter(c => c.id !== id));
  }

  function handleUpdateCard(updated: CharacterCard) {
    saveCards(cards.map(c => c.id === updated.id ? updated : c));
  }

  function handleSave() {
    if (!archive) return;
    const updated = { ...archive, archiveName };
    saveArchive(updated);
    const vaultId = getActiveVaultId();
    if (vaultId) saveVaultById(vaultId, updated);
    setLastSave(new Date().toLocaleString());
    setArchive({ ...updated, lastSaved: new Date().toISOString() });
    alert("🌌 Archive Saved");
  }

  function handleRefresh() {
    const loaded = loadArchive();
    const refreshed = regenerateMasterPrompt(loaded);
    saveArchive(refreshed); setArchive(refreshed);
    setArchiveName(refreshed.archiveName);
    setLastSave(new Date().toLocaleString());
    alert("🔄 Refreshed");
  }

  function handleAddTab() {
    if (!archive || !newTabName.trim()) return;
    const tabLabel = `${newTabEmoji} ${newTabName.trim()}`;
    const updated = regenerateMasterPrompt(addCustomTab(archive, tabLabel));
    saveArchive(updated); setArchive(updated);
    setNewTabName(""); setNewTabEmoji("📖"); setShowAddTab(false); setShowEmojiPicker(false);
  }

  function handleRemoveTab(tabName: string) {
    if (!archive || !confirm(`Remove "${tabName}"?`)) return;
    const updated = regenerateMasterPrompt(removeCustomTab(archive, tabName));
    saveArchive(updated); setArchive(updated);
  }

  const customTabs = archive?.customTabs ?? [];
  const gridCols = cards.length <= 1 ? "1fr" : cards.length <= 2 ? "1fr 1fr" : cards.length <= 4 ? "1fr 1fr" : "repeat(3, 1fr)";

  if (!archive) return <div style={{ minHeight: "100vh", background: "#080808" }} />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--va-bg)", color: "var(--va-text)" }}>

      {/* LEFT SIDEBAR */}
      <aside style={{ width: "13rem", padding: "1rem", borderRight: "1px solid var(--va-border)", background: "var(--va-surface)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <p style={{ fontSize: "0.65rem", color: "var(--va-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0.25rem 0.75rem 0.5rem" }}>Navigation</p>

        {[{ href: "/home", label: "🏠 Home" }, { href: "/pensieve", label: "🌀 Pensieve" }, { href: "/rule-book", label: "📋 Rule Book" }].map(item => (
          <Link key={item.href} href={item.href} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text)", fontSize: "0.875rem", textDecoration: "none", display: "block" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--va-border)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {item.label}
          </Link>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Link href="/story-studio" style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text)", fontSize: "0.875rem", textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--va-border)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>📖 Story</Link>
          <PriorityDot id="story" archive={archive} onUpdate={setArchive} />
          <div style={{ width: "0.5rem" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Link href="/canon" style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text)", fontSize: "0.875rem", textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--va-border)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>🏛 Canon Archives</Link>
          <PriorityDot id="canon" archive={archive} onUpdate={setArchive} />
          <div style={{ width: "0.5rem" }} />
        </div>

        <Link href="/timeline-save" style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text)", fontSize: "0.875rem", textDecoration: "none", display: "block" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--va-border)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>⏳ Timeline Save</Link>

        {customTabs.length > 0 && <p style={{ fontSize: "0.65rem", color: "var(--va-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0.75rem 0.75rem 0.25rem" }}>Custom Tabs</p>}
        {customTabs.map(tab => (
          <div key={tab} style={{ display: "flex", alignItems: "center" }}
            onMouseEnter={e => { (e.currentTarget.querySelector('a') as HTMLElement).style.background = "var(--va-border)"; (e.currentTarget.querySelector('.rb') as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget.querySelector('a') as HTMLElement).style.background = "transparent"; (e.currentTarget.querySelector('.rb') as HTMLElement).style.opacity = "0"; }}>
            <Link href={`/tab/${encodeURIComponent(tab)}`} style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text)", fontSize: "0.875rem", textDecoration: "none" }}>{tab}</Link>
            <button className="rb" onClick={() => handleRemoveTab(tab)} style={{ opacity: 0, background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", padding: "0.25rem", transition: "opacity 0.15s" }}>×</button>
          </div>
        ))}

        {showAddTab ? (
          <div style={{ padding: "0.5rem 0.25rem" }}>
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--va-border)", background: "var(--va-bg)", color: "var(--va-text)", cursor: "pointer", fontSize: "0.8rem", marginBottom: "0.375rem" }}>
              <span style={{ fontSize: "1.25rem" }}>{newTabEmoji}</span><span style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>Pick emoji</span>
            </button>
            {showEmojiPicker && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.125rem", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.5rem", marginBottom: "0.375rem" }}>
                {QUICK_EMOJIS.map(emoji => <button key={emoji} onClick={() => { setNewTabEmoji(emoji); setShowEmojiPicker(false); }} style={{ aspectRatio: "1", fontSize: "1rem", background: "none", border: "none", cursor: "pointer", borderRadius: "0.25rem" }}>{emoji}</button>)}
              </div>
            )}
            <input value={newTabName} onChange={e => setNewTabName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddTab()} placeholder="Tab name..." autoFocus
              style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.4rem 0.625rem", outline: "none", color: "var(--va-text)", fontSize: "0.8rem", marginBottom: "0.375rem", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <button onClick={handleAddTab} disabled={!newTabName.trim()} style={{ flex: 1, background: "var(--va-accent)", color: "white", border: "none", borderRadius: "0.375rem", padding: "0.375rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600" }}>Add</button>
              <button onClick={() => { setShowAddTab(false); setNewTabName(""); setShowEmojiPicker(false); }} style={{ flex: 1, background: "var(--va-border)", color: "var(--va-text)", border: "none", borderRadius: "0.375rem", padding: "0.375rem", cursor: "pointer", fontSize: "0.75rem" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddTab(true)} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text-muted)", fontSize: "0.875rem", background: "none", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}>➕ Add Tab</button>
        )}


      </aside>

      {/* CENTER */}
      <main style={{ flex: 1, padding: "1.5rem 1.5rem", overflow: "auto" }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <input value={archiveName} onChange={e => setArchiveName(e.target.value)}
              style={{ fontSize: "3.5rem", fontWeight: "800", background: "transparent", border: "none", outline: "none", color: "var(--va-text)", fontFamily: vaultFont, width: "100%", letterSpacing: "-0.5px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.25rem" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", opacity: 0.7 }}>
                Last save: {lastSave} · {archive.entries.length} entries
              </p>
              <Link href="/home" style={{ color: "var(--va-accent)", fontSize: "0.75rem", opacity: 0.7 }}>✨ AI setup</Link>
            </div>
          </div>
          {cards.length < 5 && (
            <button onClick={() => setShowAddCard(!showAddCard)}
              style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", color: "var(--va-text)", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" }}>
              + Add Character
            </button>
          )}
        </div>

        {/* Add character form */}
        {showAddCard && (
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-accent)", borderRadius: "0.75rem", padding: "1rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <input value={newCardName} onChange={e => setNewCardName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCard()}
              placeholder="Character name (e.g. Valefor, Hermione, Ron)..."
              autoFocus style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.9rem" }} />
            <button onClick={handleAddCard} disabled={!newCardName.trim()}
              style={{ background: "var(--va-accent)", color: "white", padding: "0.625rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "700", opacity: !newCardName.trim() ? 0.4 : 1 }}>
              Add
            </button>
            <button onClick={() => { setShowAddCard(false); setNewCardName(""); }}
              style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.625rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}

        {/* Character grid */}
        {cards.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: "1rem" }}>
            {cards.map(card => (
              <CharacterPanel key={card.id} card={card} archive={archive}
                onRemove={() => handleRemoveCard(card.id)}
                onUpdate={handleUpdateCard} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", paddingTop: "5rem", color: "var(--va-text-muted)" }}>
            <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>👤</p>
            <p style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.5rem" }}>No characters yet</p>
            <p style={{ fontSize: "0.875rem", opacity: 0.6, marginBottom: "1.5rem" }}>Click "Add Character" and type a name. Val Archives will auto-pull all related info from your vault.</p>
            <button onClick={() => setShowAddCard(true)} style={{ background: "var(--va-accent)", color: "white", padding: "0.625rem 1.5rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "700" }}>
              + Add Your First Character
            </button>
          </div>
        )}

        {/* PC Download */}
        <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--va-border)", textAlign: "center" }}>
          <a
            href="https://drive.google.com/file/d/1IJGKK07ZjWLiuqiPb8vAbG1LvfMVadgA/view?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.625rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", color: "var(--va-text)", padding: "0.625rem 1.25rem", borderRadius: "0.625rem", textDecoration: "none", fontSize: "0.875rem", fontWeight: "600" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--va-accent)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--va-border)"}
          >
            <span style={{ fontSize: "1.1rem" }}>🖥️</span>
            Download Val Archives for PC
          </a>
          <p style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", marginTop: "0.5rem", opacity: 0.5 }}>Windows · Mac · Linux</p>
        </div>
      </main>

      {/* RIGHT SIDEBAR */}
      <aside style={{ width: "13rem", padding: "1rem", borderLeft: "1px solid var(--va-border)", background: "var(--va-surface)", display: "flex", flexDirection: "column", gap: "0.125rem", flexShrink: 0 }}>
        <p style={{ fontSize: "0.65rem", color: "var(--va-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0.25rem 0.75rem 0.5rem" }}>Tools</p>
        {[
          { href: "/master-prompt", label: "👑 Master Prompt" },
          { href: "/custom-prompt", label: "🕰 Custom Prompt" },
          { href: "/inbox", label: "📥 Inbox" },
          { href: "/prompt-forge", label: "✍ Prompt Forge" },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text)", fontSize: "0.875rem", textDecoration: "none", display: "block" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--va-border)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {item.label}
          </Link>
        ))}
        <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--va-border)", display: "flex", flexDirection: "column", gap: "0.125rem" }}>
          <button onClick={handleSave} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text)", fontSize: "0.875rem", background: "none", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}>💾 Save</button>
          <button onClick={handleRefresh} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text)", fontSize: "0.875rem", background: "none", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}>🔄 Refresh</button>
          <Link href="/vaults" style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text-muted)", fontSize: "0.875rem", textDecoration: "none", display: "block" }}>🗄️ Switch Vault</Link>
          <Link href="/settings" style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", color: "var(--va-text-muted)", fontSize: "0.875rem", textDecoration: "none", display: "block" }}>⚙ Settings</Link>
        </div>
      </aside>
    </div>
  );
}