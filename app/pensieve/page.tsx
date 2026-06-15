"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  hasGeminiKey, hasGeminiQualityKey, hasDeepSeekKey,
  geminiSemanticSearch, geminiPensieveFinalAnswer,
} from "../../lib/geminiEngine";
import {
  loadArchive, loadArchiveAsync, saveArchive, updateEntry, deleteEntry,
  regenerateMasterPrompt, CATEGORY_LABELS, CATEGORY_ICONS, StoryCategory,
} from "@/lib/archiveEngine";

// ─── Stage 1: Cerebras keyword pre-filter (no API call) ───────────────────────
function keywordPreFilter(
  query: string,
  entries: Array<{ id: string; text: string; category: string }>
): Array<{ id: string; text: string; category: string }> {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return entries.slice(0, 150);

  const scored = entries.map(e => {
    const lower = e.text.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (lower.includes(word)) score += 2;
      // Partial match
      for (const w of lower.split(/\s+/)) {
        if (w.startsWith(word.slice(0, 4)) && word.length > 4) score += 1;
      }
    }
    return { ...e, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 150)
    .filter(e => e.score > 0 || scored.length <= 150);
}

export default function PensievePage() {
  const [archive, setArchive] = useState(loadArchive());
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<StoryCategory | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<Array<{ id: string; text: string; category: string; relevance: string }> | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiStage, setAiStage] = useState<"idle" | "filtering" | "investigating" | "answering">("idle");
  const [aiMode, setAiMode] = useState(false);
  const [pensieveSubTab, setPensieveSubTab] = useState<"all" | "canon" | "player">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const sync = loadArchive();
    if (sync.entries.length > 0) {
      setArchive(sync);
    } else {
      loadArchiveAsync().then(data => { if (data) setArchive(data); });
    }
  }, []);

  const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as StoryCategory[];
  // Combine both subtabs for display
  const allVaultEntries = [
    ...archive.entries.map(e => ({ ...e, subtab: "canon" as const })),
    ...((archive.playerEntries ?? []).map(e => ({ ...e, subtab: "player" as const }))),
  ];

  const categoryCounts: Partial<Record<StoryCategory, number>> = {};
  for (const entry of allVaultEntries) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1;
  }

  const entries = allVaultEntries
    .filter(entry => {
      const matchesSearch = search.trim() === "" || entry.text.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
      const matchesSubTab = pensieveSubTab === "all" || entry.subtab === pensieveSubTab;
      return matchesSearch && matchesCategory && matchesSubTab;
    })
    .sort((a, b) => sortOrder === "newest"
      ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    );

  // ─── Three-stage Pensieve Pipeline ─────────────────────────────────────────
  async function runPensieveSearch() {
    if (!aiQuery.trim()) return;
    setAiSearching(true);
    setAiMode(true);
    setAiResults(null);
    setAiAnswer(null);

    // Include both Canon Story and Player Story entries with subtab label
    const canonEntries = archive.entries.map(e => ({ id: e.id, text: e.text, category: e.category, subtab: "canon" as const }));
    const playerEntries = (archive.playerEntries ?? []).map(e => ({ id: e.id, text: e.text, category: e.category, subtab: "player" as const }));
    const allEntries = [...canonEntries, ...playerEntries];

    // Stage 1 — Cerebras: keyword pre-filter (instant, no API)
    setAiStage("filtering");
    const candidates = keywordPreFilter(aiQuery, allEntries);

    if (candidates.length === 0) {
      setAiResults([]);
      setAiAnswer("No entries in the vault match your query. Try adding more content via Inbox or Story Studio.");
      setAiSearching(false);
      setAiStage("idle");
      return;
    }

    // Stage 2 — DeepSeek: Pensieve Investigation
    setAiStage("investigating");
    let investigated: Array<{ id: string; text: string; category: string; relevance: string }> = [];
    if (hasDeepSeekKey() || hasGeminiKey()) {
      investigated = await geminiSemanticSearch(aiQuery, candidates);
    } else {
      // No AI key — use keyword matches directly
      investigated = candidates.slice(0, 20).map(e => ({ ...e, relevance: "Keyword match" }));
    }

    setAiResults(investigated);

    // Stage 3 — Gemini: final narrative answer
    if (investigated.length > 0 && hasGeminiQualityKey()) {
      setAiStage("answering");
      const answer = await geminiPensieveFinalAnswer(aiQuery, investigated);
      setAiAnswer(answer);
    } else if (investigated.length === 0) {
      setAiAnswer("The investigation found no relevant entries for this query.");
    }

    setAiSearching(false);
    setAiStage("idle");
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

  const stageLabel = {
    idle: "",
    filtering: "⚡ Stage 1 — Scanning vault...",
    investigating: "🧠 Stage 2 — Investigating...",
    answering: "✨ Stage 3 — Composing answer...",
  }[aiStage];

  const S = {
    page: { minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" },
    surface: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem" },
    input: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", width: "100%" },
    select: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", width: "100%" },
    muted: { color: "var(--va-text-muted)" },
  };

  return (
    <div style={S.page}>
      <Link href="/dashboard" style={{ ...S.muted, fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>
      <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>🌀 Pensieve</h1>
      <p style={{ ...S.muted, marginBottom: "1rem" }}>{archive.entries.length + (archive.playerEntries ?? []).length} total memories — {archive.entries.length} canon · {(archive.playerEntries ?? []).length} player</p>

      {/* Subtab filter */}
      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.5rem" }}>
        {(["all", "canon", "player"] as const).map(tab => (
          <button key={tab} onClick={() => setPensieveSubTab(tab)}
            style={{ padding: "0.375rem 0.875rem", borderRadius: "0.5rem", border: "none", background: pensieveSubTab === tab ? (tab === "canon" ? "#3b82f6" : tab === "player" ? "#7c3aed" : "var(--va-accent)") : "var(--va-surface)", color: pensieveSubTab === tab ? "white" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.8rem", fontWeight: pensieveSubTab === tab ? "700" : "400" }}>
            {tab === "all" ? "🔍 All" : tab === "canon" ? "📖 Canon Story" : "🎮 Player Story"}
          </button>
        ))}
      </div>

      {/* ── Pensieve AI Search ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input value={aiQuery}
            onChange={e => { setAiQuery(e.target.value); if (!e.target.value.trim()) { setAiResults(null); setAiAnswer(null); setAiMode(false); } }}
            onKeyDown={e => { if (e.key === "Enter") runPensieveSearch(); }}
            placeholder="✨ Ask anything — e.g. What do I know about Hermione?"
            style={{ flex: 1, background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem" }} />
          <button onClick={runPensieveSearch} disabled={!aiQuery.trim() || aiSearching}
            style={{ background: "#7c3aed", color: "white", padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: (!aiQuery.trim() || aiSearching) ? 0.5 : 1, whiteSpace: "nowrap" }}>
            {aiSearching ? "Searching..." : "✨ AI Search"}
          </button>
          {aiMode && (
            <button onClick={() => { setAiMode(false); setAiResults(null); setAiAnswer(null); setAiQuery(""); setAiStage("idle"); }}
              style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.625rem 0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
              Clear
            </button>
          )}
        </div>

        {/* Stage indicator */}
        {aiSearching && stageLabel && (
          <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid #7c3aed", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontSize: "0.78rem", color: "#c4b5fd" }}>{stageLabel}</p>
          </div>
        )}

        {/* Gemini narrative answer */}
        {aiMode && aiAnswer && (
          <div style={{ marginTop: "1rem", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "0.75rem", padding: "1.125rem" }}>
            <p style={{ fontSize: "0.72rem", color: "#c4b5fd", fontWeight: "700", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>✨ The Archivist</p>
            <p style={{ fontSize: "0.9rem", color: "var(--va-text)", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>{aiAnswer}</p>
          </div>
        )}

        {/* Evidence entries */}
        {aiMode && aiResults !== null && aiResults.length > 0 && (
          <div style={{ marginTop: "0.75rem" }}>
            <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🧠 Evidence — {aiResults.length} relevant {aiResults.length === 1 ? "entry" : "entries"} found
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {aiResults.map(result => (
                <div key={result.id} style={{ background: "var(--va-surface)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "0.625rem", padding: "0.875rem", borderLeft: "3px solid #7c3aed" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.68rem", color: "#c4b5fd", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {CATEGORY_ICONS[result.category as StoryCategory] ?? "📄"} {CATEGORY_LABELS[result.category as StoryCategory] ?? result.category}
                    </span>
                    {(result as any).subtab && (
                      <span style={{ fontSize: "0.62rem", padding: "0.1rem 0.35rem", borderRadius: "9999px", background: (result as any).subtab === "canon" ? "rgba(59,130,246,0.15)" : "rgba(124,58,237,0.15)", color: (result as any).subtab === "canon" ? "#3b82f6" : "#c4b5fd" }}>
                        {(result as any).subtab === "canon" ? "📖 Canon" : "🎮 Player"}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.875rem", color: "var(--va-text)", lineHeight: "1.6", margin: "0.375rem 0 0.25rem" }}>{result.text}</p>
                  <p style={{ fontSize: "0.72rem", color: "#7c3aed", fontStyle: "italic" }}>↳ {result.relevance}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {aiMode && aiResults !== null && aiResults.length === 0 && !aiSearching && (
          <p style={{ fontSize: "0.78rem", color: "var(--va-text-muted)", marginTop: "0.5rem" }}>
            ✨ No relevant entries found for this query.
          </p>
        )}
      </div>

      {/* ── Regular search + filters ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memories..." style={S.input} />
        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value as StoryCategory | "all")} style={S.select}>
          <option value="all">All Categories ({archive.entries.length})</option>
          {ALL_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}{(categoryCounts[cat] ?? 0) > 0 ? ` (${categoryCounts[cat]})` : ""}</option>
          ))}
        </select>
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as "newest" | "oldest")} style={S.select}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {(search || selectedCategory !== "all") && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <p style={{ ...S.muted, fontSize: "0.875rem" }}>
            Showing <strong style={{ color: "var(--va-text)" }}>{entries.length}</strong> results
            {selectedCategory !== "all" && <span> in <span style={{ color: "var(--va-accent)" }}>{CATEGORY_LABELS[selectedCategory as StoryCategory]}</span></span>}
            {search && <span> matching <span style={{ color: "var(--va-accent)" }}>"{search}"</span></span>}
          </p>
          <button onClick={() => { setSearch(""); setSelectedCategory("all"); }} style={{ ...S.muted, fontSize: "0.75rem", cursor: "pointer", background: "none", border: "none" }}>Clear filters</button>
        </div>
      )}

      {/* ── Entry list ──────────────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: "4rem" }}>
          <p style={S.muted}>{archive.entries.length === 0 ? "No memories yet. Add entries via the Inbox." : "No memories match your search."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {entries.map(entry => (
            <div key={entry.id} style={{ ...S.surface, padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--va-accent)" }}>{CATEGORY_ICONS[entry.category]} {CATEGORY_LABELS[entry.category]}</span>
                <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.375rem", borderRadius: "9999px", background: (entry as any).subtab === "canon" ? "rgba(59,130,246,0.15)" : "rgba(124,58,237,0.15)", color: (entry as any).subtab === "canon" ? "#3b82f6" : "#c4b5fd", fontWeight: "600" }}>
                  {(entry as any).subtab === "canon" ? "📖" : "🎮"}
                </span>
              </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ ...S.muted, fontSize: "0.75rem" }}>{new Date(entry.updatedAt).toLocaleString()}</span>
                  {editingId !== entry.id && deleteConfirmId !== entry.id && (
                    <>
                      <button onClick={() => { setEditingId(entry.id); setEditingText(entry.text); setDeleteConfirmId(null); }} style={{ ...S.muted, fontSize: "0.75rem", cursor: "pointer", background: "none", border: "none" }}>✏️ Edit</button>
                      <button onClick={() => setDeleteConfirmId(entry.id)} style={{ ...S.muted, fontSize: "0.75rem", cursor: "pointer", background: "none", border: "none" }}>🗑️ Delete</button>
                    </>
                  )}
                </div>
              </div>
              {editingId === entry.id ? (
                <div>
                  <textarea value={editingText} onChange={e => setEditingText(e.target.value)} style={{ ...S.input, minHeight: "80px", resize: "vertical" }} autoFocus />
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <button onClick={() => saveEdit(entry.id)} style={{ background: "#15803d", color: "white", padding: "0.25rem 0.75rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>✓ Save</button>
                    <button onClick={() => { setEditingId(null); setEditingText(""); }} style={{ ...S.muted, background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
                  </div>
                </div>
              ) : deleteConfirmId === entry.id ? (
                <div>
                  <p style={{ fontSize: "0.875rem", color: "var(--va-text)", marginBottom: "0.75rem" }}>{entry.text}</p>
                  <div style={{ background: "rgba(127,29,29,0.3)", border: "1px solid #7f1d1d", borderRadius: "0.375rem", padding: "0.75rem" }}>
                    <p style={{ color: "#fca5a5", fontSize: "0.875rem", marginBottom: "0.75rem" }}>Delete this memory?</p>
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button onClick={() => doDelete(entry.id)} style={{ background: "#b91c1c", color: "white", padding: "0.25rem 0.75rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Yes, Delete</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ ...S.muted, background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}