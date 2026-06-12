"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadArchive, saveArchive, addEntry, updateEntry, deleteEntry,
  regenerateMasterPrompt, getPriorityLevel, setPriority,
} from "@/lib/archiveEngine";
import { hasGeminiKey, geminiEnhanceRule, geminiOrganizeRules } from "@/lib/geminiEngine";

export default function RuleBookPage() {
  const [archive, setArchive] = useState(loadArchive());
  const [input, setInput] = useState("");
  const [organizing, setOrganizing] = useState(false);
  const [organizeResult, setOrganizeResult] = useState("");
  const [added, setAdded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { setArchive(loadArchive()); }, []);

  const rules = archive.entries.filter(e => e.category === "rules");
  const filtered = rules.filter(e =>
    search.trim() === "" || e.text.toLowerCase().includes(search.toLowerCase())
  );

  const priority = getPriorityLevel(archive, "rulebook");

  function handlePriorityClick() {
    const current = getPriorityLevel(archive, "rulebook");
    let updated;
    if (current === "none") updated = setPriority(archive, "rulebook", "blue");
    else if (current === "blue") updated = setPriority(archive, "rulebook", "red");
    else updated = setPriority(archive, "rulebook", "none");
    saveArchive(updated);
    setArchive(updated);
  }

  function handleAdd() {
    if (!input.trim()) return;
    const updated = regenerateMasterPrompt(addEntry(archive, input.trim(), "rules"));
    saveArchive(updated); setArchive(updated); setInput(""); setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function saveEdit(id: string) {
    if (!editingText.trim()) return;
    const updated = regenerateMasterPrompt(updateEntry(archive, id, editingText));
    saveArchive(updated); setArchive(updated); setEditingId(null); setEditingText("");
  }

  function doDelete(id: string) {
    const updated = regenerateMasterPrompt(deleteEntry(archive, id));
    saveArchive(updated); setArchive(updated); setDeleteConfirmId(null);
  }

  const priorityColor = priority === "red" ? "#ef4444" : priority === "blue" ? "#3b82f6" : "var(--va-border)";
  const priorityLabel = priority === "red" ? "🔴 First Priority" : priority === "blue" ? "🔵 Second Priority" : "Set Priority";

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>
      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "2.5rem" }}>📋</span>
          <div>
            <h1 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>Rule Book</h1>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>
              {rules.length} rules · Used by Master Prompt and Custom Prompt as first priority
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {hasGeminiKey() && rules.length > 1 && (
            <button onClick={async () => {
              setOrganizing(true); setOrganizeResult("");
              const ruleTexts = rules.map((r: { text: string }) => r.text);
              const { organized, summary } = await geminiOrganizeRules(ruleTexts);
              const nonRules = archive.entries.filter((e: { category: string }) => e.category !== "rules");
              const organizedEntries = organized.map((text: string) => ({
                id: crypto.randomUUID(), text, category: "rules" as const,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
              }));
              const updatedArchive = { ...archive, entries: [...nonRules, ...organizedEntries] };
              const refreshed = regenerateMasterPrompt(updatedArchive);
              saveArchive(refreshed); setArchive(refreshed);
              setOrganizeResult(summary || "Rules organized");
              setOrganizing(false);
            }} disabled={organizing}
            style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: organizing ? 0.6 : 1 }}>
              {organizing ? "✨ Organizing..." : "✨ AI Organize"}
            </button>
          )}
          <button
            onClick={handlePriorityClick}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: `2px solid ${priorityColor}`, background: priority !== "none" ? priorityColor : "transparent", color: priority !== "none" ? "white" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", transition: "all 0.2s" }}>
            {priorityLabel}
          </button>
        </div>
      </div>

      <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem", marginBottom: "1.5rem", fontSize: "0.875rem", color: "var(--va-text-muted)" }}>
        Rules stored here are automatically used by the Master Prompt and Custom Prompt as the foundational layer.
        Any rule detected in the Inbox is automatically routed here. Rules take precedence over all other content in prompts.
      </div>

      {/* Add rule */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add a rule... e.g. 'Never railroad the player. Always respect player choices.'"
            style={{ flex: 1, background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem" }} />
          <button onClick={handleAdd} disabled={!input.trim()}
            style={{ background: "var(--va-accent)", color: "white", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !input.trim() ? 0.3 : 1 }}>
            Add Rule
          </button>
          {hasGeminiKey() && input.trim() && (
            <button onClick={async () => { const enhanced = await geminiEnhanceRule(input); setInput(enhanced); }}
              style={{ background: "#7c3aed", color: "white", padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
              ✨
            </button>
          )}
        </div>
        {added && <p style={{ color: "#4ade80", fontSize: "0.875rem", marginTop: "0.25rem" }}>✓ Rule added</p>}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rules..."
        style={{ width: "100%", maxWidth: "28rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem", boxSizing: "border-box" }} />

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: "3rem" }}>
          <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</p>
          <p style={{ color: "var(--va-text-muted)" }}>{rules.length === 0 ? "No rules yet. Add your first rule above or import via Inbox." : "No rules match your search."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filtered.map((entry, i) => (
            <div key={entry.id} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>Rule {i + 1}</span>
                {editingId !== entry.id && deleteConfirmId !== entry.id && (
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button onClick={() => { setEditingId(entry.id); setEditingText(entry.text); }} style={{ color: "var(--va-text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>✏️ Edit</button>
                    <button onClick={() => setDeleteConfirmId(entry.id)} style={{ color: "var(--va-text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>🗑️ Delete</button>
                  </div>
                )}
              </div>
              {editingId === entry.id ? (
                <div>
                  <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)}
                    style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", minHeight: "80px", boxSizing: "border-box" }} autoFocus />
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button onClick={() => saveEdit(entry.id)} style={{ background: "#15803d", color: "white", padding: "0.25rem 0.75rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>✓ Save</button>
                    <button onClick={() => setEditingId(null)} style={{ color: "var(--va-text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
                  </div>
                </div>
              ) : deleteConfirmId === entry.id ? (
                <div>
                  <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }}>{entry.text}</p>
                  <div style={{ background: "rgba(127,29,29,0.3)", border: "1px solid #7f1d1d", borderRadius: "0.375rem", padding: "0.75rem" }}>
                    <p style={{ color: "#fca5a5", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Delete this rule?</p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => doDelete(entry.id)} style={{ background: "#b91c1c", color: "white", padding: "0.25rem 0.75rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ color: "var(--va-text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: "0.875rem", whiteSpace: "pre-wrap", color: "var(--va-text)" }}>{entry.text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}