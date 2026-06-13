"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasGeminiKey, geminiSemanticSearch } from "../../lib/geminiEngine";
import {
  loadArchive, loadArchiveAsync, saveArchive, updateEntry, deleteEntry,
  regenerateMasterPrompt, CATEGORY_LABELS, CATEGORY_ICONS, StoryCategory,
} from "@/lib/archiveEngine";

export default function PensievePage() {
  const [archive, setArchive] = useState(loadArchive());
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<StoryCategory | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<Array<{ id: string; text: string; category: string; relevance: string }> | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const sync = loadArchive();
    if (sync.entries.length > 0 || (sync.canonCategories ?? []).length > 0) {
      setArchive(sync);
    } else {
      loadArchiveAsync().then(data => { if (data) setArchive(data); });
    }
  }, []);

  const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as StoryCategory[];
  const categoryCounts: Partial<Record<StoryCategory, number>> = {};
  for (const entry of archive.entries) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1;
  }

  const entries = archive.entries
    .filter((entry) => {
      const matchesSearch = search.trim() === "" || entry.text.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => sortOrder === "newest"
      ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    );

  function saveEdit(id: string) {
    if (!editingText.trim()) return;
    const updated = regenerateMasterPrompt(updateEntry(archive, id, editingText));
    saveArchive(updated); setArchive(updated); setEditingId(null); setEditingText("");
  }

  function doDelete(id: string) {
    const updated = regenerateMasterPrompt(deleteEntry(archive, id));
    saveArchive(updated); setArchive(updated); setDeleteConfirmId(null);
  }

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
      <p style={{ ...S.muted, marginBottom: "2rem" }}>{archive.entries.length} {archive.entries.length === 1 ? "memory" : "memories"} in vault</p>

      {/* AI Semantic Search */}
      {hasGeminiKey() && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input value={aiQuery}
              onChange={e => { setAiQuery(e.target.value); if (!e.target.value.trim()) { setAiResults(null); setAiMode(false); } }}
              onKeyDown={async e => {
                if (e.key === "Enter" && aiQuery.trim()) {
                  setAiSearching(true); setAiMode(true);
                  // Include canon entries in search
            const canonEntries = (archive.canonCategories ?? []).flatMap(cat =>
              cat.entries.map(e => ({ id: e.id, text: e.content, category: "canon-" + cat.name }))
            );
            const allEntries = [
              ...archive.entries.map(en => ({ id: en.id, text: en.text, category: en.category })),
              ...canonEntries,
            ];
            const results = await geminiSemanticSearch(aiQuery, allEntries);
                  setAiResults(results); setAiSearching(false);
                }
              }}
              placeholder="✨ Ask anything — e.g. What do I know about Hermione's relationship with Valefor?"
              style={{ flex: 1, background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem" }} />
            <button onClick={async () => {
              if (!aiQuery.trim()) return;
              setAiSearching(true); setAiMode(true);
              // Include canon entries in search
            const canonEntries = (archive.canonCategories ?? []).flatMap(cat =>
              cat.entries.map(e => ({ id: e.id, text: e.content, category: "canon-" + cat.name }))
            );
            const allEntries = [
              ...archive.entries.map(en => ({ id: en.id, text: en.text, category: en.category })),
              ...canonEntries,
            ];
            const results = await geminiSemanticSearch(aiQuery, allEntries);
              setAiResults(results); setAiSearching(false);
            }} disabled={!aiQuery.trim() || aiSearching}
              style={{ background: "#7c3aed", color: "white", padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: (!aiQuery.trim() || aiSearching) ? 0.5 : 1, whiteSpace: "nowrap" }}>
              {aiSearching ? "✨ Searching..." : "✨ AI Search"}
            </button>
            {aiMode && (
              <button onClick={() => { setAiMode(false); setAiResults(null); setAiQuery(""); }}
                style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.625rem 0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                Clear
              </button>
            )}
          </div>
          {aiMode && aiResults !== null && (
            <p style={{ fontSize: "0.75rem", color: "#c4b5fd", marginTop: "0.375rem" }}>
              {aiResults.length > 0 ? `✨ Found ${aiResults.length} relevant ${aiResults.length === 1 ? "entry" : "entries"}` : "✨ No relevant entries found"}
            </p>
          )}
          {aiMode && aiResults !== null && aiResults.length > 0 && (
            <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {aiResults.map(result => (
                <div key={result.id} style={{ background: "var(--va-surface)", border: "1px solid #7c3aed33", borderRadius: "0.75rem", padding: "1rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "#c4b5fd", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>{result.category}</span>
                  <p style={{ fontSize: "0.875rem", color: "var(--va-text)", lineHeight: "1.6", margin: "0.375rem 0" }}>{result.text}</p>
                  <p style={{ fontSize: "0.75rem", color: "#7c3aed", fontStyle: "italic" }}>✨ {result.relevance}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memories..." style={S.input} />
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as StoryCategory | "all")} style={S.select}>
          <option value="all">All Categories ({archive.entries.length})</option>
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}{(categoryCounts[cat] ?? 0) > 0 ? ` (${categoryCounts[cat]})` : ""}</option>
          ))}
        </select>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")} style={S.select}>
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

      {entries.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: "4rem" }}>
          <p style={S.muted}>{archive.entries.length === 0 ? "No memories yet. Add entries via the Inbox." : "No memories match your search."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {entries.map((entry) => (
            <div key={entry.id} style={{ ...S.surface, padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--va-accent)" }}>{CATEGORY_ICONS[entry.category]} {CATEGORY_LABELS[entry.category]}</span>
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
                  <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} style={{ ...S.input, minHeight: "80px", resize: "vertical" }} autoFocus />
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
    </div>
  );
}