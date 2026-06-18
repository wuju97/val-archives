"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasGeminiKey, geminiVerifyCategories, geminiMergeContradiction } from "../../lib/geminiEngine";
import {
  loadArchive, loadArchiveAsync, saveArchive, regenerateMasterPrompt,
  CATEGORY_LABELS, CATEGORY_ICONS, MASTER_PROMPT_ORDER,
  StoryCategory, getPriorityLevel, setPriority, ArchiveData, ImportedSource,
  deleteCanonSource, deletePlayerSource,
  findContradictionCandidates, ContradictionCandidate,
  resolveContradictionKeep, resolveContradictionReplace, resolveContradictionMerge,
} from "@/lib/archiveEngine";

type SubTab = "canon" | "player";

export default function StoryStudioPage() {
  const [archive, setArchive] = useState<ArchiveData>(loadArchive());
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("canon");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [deletingSource, setDeletingSource] = useState(false);
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

  // ── Check Contradictions — per-subtab, local scan + manual resolution ────────
  const [showContradictions, setShowContradictions] = useState(false);
  const [contradictionCandidates, setContradictionCandidates] = useState<ContradictionCandidate[]>([]);
  const [contradictionIndex, setContradictionIndex] = useState(0);
  const [applyToAll, setApplyToAll] = useState(false);
  const [mergingContradiction, setMergingContradiction] = useState(false);
  const [resolvedCount, setResolvedCount] = useState(0);

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
      results.push(...canonResults.map((r: typeof canonResults[0]) => ({ ...r, accepted: true, subtab: "canon" as SubTab })));
    }

    // Verify player entries
    if ((a.playerEntries ?? []).length > 0) {
      const playerEntries = (a.playerEntries ?? []).map(e => ({ id: e.id, text: e.text, category: e.category }));
      const playerResults = await geminiVerifyCategories(playerEntries, ALL_CATS);
      results.push(...playerResults.map((r: typeof playerResults[0]) => ({ ...r, accepted: true, subtab: "player" as SubTab })));
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

  // ── Check Contradictions handlers ───────────────────────────────────────────
  function handleCheckContradictions() {
    const a = loadArchive();
    const entries = activeSubTab === "canon" ? a.entries : (a.playerEntries ?? []);
    const candidates = findContradictionCandidates(entries);
    setContradictionCandidates(candidates);
    setContradictionIndex(0);
    setApplyToAll(false);
    setResolvedCount(0);
    setShowContradictions(true);
  }

  async function handleResolve(action: "keep" | "replace" | "merge", keepId?: string) {
    const current = contradictionCandidates[contradictionIndex];
    if (!current) return;

    let a = loadArchive();

    if (action === "keep") {
      a = resolveContradictionKeep(a);
    } else if (action === "replace") {
      const finalKeepId = keepId ?? current.entryB.id;
      const removeId = finalKeepId === current.entryA.id ? current.entryB.id : current.entryA.id;
      a = resolveContradictionReplace(a, activeSubTab, finalKeepId, removeId);
    } else if (action === "merge") {
      setMergingContradiction(true);
      try {
        const mergedText = await geminiMergeContradiction(current.entryA.text, current.entryB.text, current.subject);
        a = resolveContradictionMerge(a, activeSubTab, current.entryA.id, current.entryB.id, mergedText);
      } catch {
        setMergingContradiction(false);
        alert("✗ Merge failed — check your Gemini key in Settings → AI");
        return;
      }
      setMergingContradiction(false);
    }

    const refreshed = regenerateMasterPrompt(a);
    saveArchive(refreshed);
    setArchive(refreshed);
    updateCounts(refreshed);
    setResolvedCount(prev => prev + 1);

    if (applyToAll) {
      // Apply the same action to all remaining candidates automatically.
      // For "replace", default to keeping entryB (the second/typically-later entry)
      // for every remaining pair, since there's no per-pair prompt once automated.
      const remaining = contradictionCandidates.slice(contradictionIndex + 1);
      let workingArchive = refreshed;
      for (const candidate of remaining) {
        if (action === "merge") {
          try {
            const mergedText = await geminiMergeContradiction(candidate.entryA.text, candidate.entryB.text, candidate.subject);
            workingArchive = resolveContradictionMerge(workingArchive, activeSubTab, candidate.entryA.id, candidate.entryB.id, mergedText);
          } catch { continue; }
        } else if (action === "replace") {
          workingArchive = resolveContradictionReplace(workingArchive, activeSubTab, candidate.entryB.id, candidate.entryA.id);
        }
        // "keep" applied to all remaining is a no-op, nothing to do per candidate
      }
      const finalArchive = regenerateMasterPrompt(workingArchive);
      saveArchive(finalArchive);
      setArchive(finalArchive);
      updateCounts(finalArchive);
      setResolvedCount(contradictionCandidates.length);
      setContradictionIndex(contradictionCandidates.length);
      return;
    }

    setContradictionIndex(prev => prev + 1);
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
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button onClick={handleCheckContradictions} disabled={total === 0}
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid #f59e0b", color: "#fbbf24", padding: "0.5rem 1rem", borderRadius: "0.5rem", cursor: total === 0 ? "default" : "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: total === 0 ? 0.5 : 1 }}>
            🔍 Check Contradictions
          </button>
          {hasGeminiKey() && (totalCanon > 0 || totalPlayer > 0) && (
            <button onClick={handleVerify} disabled={verifying}
              style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: verifying ? 0.6 : 1 }}>
              {verifying ? "✨ Checking..." : "✨ AI Verify Categories"}
            </button>
          )}
        </div>
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

      {/* Imported Sources dropdown — delete by source */}
      {(() => {
        const archive = loadArchive();
        const sources: ImportedSource[] = activeSubTab === "canon"
          ? (archive.importedCanonSources ?? [])
          : (archive.importedPlayerSources ?? []);
        if (sources.length === 0) return null;
        const sortedSources = [...sources].sort((a, b) => new Date(a.importedAt).getTime() - new Date(b.importedAt).getTime());
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.25rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.625rem 0.875rem" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--va-text-muted)", whiteSpace: "nowrap" }}>
              📥 Imported sources ({sortedSources.length}):
            </span>
            <select value={selectedSourceId} onChange={e => setSelectedSourceId(e.target.value)}
              style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.375rem 0.625rem", color: "var(--va-text)", fontSize: "0.8rem", outline: "none" }}>
              <option value="">Select a source to manage...</option>
              {sortedSources.map((s, i) => (
                <option key={s.id} value={s.id}>{i + 1}. {s.filename} ({s.entryCount} entries)</option>
              ))}
            </select>
            <button onClick={() => {
              if (!selectedSourceId) return;
              const source = sortedSources.find(s => s.id === selectedSourceId);
              if (!source) return;
              if (!confirm(`Delete all ${source.entryCount} entries from "${source.filename}"? The original reference file stays in ${activeSubTab === "canon" ? "Canon Archives" : "Inbox"} and can be re-imported anytime.`)) return;
              setDeletingSource(true);
              let arc = loadArchive();
              arc = activeSubTab === "canon" ? deleteCanonSource(arc, selectedSourceId) : deletePlayerSource(arc, selectedSourceId);
              saveArchive(regenerateMasterPrompt(arc));
              setSelectedSourceId("");
              setDeletingSource(false);
              window.location.reload();
            }} disabled={!selectedSourceId || deletingSource}
              style={{ background: "#b91c1c", color: "white", border: "none", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer", fontSize: "0.78rem", fontWeight: "600", opacity: (!selectedSourceId || deletingSource) ? 0.4 : 1, whiteSpace: "nowrap" }}>
              🗑️ Delete This Source
            </button>
          </div>
        );
      })()}

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

      {/* Check Contradictions modal */}
      {showContradictions && (() => {
        const current = contradictionCandidates[contradictionIndex];
        const done = contradictionIndex >= contradictionCandidates.length;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
            <div style={{ background: "var(--va-surface)", border: "1px solid #f59e0b", borderRadius: "0.75rem", width: "min(640px, 95vw)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#fbbf24", marginBottom: "0.2rem" }}>🔍 Check Contradictions — {activeSubTab === "canon" ? "Canon Story" : "Player Story"}</h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)" }}>
                    {contradictionCandidates.length === 0
                      ? "No potential contradictions found in this subtab."
                      : done ? `Resolved ${resolvedCount} of ${contradictionCandidates.length} pairs.` : `Pair ${contradictionIndex + 1} of ${contradictionCandidates.length}`}
                  </p>
                </div>
                <button onClick={() => setShowContradictions(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem" }}>×</button>
              </div>

              <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
                {contradictionCandidates.length === 0 ? (
                  <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
                    Nothing to review — this subtab's entries look consistent. This scan runs locally and costs nothing, so feel free to re-check anytime after new imports.
                  </p>
                ) : done ? (
                  <div style={{ textAlign: "center", padding: "2rem 0" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</p>
                    <p style={{ color: "var(--va-text)", fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.5rem" }}>All pairs reviewed</p>
                    <button onClick={() => setShowContradictions(false)}
                      style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                      Close
                    </button>
                  </div>
                ) : current ? (
                  <div>
                    <p style={{ fontSize: "0.72rem", color: "#fbbf24", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
                      Shared subject: {current.subject}
                    </p>

                    <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.875rem", marginBottom: "0.625rem" }}>
                      <p style={{ fontSize: "0.68rem", color: "var(--va-text-muted)", fontWeight: "600", marginBottom: "0.375rem" }}>ENTRY A</p>
                      <p style={{ fontSize: "0.875rem", color: "var(--va-text)", lineHeight: "1.5" }}>{current.entryA.text}</p>
                    </div>
                    <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.875rem", marginBottom: "1rem" }}>
                      <p style={{ fontSize: "0.68rem", color: "var(--va-text-muted)", fontWeight: "600", marginBottom: "0.375rem" }}>ENTRY B</p>
                      <p style={{ fontSize: "0.875rem", color: "var(--va-text)", lineHeight: "1.5" }}>{current.entryB.text}</p>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.875rem", flexWrap: "wrap" }}>
                      <button onClick={() => handleResolve("keep")} disabled={mergingContradiction}
                        style={{ flex: 1, background: "var(--va-border)", color: "var(--va-text)", padding: "0.55rem 0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem", minWidth: "120px" }}>
                        Keep Both
                      </button>
                      <button onClick={() => handleResolve("replace", current.entryA.id)} disabled={mergingContradiction}
                        style={{ flex: 1, background: "rgba(59,130,246,0.15)", border: "1px solid #3b82f6", color: "#93c5fd", padding: "0.55rem 0.75rem", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem", minWidth: "120px" }}>
                        Keep A, Remove B
                      </button>
                      <button onClick={() => handleResolve("replace", current.entryB.id)} disabled={mergingContradiction}
                        style={{ flex: 1, background: "rgba(59,130,246,0.15)", border: "1px solid #3b82f6", color: "#93c5fd", padding: "0.55rem 0.75rem", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem", minWidth: "120px" }}>
                        Keep B, Remove A
                      </button>
                      <button onClick={() => handleResolve("merge")} disabled={mergingContradiction}
                        style={{ flex: 1, background: "#7c3aed", color: "white", padding: "0.55rem 0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem", minWidth: "120px", opacity: mergingContradiction ? 0.6 : 1 }}>
                        {mergingContradiction ? "✨ Merging..." : "✨ Merge (AI)"}
                      </button>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--va-text-muted)" }}>
                      <input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                      Apply this same action to all remaining pairs ({contradictionCandidates.length - contradictionIndex - 1} left after this one)
                    </label>
                    {applyToAll && (
                      <p style={{ fontSize: "0.72rem", color: "#fbbf24", marginTop: "0.5rem" }}>
                        ⚠ For "Keep A/B, Remove" on remaining pairs, Entry B will be kept automatically (no per-pair choice once applied to all).
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}

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