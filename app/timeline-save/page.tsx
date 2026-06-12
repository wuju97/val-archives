"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadArchive, saveArchive,
  addTimelineSave, deleteTimelineSave, renameTimelineSave,
  addTimelineBranch, deleteTimelineBranch, renameTimelineBranch,
  setActiveTimeline, TimelineSave,
} from "@/lib/archiveEngine";

export default function TimelineSavePage() {
  const [archive, setArchive] = useState(loadArchive());
  const [newSaveName, setNewSaveName] = useState("");
  const [newSaveContent, setNewSaveContent] = useState("");
  const [showNewSave, setShowNewSave] = useState(false);
  // Branch creation state per save
  const [branchingFrom, setBranchingFrom] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchContent, setNewBranchContent] = useState("");
  // Expand/collapse
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => { setArchive(loadArchive()); }, []);

  const saves = archive.timelineSaves ?? [];
  const activeId = archive.activeTimelineId;

  function update(updated: typeof archive) {
    saveArchive(updated); setArchive(updated);
  }

  function handleAddSave() {
    if (!newSaveContent.trim()) return;
    const updated = addTimelineSave(archive, newSaveName, newSaveContent);
    update(updated);
    setNewSaveName(""); setNewSaveContent(""); setShowNewSave(false);
  }

  function handleAddBranch(saveId: string) {
    if (!newBranchContent.trim()) return;
    const updated = addTimelineBranch(archive, saveId, newBranchName, newBranchContent);
    update(updated);
    setBranchingFrom(null); setNewBranchName(""); setNewBranchContent("");
  }

  function handleSetActive(id: string) {
    const isAlreadyActive = activeId === id;
    update(setActiveTimeline(archive, isAlreadyActive ? null : id));
  }

  function handleRename(type: "save" | "branch", saveId: string, branchId?: string) {
    if (!renameValue.trim()) return;
    const updated = type === "save"
      ? renameTimelineSave(archive, saveId, renameValue)
      : renameTimelineBranch(archive, saveId, branchId!, renameValue);
    update(updated);
    setRenamingId(null); setRenameValue("");
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getItemById(id: string): { name: string; content: string } | null {
    for (const s of saves) {
      if (s.id === id) return s;
      for (const b of s.branches) {
        if (b.id === id) return b;
      }
    }
    return null;
  }

  const viewingItem = viewingContent ? getItemById(viewingContent) : null;

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
            <h1 style={{ fontSize: "1.75rem", fontWeight: "bold" }}>⏳ Timeline Save</h1>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem" }}>
              Saves stored intact · Branch into alternate timelines · 🟢 Active timeline feeds Master Prompt
            </p>
          </div>
        </div>
        <button onClick={() => setShowNewSave(!showNewSave)}
          style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
          + New Save
        </button>
      </div>

      <div style={{ flex: 1, padding: "1.5rem 2rem", maxWidth: "800px" }}>

        {/* New Save Form */}
        {showNewSave && (
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-accent)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <h3 style={{ fontWeight: "bold", marginBottom: "0.75rem", color: "var(--va-accent)" }}>💾 New Save</h3>
            <input value={newSaveName} onChange={(e) => setNewSaveName(e.target.value)}
              placeholder="Save name (e.g. 'After Diagon Alley — Year 1')"
              style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.625rem", boxSizing: "border-box" }} />
            <textarea value={newSaveContent} onChange={(e) => setNewSaveContent(e.target.value)}
              placeholder="Paste your session save here — the AI's output from your Save Prompt, or any text describing where you are in the story..."
              style={{ width: "100%", height: "180px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", marginBottom: "0.625rem", boxSizing: "border-box", lineHeight: "1.6" }} />
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button onClick={handleAddSave} disabled={!newSaveContent.trim()}
                style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !newSaveContent.trim() ? 0.3 : 1 }}>
                Save
              </button>
              <button onClick={() => { setShowNewSave(false); setNewSaveName(""); setNewSaveContent(""); }}
                style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {saves.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: "4rem" }}>
            <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</p>
            <p style={{ color: "var(--va-text-muted)", marginBottom: "0.5rem" }}>No saves yet.</p>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>
              Use the Save Prompt in Inbox to extract your session, then paste it here.
            </p>
          </div>
        )}

        {/* Save tree */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {saves.map(save => (
            <div key={save.id}>

              {/* Save row */}
              <div style={{ background: "var(--va-surface)", border: `1px solid ${activeId === save.id ? "#22c55e" : "var(--va-border)"}`, borderRadius: "0.625rem", overflow: "hidden", transition: "border-color 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem" }}>

                  {/* Green active button */}
                  <button onClick={() => handleSetActive(save.id)} title={activeId === save.id ? "Active — click to deactivate" : "Set as active timeline"}
                    style={{ width: "22px", height: "22px", borderRadius: "50%", border: `2px solid ${activeId === save.id ? "#22c55e" : "var(--va-border)"}`, background: activeId === save.id ? "#22c55e" : "transparent", cursor: "pointer", flexShrink: 0, padding: 0, transition: "all 0.15s" }} />

                  {/* Expand toggle */}
                  <button onClick={() => toggleExpand(save.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", padding: "0", width: "16px", flexShrink: 0 }}>
                    {expanded.has(save.id) ? "▼" : "▶"}
                  </button>

                  {/* Name / rename */}
                  {renamingId === save.id ? (
                    <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename("save", save.id); if (e.key === "Escape") setRenamingId(null); }}
                      autoFocus style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-accent)", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem" }} />
                  ) : (
                    <span style={{ flex: 1, fontWeight: "600", fontSize: "0.875rem", color: activeId === save.id ? "#22c55e" : "var(--va-text)" }}>
                      💾 {save.name}
                      {activeId === save.id && <span style={{ fontSize: "0.7rem", marginLeft: "0.5rem", color: "#22c55e", background: "rgba(34,197,94,0.15)", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>ACTIVE</span>}
                    </span>
                  )}

                  <span style={{ color: "var(--va-text-muted)", fontSize: "0.7rem", flexShrink: 0 }}>
                    {new Date(save.createdAt).toLocaleDateString()} · {save.branches.length} branch{save.branches.length !== 1 ? "es" : ""}
                  </span>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                    <button onClick={() => setViewingContent(save.id)} title="View content"
                      style={{ background: "var(--va-border)", border: "none", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.7rem" }}>View</button>
                    <button onClick={() => { setRenamingId(save.id); setRenameValue(save.name); }} title="Rename"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>✏️</button>
                    <button onClick={() => { setBranchingFrom(save.id); setNewBranchContent(save.content); setNewBranchName(""); }}
                      title="Create branch from this save"
                      style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", color: "#93c5fd", fontSize: "0.7rem", fontWeight: "600" }}>
                      + Branch
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${save.name}" and all its branches?`)) update(deleteTimelineSave(archive, save.id)); }} title="Delete"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>🗑️</button>
                  </div>
                </div>

                {/* Branch creation form */}
                {branchingFrom === save.id && (
                  <div style={{ borderTop: "1px solid var(--va-border)", padding: "0.875rem 1rem", background: "rgba(59,130,246,0.05)" }}>
                    <p style={{ fontSize: "0.8rem", color: "#93c5fd", marginBottom: "0.625rem", fontWeight: "600" }}>
                      🌿 New branch from "{save.name}"
                    </p>
                    <input value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="Branch name (e.g. 'What if Hermione refused to help?')"
                      style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                    <textarea value={newBranchContent} onChange={(e) => setNewBranchContent(e.target.value)}
                      placeholder="Paste the new branch save here — either a modified version of the parent save or a new save from a different point..."
                      style={{ width: "100%", height: "140px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => handleAddBranch(save.id)} disabled={!newBranchContent.trim()}
                        style={{ background: "#3b82f6", color: "white", padding: "0.4rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem", opacity: !newBranchContent.trim() ? 0.3 : 1 }}>
                        Save Branch
                      </button>
                      <button onClick={() => { setBranchingFrom(null); setNewBranchName(""); setNewBranchContent(""); }}
                        style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.4rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Branches (tree indented) */}
                {expanded.has(save.id) && save.branches.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--va-border)" }}>
                    {save.branches.map((branch, idx) => (
                      <div key={branch.id}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem 0.5rem 2.5rem", borderBottom: idx < save.branches.length - 1 ? "1px solid var(--va-border)" : "none", background: activeId === branch.id ? "rgba(34,197,94,0.05)" : "transparent" }}>

                        {/* Tree line indicator */}
                        <span style={{ color: "var(--va-text-muted)", fontSize: "0.75rem", flexShrink: 0 }}>└─</span>

                        {/* Green active button */}
                        <button onClick={() => handleSetActive(branch.id)} title={activeId === branch.id ? "Active — click to deactivate" : "Set as active timeline"}
                          style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${activeId === branch.id ? "#22c55e" : "var(--va-border)"}`, background: activeId === branch.id ? "#22c55e" : "transparent", cursor: "pointer", flexShrink: 0, padding: 0, transition: "all 0.15s" }} />

                        {/* Name */}
                        {renamingId === branch.id ? (
                          <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRename("branch", save.id, branch.id); if (e.key === "Escape") setRenamingId(null); }}
                            autoFocus style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-accent)", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", outline: "none", color: "var(--va-text)", fontSize: "0.8rem" }} />
                        ) : (
                          <span style={{ flex: 1, fontSize: "0.8rem", color: activeId === branch.id ? "#22c55e" : "var(--va-text-muted)" }}>
                            🌿 {branch.name}
                            {activeId === branch.id && <span style={{ fontSize: "0.65rem", marginLeft: "0.4rem", color: "#22c55e", background: "rgba(34,197,94,0.15)", padding: "0.1rem 0.35rem", borderRadius: "9999px" }}>ACTIVE</span>}
                          </span>
                        )}

                        <span style={{ color: "var(--va-text-muted)", fontSize: "0.65rem", flexShrink: 0 }}>{new Date(branch.createdAt).toLocaleDateString()}</span>

                        <button onClick={() => setViewingContent(branch.id)} title="View"
                          style={{ background: "var(--va-border)", border: "none", borderRadius: "0.25rem", padding: "0.15rem 0.4rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.65rem" }}>View</button>
                        <button onClick={() => { setRenamingId(branch.id); setRenameValue(branch.name); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.7rem" }}>✏️</button>
                        <button onClick={() => { if (confirm(`Delete branch "${branch.name}"?`)) update(deleteTimelineBranch(archive, save.id, branch.id)); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.7rem" }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expand toggle when there are branches but collapsed */}
                {save.branches.length > 0 && !expanded.has(save.id) && (
                  <button onClick={() => toggleExpand(save.id)}
                    style={{ width: "100%", padding: "0.375rem", background: "none", border: "none", borderTop: "1px solid var(--va-border)", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", textAlign: "center" }}>
                    ▶ Show {save.branches.length} branch{save.branches.length !== 1 ? "es" : ""}
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ marginTop: "2rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>How It Works</p>
          <div style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", lineHeight: "1.7", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <p>💾 <strong style={{ color: "var(--va-text)" }}>Save</strong> — paste your session save here, give it a name.</p>
            <p>🌿 <strong style={{ color: "var(--va-text)" }}>Branch</strong> — from any save, create an alternate timeline with different events.</p>
            <p>🟢 <strong style={{ color: "var(--va-text)" }}>Active</strong> — click the green button on any save or branch to make it active. Only one at a time. The active timeline feeds directly into your Master Prompt word-for-word.</p>
            <p>📋 Use the <strong style={{ color: "var(--va-text)" }}>Save Prompt</strong> in Inbox to extract a session from an AI, then paste it here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}