"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasGeminiKey, geminiVerifyCategories } from "../../lib/geminiEngine";
import {
  loadArchive, loadArchiveAsync, saveArchive, regenerateMasterPrompt,
  CATEGORY_LABELS, CATEGORY_ICONS, MASTER_PROMPT_ORDER,
  StoryCategory, getPriorityLevel, setPriority, ArchiveData,
} from "@/lib/archiveEngine";

type SubTab = "canon" | "player";

export default function StoryStudioPage() {
  const [archive, setArchive] = useState<ArchiveData>(loadArchive());
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("canon");
  const [canonCounts, setCanonCounts] = useState<Partial<Record<StoryCategory, number>>>({});
  const [playerCounts, setPlayerCounts] = useState<Partial<Record<StoryCategory, number>>>({});
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResults, setVerifyResults] = useState<Array<{
    id: string; text: string; currentCategory: string;
    suggestedCategory: string; reason: string; accepted: boolean; subtab: SubTab;
  }>>([]);
  const [showVerify, setShowVerify] = useState(false);

  useEffect(() => {
    const sync = loadArchive();
    if (sync.entries.length > 0 || (sync.playerEntries ?? []).length > 0) {
      updateCounts(sync);
      setArchive(sync);
      setLoaded(true);
    } else {
      loadArchiveAsync().then(a => {
        if (a) { updateCounts(a); setArchive(a); }
        setLoaded(true);
      });
    }
  }, []);

  function updateCounts(a: ArchiveData) {
    const cc: Partial<Record<StoryCategory, number>> = {};
    for (const e of a.entries) cc[e.category] = (cc[e.category] ?? 0) + 1;
    setCanonCounts(cc);
    const pc: Partial<Record<StoryCategory, number>> = {};
    for (const e of (a.playerEntries ?? [])) pc[e.category] = (pc[e.category] ?? 0) + 1;
    setPlayerCounts(pc);
  }

  const counts = activeSubTab === "canon" ? canonCounts : playerCounts;
  const totalCanon = archive.entries.length;
  const totalPlayer = (archive.playerEntries ?? []).length;
  const total = activeSubTab === "canon" ? totalCanon : totalPlayer;

  const filteredCategories = MASTER_PROMPT_ORDER.filter(cat =>
    !search.trim() || CATEGORY_LABELS[cat].toLowerCase().includes(search.toLowerCase())
  );

  async function handleVerify() {
    setVerifying(true); setShowVerify(false); setVerifyResults([]);
    const a = loadArchive();
    const ALL_CATS = Object.keys(CATEGORY_LABELS);

    const results: typeof verifyResults = [];

    // Verify canon entries
    if (a.entries.length > 0) {
      const canonEntries = a.entries.map(e => ({ id: e.id, text: e.text, category: e.category }));
      const canonResults = await geminiVerifyCategories(canonEntries, ALL_CATS);
      results.push(...canonResults.map(r => ({ ...r, accepted: true, subtab: "canon" as SubTab })));
    }

    // Verify player entries
    if ((a.playerEntries ?? []).length > 0) {
      const playerEntries = (a.playerEntries ?? []).map(e => ({ id: e.id, text: e.text, category: e.category }));
      const playerResults = await geminiVerifyCategories(playerEntries, ALL_CATS);
      results.push(...playerResults.map(r => ({ ...r, accepted: true, subtab: "player" as SubTab })));
    }

    setVerifyResults(results);
    setShowVerify(true);
    setVerifying(false);
  }

  function applyVerifyResults() {
    const a = loadArchive();
    const toMove = verifyResults.filter(r => r.accepted);
    if (toMove.length === 0) { setShowVerify(false); return; }

    let updated = { ...a };
    // Apply canon moves
    const canonMoves = toMove.filter(r => r.subtab === "canon");
    if (canonMoves.length > 0) {
      updated.entries = updated.entries.map(e => {
        const move = canonMoves.find(m => m.id === e.id);
        return move ? { ...e, category: move.suggestedCategory as StoryCategory, updatedAt: new Date().toISOString() } : e;
      });
    }
    // Apply player moves
    const playerMoves = toMove.filter(r => r.subtab === "player");
    if (playerMoves.length > 0) {
      updated.playerEntries = (updated.playerEntries ?? []).map(e => {
        const move = playerMoves.find(m => m.id === e.id);
        return move ? { ...e, category: move.suggestedCategory as StoryCategory, updatedAt: new Date().toISOString() } : e;
      });
    }

    const refreshed = regenerateMasterPrompt(updated);
    saveArchive(refreshed);
    setArchive(refreshed);
    updateCounts(refreshed);
    setShowVerify(false);
    setVerifyResults([]);
  }

  const S = {
    subTabBtn: (active: boolean, color: string) => ({
      padding: "0.5rem 1.5rem",
      borderRadius: "0.5rem 0.5rem 0 0",
      border: "none",
      borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
      background: active ? "var(--va-surface)" : "transparent",
      color: active ? color : "var(--va-text-muted)",
      cursor: "pointer",
      fontWeight: active ? "700" : "400",
      fontSize: "0.9rem",
      transition: "all 0.15s",
    } as React.CSSProperties),
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>
      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "bold" }}>📖 Story Studio</h1>
        {hasGeminiKey() && (totalCanon > 0 || totalPlayer > 0) && (
          <button onClick={handleVerify} disabled={verifying}
            style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: verifying ? 0.6 : 1 }}>
            {verifying ? "✨ Checking..." : "✨ AI Verify Categories"}
          </button>
        )}
      </div>

      {/* Subtab toggle */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--va-border)", marginBottom: "1.5rem", gap: "0.25rem" }}>
        <button style={S.subTabBtn(activeSubTab === "canon", "#3b82f6")} onClick={() => setActiveSubTab("canon")}>
          📖 Canon Story
          <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", opacity: 0.7 }}>({totalCanon})</span>
        </button>
        <button style={S.subTabBtn(activeSubTab === "player", "#7c3aed")} onClick={() => setActiveSubTab("player")}>
          🎮 Player Story
          <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", opacity: 0.7 }}>({totalPlayer})</span>
        </button>
      </div>

      {/* Subtab description */}
      <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
        {activeSubTab === "canon"
          ? "📖 Canon Story — established facts from source material. Imported from Canon Archives."
          : "🎮 Player Story — your character's actual journey. Imported from Inbox."}
      </p>

      {/* Verify results */}
      {showVerify && (
        <div style={{ background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <div>
              <h3 style={{ fontWeight: "bold", color: "#c4b5fd", marginBottom: "0.25rem" }}>✨ Category Audit</h3>
              <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>
                {verifyResults.length === 0 ? "All entries are in the correct categories ✓"
                  : `${verifyResults.length} entries may need moving — accept or reject each one`}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {verifyResults.length > 0 && (
                <>
                  <button onClick={applyVerifyResults}
                    style={{ background: "#7c3aed", color: "white", padding: "0.375rem 0.875rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}>
                    Apply {verifyResults.filter(r => r.accepted).length} Accepted
                  </button>
                  <button onClick={() => setVerifyResults(prev => prev.map(r => ({ ...r, accepted: false })))}
                    style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                    Reject All
                  </button>
                </>
              )}
              <button onClick={() => setShowVerify(false)}
                style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                Close
              </button>
            </div>
          </div>
          {verifyResults.map((r, i) => (
            <div key={r.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", background: "var(--va-bg)", border: `1px solid ${r.accepted ? "#7c3aed" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "0.5rem", opacity: r.accepted ? 1 : 0.5 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.375rem", borderRadius: "9999px", background: r.subtab === "canon" ? "rgba(59,130,246,0.15)" : "rgba(124,58,237,0.15)", color: r.subtab === "canon" ? "#3b82f6" : "#c4b5fd", fontWeight: "600" }}>
                    {r.subtab === "canon" ? "📖 Canon" : "🎮 Player"}
                  </span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text)", marginBottom: "0.25rem" }}>{r.text.slice(0, 80)}{r.text.length > 80 ? "..." : ""}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>
                  <span style={{ textDecoration: "line-through" }}>{r.currentCategory}</span>
                  <span style={{ color: "#7c3aed", margin: "0 0.5rem" }}>→</span>
                  <span style={{ color: "#c4b5fd" }}>{r.suggestedCategory}</span>
                  <span style={{ marginLeft: "0.5rem" }}>({r.reason})</span>
                </p>
              </div>
              <button onClick={() => setVerifyResults(prev => prev.map((item, idx) => idx === i ? { ...item, accepted: !item.accepted } : item))}
                style={{ background: r.accepted ? "#7c3aed" : "var(--va-border)", color: r.accepted ? "white" : "var(--va-text-muted)", padding: "0.25rem 0.625rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", flexShrink: 0 }}>
                {r.accepted ? "✓ Accepted" : "Rejected"}
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: "var(--va-text-muted)", marginBottom: "2rem", fontSize: "0.875rem" }}>
        {loaded ? `${total} ${total === 1 ? "entry" : "entries"} in ${activeSubTab === "canon" ? "Canon Story" : "Player Story"}` : "Loading..."}
      </p>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories..."
        style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", width: "100%", maxWidth: "28rem", display: "block", marginBottom: "2rem", boxSizing: "border-box" as const }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
        {filteredCategories.map(category => {
          const count = counts[category] ?? 0;
          const priorityKey = `${activeSubTab === "canon" ? "story" : "player"}-${category}`;
          const priority = getPriorityLevel(archive, priorityKey);
          const priorityDot = priority === "red" ? "🔴" : priority === "blue" ? "🔵" : null;
          const accentColor = activeSubTab === "canon" ? "#3b82f6" : "#7c3aed";
          return (
            <Link key={category} href={`/story-studio/${category}?subtab=${activeSubTab}`}
              style={{ background: "var(--va-surface)", border: `1px solid ${priority === "red" ? "#ef4444" : priority === "blue" ? accentColor : "var(--va-border)"}`, borderRadius: "0.75rem", padding: "1rem", textDecoration: "none", display: "block", opacity: count > 0 ? 1 : 0.7, transition: "border-color 0.2s, opacity 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = priority === "red" ? "#ef4444" : priority === "blue" ? accentColor : "var(--va-border)"; e.currentTarget.style.opacity = count > 0 ? "1" : "0.7"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>{CATEGORY_ICONS[category]}</span>
                <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                  {priorityDot && <span style={{ fontSize: "0.7rem" }}>{priorityDot}</span>}
                  {count > 0 && (
                    <span style={{ fontSize: "0.7rem", background: activeSubTab === "canon" ? "rgba(59,130,246,0.2)" : "rgba(124,58,237,0.2)", color: accentColor, padding: "0.125rem 0.5rem", borderRadius: "9999px" }}>
                      {count}
                    </span>
                  )}
                </div>
              </div>
              <p style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--va-text)" }}>{CATEGORY_LABELS[category]}</p>
              {count === 0 && <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>Empty</p>}
            </Link>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <p style={{ color: "var(--va-text-muted)", textAlign: "center", paddingTop: "3rem" }}>No categories match "{search}"</p>
      )}
    </div>
  );
}