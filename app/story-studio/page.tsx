"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasGeminiKey, geminiVerifyCategories } from "../../lib/geminiEngine";
import {
  loadArchive,
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

      <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>📖 Story Studio</h1>
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