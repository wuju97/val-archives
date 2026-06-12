"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasGeminiKey, geminiVerifyCategories } from "../../lib/geminiEngine";
import {
  loadArchive, saveArchive, regenerateMasterPrompt,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  MASTER_PROMPT_ORDER,
  StoryCategory,
} from "@/lib/archiveEngine";

export default function StoryStudioPage() {
  const [entryCounts, setEntryCounts] = useState<Partial<Record<StoryCategory, number>>>({});
  const [totalEntries, setTotalEntries] = useState(0);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResults, setVerifyResults] = useState<Array<{ id: string; text: string; currentCategory: string; suggestedCategory: string; reason: string; changed: boolean }>>([]);
  const [showVerify, setShowVerify] = useState(false);

  useEffect(() => {
    const archive = loadArchive();
    const counts: Partial<Record<StoryCategory, number>> = {};
    for (const entry of archive.entries) {
      counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    }
    setEntryCounts(counts);
    setTotalEntries(archive.entries.length);
    setLoaded(true);
  }, []);

  const filteredCategories = MASTER_PROMPT_ORDER.filter((cat) =>
    !search.trim() || CATEGORY_LABELS[cat].toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>

      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "bold" }}>📖 Story Studio</h1>
        {hasGeminiKey() && totalEntries > 0 && (
          <button onClick={async () => {
            setVerifying(true); setShowVerify(false); setVerifyResults([]);
            const archive = loadArchive();
            const entries = archive.entries.map(e => ({ id: e.id, text: e.text, category: e.category }));
            const ALL_CATS = Object.keys(CATEGORY_LABELS);
            const results = await geminiVerifyCategories(entries, ALL_CATS);
            setVerifyResults(results.map(r => ({ ...r, changed: false })));
            setShowVerify(true); setVerifying(false);
          }} disabled={verifying}
          style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: verifying ? 0.6 : 1 }}>
            {verifying ? "✨ Checking..." : "✨ AI Verify Categories"}
          </button>
        )}
      </div>

      {showVerify && (
        <div style={{ background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <div>
              <h3 style={{ fontWeight: "bold", color: "#c4b5fd", marginBottom: "0.25rem" }}>✨ Category Audit</h3>
              <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>
                {verifyResults.length === 0 ? "All entries are in the correct categories ✓" : `${verifyResults.length} entries may need moving`}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {verifyResults.some(r => r.changed) && (
                <button onClick={() => {
                  const archive = loadArchive();
                  const toMove = verifyResults.filter(r => r.changed);
                  let updated = { ...archive };
                  toMove.forEach(r => {
                    updated.entries = updated.entries.map(e =>
                      e.id === r.id ? { ...e, category: r.suggestedCategory as StoryCategory, updatedAt: new Date().toISOString() } : e
                    );
                  });
                  saveArchive(regenerateMasterPrompt(updated));
                  setShowVerify(false); setVerifyResults([]);
                }} style={{ background: "#7c3aed", color: "white", padding: "0.375rem 0.875rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}>
                  Apply Accepted
                </button>
              )}
              <button onClick={() => setShowVerify(false)}
                style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                Close
              </button>
            </div>
          </div>
          {verifyResults.map((r, i) => (
            <div key={r.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", background: "var(--va-bg)", border: `1px solid ${r.changed ? "#7c3aed" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text)", marginBottom: "0.25rem" }}>{r.text.slice(0, 80)}{r.text.length > 80 ? "..." : ""}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>
                  <span style={{ textDecoration: "line-through" }}>{r.currentCategory}</span>
                  <span style={{ color: "#7c3aed", margin: "0 0.5rem" }}>→</span>
                  <span style={{ color: "#c4b5fd" }}>{r.suggestedCategory}</span>
                  <span style={{ marginLeft: "0.5rem" }}>({r.reason})</span>
                </p>
              </div>
              <button onClick={() => setVerifyResults(prev => prev.map((item, idx) => idx === i ? { ...item, changed: !item.changed } : item))}
                style={{ background: r.changed ? "#7c3aed" : "var(--va-border)", color: r.changed ? "white" : "var(--va-text-muted)", padding: "0.25rem 0.625rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", flexShrink: 0 }}>
                {r.changed ? "✓ Accept" : "Reject"}
              </button>
            </div>
          ))}
        </div>
      )}
      <p style={{ color: "var(--va-text-muted)", marginBottom: "2rem" }}>
        {loaded ? `${totalEntries} ${totalEntries === 1 ? "entry" : "entries"} across your archive` : "Loading..."}
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search categories..."
        style={{
          background: "var(--va-surface)",
          border: "1px solid var(--va-border)",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          outline: "none",
          color: "var(--va-text)",
          fontSize: "0.875rem",
          width: "100%",
          maxWidth: "28rem",
          display: "block",
          marginBottom: "2rem",
          boxSizing: "border-box",
        }}
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "0.75rem",
      }}>
        {filteredCategories.map((category) => {
          const count = entryCounts[category] ?? 0;
          return (
            <Link
              key={category}
              href={`/story-studio/${category}`}
              style={{
                background: "var(--va-surface)",
                border: "1px solid var(--va-border)",
                borderRadius: "0.75rem",
                padding: "1rem",
                textDecoration: "none",
                display: "block",
                opacity: count > 0 ? 1 : 0.7,
                transition: "border-color 0.2s, opacity 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--va-accent)";
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--va-border)";
                e.currentTarget.style.opacity = count > 0 ? "1" : "0.7";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>{CATEGORY_ICONS[category]}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: "0.7rem",
                    background: "rgba(59,130,246,0.2)",
                    color: "var(--va-accent)",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "9999px",
                  }}>
                    {count}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--va-text)" }}>
                {CATEGORY_LABELS[category]}
              </p>
              {count === 0 && (
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>Empty</p>
              )}
            </Link>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <p style={{ color: "var(--va-text-muted)", textAlign: "center", paddingTop: "3rem" }}>
          No categories match "{search}"
        </p>
      )}

    </div>
  );
}