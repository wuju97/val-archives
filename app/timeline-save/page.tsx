"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasGeminiKey, hasGeminiQualityKey, hasGeminiQualityKey3, geminiCheckTimelineSeparation, geminiRefineTimelineSave } from "../../lib/geminiEngine";
import {
  loadArchive, saveArchive,
  addTimelineSave, deleteTimelineSave, renameTimelineSave,
  addTimelineBranch, deleteTimelineBranch, renameTimelineBranch,
  setActiveTimeline,
} from "@/lib/archiveEngine";

// ─── Color storage for timeline events ────────────────────────────────────────
const COLOR_KEY = "valArchivesTimelineColors";
function loadColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(COLOR_KEY) ?? "{}"); } catch { return {}; }
}
function saveColors(c: Record<string, string>) {
  localStorage.setItem(COLOR_KEY, JSON.stringify(c));
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f59e0b", "#6366f1", "#84cc16", "#06b6d4",
];

export default function TimelineSavePage() {
  const [archive, setArchive] = useState(loadArchive());
  const [activeTab, setActiveTab] = useState<"saves" | "visual">("saves");

  // ── Save/Branch state ──────────────────────────────────────────────────────
  const [newSaveName, setNewSaveName] = useState("");
  const [newSaveContent, setNewSaveContent] = useState("");
  const [showNewSave, setShowNewSave] = useState(false);
  const [branchingFrom, setBranchingFrom] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchContent, setNewBranchContent] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [checkingSeparation, setCheckingSeparation] = useState(false);

  // ── Visual timeline state ──────────────────────────────────────────────────
  const [colors, setColors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [newEventText, setNewEventText] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);

  useEffect(() => {
    setArchive(loadArchive());
    setColors(loadColors());
  }, []);

  const saves = archive.timelineSaves ?? [];
  const activeId = archive.activeTimelineId;

  function update(updated: typeof archive) { saveArchive(updated); setArchive(updated); }

  function updateColor(id: string, color: string) {
    const updated = { ...colors, [id]: color };
    setColors(updated);
    saveColors(updated);
    setColorPickerId(null);
  }

  function removeColor(id: string) {
    const updated = { ...colors };
    delete updated[id];
    setColors(updated);
    saveColors(updated);
  }

  // ── Timeline entries from Story Studio ────────────────────────────────────
  const timelineEntries = archive.entries.filter(e => e.category === "timeline-continuity");

  // Filter by search and color
  const filteredEntries = timelineEntries.filter(e => {
    const matchSearch = search.trim() === "" || e.text.toLowerCase().includes(search.toLowerCase());
    const matchColor = !filterColor || colors[e.id] === filterColor;
    return matchSearch && matchColor;
  });

  // Get all colors currently used
  const usedColors = [...new Set(Object.values(colors))];

  function handleAddSave() {
    if (!newSaveContent.trim()) return;
    update(addTimelineSave(archive, newSaveName, newSaveContent));
    setNewSaveName(""); setNewSaveContent(""); setShowNewSave(false);
  }

  function handleAddBranch(saveId: string) {
    if (!newBranchContent.trim()) return;
    update(addTimelineBranch(archive, saveId, newBranchName, newBranchContent));
    setBranchingFrom(null); setNewBranchName(""); setNewBranchContent("");
  }

  function handleSetActive(id: string) {
    update(setActiveTimeline(archive, activeId === id ? null : id));
  }

  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refineWarnings, setRefineWarnings] = useState<Record<string, string[]>>({});

  async function handleRefineSave(save: { id: string; name: string; content: string }) {
    setRefiningId(save.id);
    try {
      const otherSummaries = saves
        .filter(s => s.id !== save.id)
        .map(s => ({ name: s.name, snippet: s.content.slice(0, 300) }));
      const result = await geminiRefineTimelineSave(save.content, save.name, otherSummaries);
      const updatedSaves = archive.timelineSaves.map(s =>
        s.id === save.id ? { ...s, content: result.refined } : s
      );
      update({ ...archive, timelineSaves: updatedSaves });
      if (result.warnings.length > 0) {
        setRefineWarnings(prev => ({ ...prev, [save.id]: result.warnings }));
      } else {
        setRefineWarnings(prev => { const next = { ...prev }; delete next[save.id]; return next; });
      }
    } catch (e) {
      alert("✗ Refine failed: " + (e instanceof Error ? e.message : "error"));
    }
    setRefiningId(null);
  }

  function handleRename(type: "save" | "branch", saveId: string, branchId?: string) {
    if (!renameValue.trim()) return;
    update(type === "save" ? renameTimelineSave(archive, saveId, renameValue) : renameTimelineBranch(archive, saveId, branchId!, renameValue));
    setRenamingId(null); setRenameValue("");
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function getItemById(id: string) {
    for (const s of saves) {
      if (s.id === id) return s;
      for (const b of s.branches) { if (b.id === id) return b; }
    }
    return null;
  }

  const viewingItem = viewingContent ? getItemById(viewingContent) : null;

  const S = {
    surface: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.625rem" },
    input: { background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", width: "100%", boxSizing: "border-box" as const },
    btn: { border: "none", cursor: "pointer", borderRadius: "0.375rem", fontWeight: "600" as const, fontSize: "0.875rem" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", display: "flex", flexDirection: "column" }}>

      {/* View Content Modal */}
      {viewingContent && viewingItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1.5rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.5rem", width: "100%", maxWidth: "56rem", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontWeight: "bold", fontSize: "1rem" }}>📄 {viewingItem.name}</h3>
              <button onClick={() => setViewingContent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem" }}>×</button>
            </div>
            <pre style={{ flex: 1, overflowY: "auto", fontSize: "0.8rem", fontFamily: "monospace", color: "var(--va-text-muted)", whiteSpace: "pre-wrap", lineHeight: "1.7", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", margin: 0 }}>
              {viewingItem.content}
            </pre>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "1.25rem 2rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>← Home</Link>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "bold" }}>⏳ Timeline</h1>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem" }}>Session saves · Visual timeline · Branch into alternate histories</p>
          </div>
        </div>
        {activeTab === "saves" && (
          <button onClick={() => setShowNewSave(!showNewSave)}
            style={{ ...S.btn, background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem" }}>
            + New Save
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 2rem", borderBottom: "1px solid var(--va-border)", display: "flex", gap: "0" }}>
        {([["saves", "💾 Session Saves"], ["visual", "📅 Visual Timeline"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "0.75rem 1.25rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: activeTab === tab ? "700" : "400", color: activeTab === tab ? "var(--va-accent)" : "var(--va-text-muted)", borderBottom: activeTab === tab ? "2px solid var(--va-accent)" : "2px solid transparent", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SESSION SAVES TAB ────────────────────────────────────────────────── */}
      {activeTab === "saves" && (
        <div style={{ flex: 1, padding: "1.5rem 2rem", maxWidth: "800px" }}>

          {showNewSave && (
            <div style={{ ...S.surface, border: "1px solid var(--va-accent)", padding: "1.25rem", marginBottom: "1.5rem" }}>
              <h3 style={{ fontWeight: "bold", marginBottom: "0.75rem", color: "var(--va-accent)" }}>💾 New Save</h3>
              <input value={newSaveName} onChange={e => setNewSaveName(e.target.value)} placeholder="Save name (e.g. 'After Diagon Alley — Year 1')" style={{ ...S.input, marginBottom: "0.625rem" }} />
              <textarea value={newSaveContent} onChange={e => setNewSaveContent(e.target.value)}
                placeholder="Paste your session save here..."
                style={{ ...S.input, height: "180px", resize: "vertical", lineHeight: "1.6", marginBottom: "0.625rem" }} />
              <div style={{ display: "flex", gap: "0.625rem" }}>
                <button onClick={handleAddSave} disabled={!newSaveContent.trim()} style={{ ...S.btn, background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", opacity: !newSaveContent.trim() ? 0.3 : 1 }}>Save</button>
                <button onClick={() => { setShowNewSave(false); setNewSaveName(""); setNewSaveContent(""); }} style={{ ...S.btn, background: "var(--va-border)", color: "var(--va-text)", padding: "0.5rem 1.25rem" }}>Cancel</button>
              </div>
            </div>
          )}

          {saves.length === 0 && !showNewSave && (
            <div style={{ textAlign: "center", paddingTop: "4rem" }}>
              <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</p>
              <p style={{ color: "var(--va-text-muted)" }}>No saves yet. Click + New Save to get started.</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {saves.map(save => (
              <div key={save.id}>
                <div style={{ ...S.surface, border: `1px solid ${activeId === save.id ? "#22c55e" : "var(--va-border)"}`, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem" }}>
                    <button onClick={() => handleSetActive(save.id)} title={activeId === save.id ? "Active — click to deactivate" : "Set active"}
                      style={{ width: "22px", height: "22px", borderRadius: "50%", border: `2px solid ${activeId === save.id ? "#22c55e" : "var(--va-border)"}`, background: activeId === save.id ? "#22c55e" : "transparent", cursor: "pointer", flexShrink: 0, padding: 0 }} />
                    <button onClick={() => toggleExpand(save.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", width: "16px", flexShrink: 0 }}>
                      {expanded.has(save.id) ? "▼" : "▶"}
                    </button>
                    {renamingId === save.id ? (
                      <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleRename("save", save.id); if (e.key === "Escape") setRenamingId(null); }}
                        autoFocus style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-accent)", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem" }} />
                    ) : (
                      <span style={{ flex: 1, fontWeight: "600", fontSize: "0.875rem", color: activeId === save.id ? "#22c55e" : "var(--va-text)" }}>
                        💾 {save.name}
                        {activeId === save.id && <span style={{ fontSize: "0.7rem", marginLeft: "0.5rem", color: "#22c55e", background: "rgba(34,197,94,0.15)", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>ACTIVE</span>}
                      </span>
                    )}
                    <span style={{ color: "var(--va-text-muted)", fontSize: "0.7rem", flexShrink: 0 }}>{new Date(save.createdAt).toLocaleDateString()} · {save.branches.length} branch{save.branches.length !== 1 ? "es" : ""}</span>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button onClick={() => setViewingContent(save.id)} style={{ background: "var(--va-border)", border: "none", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.7rem" }}>View</button>
                      {(hasGeminiKey() || hasGeminiQualityKey() || hasGeminiQualityKey3()) && (
                        <button onClick={() => handleRefineSave(save)} disabled={refiningId === save.id}
                          style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", color: "#c4b5fd", fontSize: "0.7rem", fontWeight: "600", opacity: refiningId === save.id ? 0.5 : 1 }}>
                          {refiningId === save.id ? "✨ Refining..." : "✨ AI Refine"}
                        </button>
                      )}
                      <button onClick={() => { setRenamingId(save.id); setRenameValue(save.name); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>✏️</button>
                      <button onClick={() => { setBranchingFrom(save.id); setNewBranchContent(save.content); setNewBranchName(""); }}
                        style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", color: "#93c5fd", fontSize: "0.7rem", fontWeight: "600" }}>+ Branch</button>
                      <button onClick={() => { if (confirm(`Delete "${save.name}" and all branches?`)) update(deleteTimelineSave(archive, save.id)); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>🗑️</button>
                    </div>
                  </div>

                  {refineWarnings[save.id] && refineWarnings[save.id].length > 0 && (
                    <div style={{ borderTop: "1px solid var(--va-border)", padding: "0.625rem 1rem", background: "rgba(251,191,36,0.08)" }}>
                      <p style={{ fontSize: "0.75rem", color: "#fbbf24", fontWeight: "600", marginBottom: "0.25rem" }}>⚠️ Possible continuity notes:</p>
                      {refineWarnings[save.id].map((w, i) => (
                        <p key={i} style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", margin: "0.125rem 0" }}>• {w}</p>
                      ))}
                    </div>
                  )}

                  {branchingFrom === save.id && (
                    <div style={{ borderTop: "1px solid var(--va-border)", padding: "0.875rem 1rem", background: "rgba(59,130,246,0.05)" }}>
                      <p style={{ fontSize: "0.8rem", color: "#93c5fd", marginBottom: "0.625rem", fontWeight: "600" }}>🌿 New branch from "{save.name}"</p>
                      <input value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="Branch name" style={{ ...S.input, marginBottom: "0.5rem" }} />
                      <textarea value={newBranchContent} onChange={e => setNewBranchContent(e.target.value)} placeholder="Paste branch save..." style={{ ...S.input, height: "140px", resize: "vertical", marginBottom: "0.5rem" }} />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => handleAddBranch(save.id)} disabled={!newBranchContent.trim()} style={{ ...S.btn, background: "#3b82f6", color: "white", padding: "0.4rem 1rem", opacity: !newBranchContent.trim() ? 0.3 : 1 }}>Save Branch</button>
                        <button onClick={() => { setBranchingFrom(null); setNewBranchName(""); setNewBranchContent(""); }} style={{ ...S.btn, background: "var(--va-border)", color: "var(--va-text)", padding: "0.4rem 1rem" }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {expanded.has(save.id) && save.branches.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--va-border)" }}>
                      {save.branches.map((branch, idx) => (
                        <div key={branch.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem 0.5rem 2.5rem", borderBottom: idx < save.branches.length - 1 ? "1px solid var(--va-border)" : "none", background: activeId === branch.id ? "rgba(34,197,94,0.05)" : "transparent" }}>
                          <span style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>└─</span>
                          <button onClick={() => handleSetActive(branch.id)} style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${activeId === branch.id ? "#22c55e" : "var(--va-border)"}`, background: activeId === branch.id ? "#22c55e" : "transparent", cursor: "pointer", flexShrink: 0, padding: 0 }} />
                          {renamingId === branch.id ? (
                            <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleRename("branch", save.id, branch.id); if (e.key === "Escape") setRenamingId(null); }}
                              autoFocus style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-accent)", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", outline: "none", color: "var(--va-text)", fontSize: "0.8rem" }} />
                          ) : (
                            <span style={{ flex: 1, fontSize: "0.8rem", color: activeId === branch.id ? "#22c55e" : "var(--va-text-muted)" }}>
                              🌿 {branch.name}
                              {activeId === branch.id && <span style={{ fontSize: "0.65rem", marginLeft: "0.4rem", color: "#22c55e", background: "rgba(34,197,94,0.15)", padding: "0.1rem 0.35rem", borderRadius: "9999px" }}>ACTIVE</span>}
                            </span>
                          )}
                          <span style={{ color: "var(--va-text-muted)", fontSize: "0.65rem" }}>{new Date(branch.createdAt).toLocaleDateString()}</span>
                          <button onClick={() => setViewingContent(branch.id)} style={{ background: "var(--va-border)", border: "none", borderRadius: "0.25rem", padding: "0.15rem 0.4rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.65rem" }}>View</button>
                          <button onClick={() => { setRenamingId(branch.id); setRenameValue(branch.name); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.7rem" }}>✏️</button>
                          <button onClick={() => { if (confirm(`Delete branch "${branch.name}"?`)) update(deleteTimelineBranch(archive, save.id, branch.id)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.7rem" }}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {save.branches.length > 0 && !expanded.has(save.id) && (
                    <button onClick={() => toggleExpand(save.id)} style={{ width: "100%", padding: "0.375rem", background: "none", border: "none", borderTop: "1px solid var(--va-border)", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", textAlign: "center" }}>
                      ▶ Show {save.branches.length} branch{save.branches.length !== 1 ? "es" : ""}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "2rem", ...S.surface, padding: "1rem" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>How It Works</p>
            <div style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", lineHeight: "1.7" }}>
              <p>💾 <strong style={{ color: "var(--va-text)" }}>Save</strong> — paste your session save, give it a name.</p>
              <p>🌿 <strong style={{ color: "var(--va-text)" }}>Branch</strong> — create alternate timelines from any save.</p>
              <p>🟢 <strong style={{ color: "var(--va-text)" }}>Active</strong> — the active save feeds directly into your Master Prompt.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── VISUAL TIMELINE TAB ──────────────────────────────────────────────── */}
      {activeTab === "visual" && (
        <div style={{ flex: 1, padding: "1.5rem 2rem", maxWidth: "900px" }}>

          {/* Controls */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..."
              style={{ ...S.input, flex: 1, minWidth: "180px" }} />

            {/* Color filter */}
            {usedColors.length > 0 && (
              <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Filter:</span>
                {usedColors.map(color => (
                  <button key={color} onClick={() => setFilterColor(filterColor === color ? null : color)}
                    style={{ width: "20px", height: "20px", borderRadius: "50%", background: color, border: filterColor === color ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />
                ))}
                {filterColor && (
                  <button onClick={() => setFilterColor(null)} style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", background: "none", border: "none", cursor: "pointer" }}>Clear ×</button>
                )}
              </div>
            )}

            <span style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", flexShrink: 0 }}>
              {filteredEntries.length} event{filteredEntries.length !== 1 ? "s" : ""}
            </span>
          </div>

          {timelineEntries.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: "4rem" }}>
              <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</p>
              <p style={{ color: "var(--va-text-muted)", marginBottom: "0.5rem" }}>No timeline events yet.</p>
              <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>
                Add entries to the <strong>Timeline & Continuity</strong> category in Story Studio — they'll appear here automatically.
              </p>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {/* Vertical line */}
              <div style={{ position: "absolute", left: "19px", top: 0, bottom: 0, width: "2px", background: "var(--va-border)", zIndex: 0 }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {filteredEntries.map((entry, i) => {
                  const color = colors[entry.id];
                  const isExpanded = expandedEvent === entry.id;
                  const isColorPicking = colorPickerId === entry.id;

                  // Strip [SubTag] prefix for display
                  const displayText = entry.text.replace(/^\[[^\]]+\] /, "");

                  return (
                    <div key={entry.id} style={{ display: "flex", gap: "0", alignItems: "flex-start", position: "relative", zIndex: 1, paddingBottom: "0.75rem" }}>
                      {/* Dot */}
                      <div style={{ flexShrink: 0, width: "40px", display: "flex", justifyContent: "center", paddingTop: "0.875rem" }}>
                        <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: color || "var(--va-border)", border: `2px solid ${color || "var(--va-border)"}`, boxShadow: color ? `0 0 8px ${color}66` : "none", transition: "all 0.2s" }} />
                      </div>

                      {/* Card */}
                      <div style={{ flex: 1, background: "var(--va-surface)", border: `1px solid ${color ? color + "44" : "var(--va-border)"}`, borderRadius: "0.625rem", padding: "0.75rem 1rem", marginLeft: "0.5rem", borderLeft: color ? `3px solid ${color}` : "1px solid var(--va-border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                          <p style={{ fontSize: "0.875rem", color: "var(--va-text)", lineHeight: "1.5", flex: 1, cursor: "pointer" }}
                            onClick={() => setExpandedEvent(isExpanded ? null : entry.id)}>
                            {isExpanded ? displayText : (displayText.length > 120 ? displayText.slice(0, 120) + "..." : displayText)}
                          </p>
                          <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0, alignItems: "center" }}>
                            {/* Color button */}
                            <div style={{ position: "relative" }}>
                              <button onClick={() => setColorPickerId(isColorPicking ? null : entry.id)}
                                style={{ width: "20px", height: "20px", borderRadius: "50%", background: color || "var(--va-border)", border: "2px solid var(--va-border)", cursor: "pointer" }}
                                title="Set color" />
                              {isColorPicking && (
                                <div style={{ position: "absolute", right: 0, top: "24px", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.625rem", zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", width: "160px" }}>
                                  <p style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", marginBottom: "0.5rem" }}>Pick color</p>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.5rem" }}>
                                    {PRESET_COLORS.map(c => (
                                      <button key={c} onClick={() => updateColor(entry.id, c)}
                                        style={{ width: "20px", height: "20px", borderRadius: "50%", background: c, border: color === c ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />
                                    ))}
                                  </div>
                                  <input type="color" value={color || "#3b82f6"} onChange={e => updateColor(entry.id, e.target.value)}
                                    style={{ width: "100%", height: "28px", cursor: "pointer", border: "1px solid var(--va-border)", borderRadius: "0.25rem", background: "var(--va-bg)" }} />
                                  {color && (
                                    <button onClick={() => { removeColor(entry.id); setColorPickerId(null); }}
                                      style={{ marginTop: "0.375rem", width: "100%", background: "none", border: "1px solid var(--va-border)", borderRadius: "0.25rem", padding: "0.2rem", cursor: "pointer", fontSize: "0.7rem", color: "var(--va-text-muted)" }}>
                                      Remove color
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Entry number + date */}
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.375rem", alignItems: "center" }}>
                          <span style={{ fontSize: "0.68rem", color: "var(--va-text-muted)" }}>#{i + 1}</span>
                          <span style={{ fontSize: "0.68rem", color: "var(--va-text-muted)" }}>·</span>
                          <span style={{ fontSize: "0.68rem", color: "var(--va-text-muted)" }}>{new Date(entry.updatedAt).toLocaleDateString()}</span>
                          {displayText.length > 120 && (
                            <button onClick={() => setExpandedEvent(isExpanded ? null : entry.id)}
                              style={{ fontSize: "0.68rem", color: "var(--va-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto" }}>
                              {isExpanded ? "Show less ▲" : "Show more ▼"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {timelineEntries.length > 0 && (
            <div style={{ marginTop: "1.5rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.625rem", padding: "0.875rem 1rem", fontSize: "0.8rem", color: "var(--va-text-muted)" }}>
              💡 Click the color dot on any event to assign a color. Use colors to group by era, character, event type, or anything you want. Filter by color using the circles at the top.
              Events come from the <strong style={{ color: "var(--va-text)" }}>Timeline & Continuity</strong> category in Story Studio.
            </div>
          )}
        </div>
      )}
    </div>
  );
}