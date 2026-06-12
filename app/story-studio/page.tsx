"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadArchive, saveArchive, CATEGORY_LABELS, CATEGORY_ICONS,
  MASTER_PROMPT_ORDER, StoryCategory, getPriorityLevel, setPriority,
} from "@/lib/archiveEngine";

// Remove "rules" and "player-character" from Story — rules go to Rule Book
const STORY_CATEGORIES = MASTER_PROMPT_ORDER.filter(
  c => c !== "rules"
);

export default function StoryPage() {
  const [entryCounts, setEntryCounts] = useState<Partial<Record<StoryCategory, number>>>({});
  const [totalEntries, setTotalEntries] = useState(0);
  const [search, setSearch] = useState("");
  const [archive, setArchive] = useState(loadArchive());

  useEffect(() => {
    const a = loadArchive();
    setArchive(a);
    const counts: Partial<Record<StoryCategory, number>> = {};
    for (const entry of a.entries) {
      if (entry.category !== "rules") {
        counts[entry.category] = (counts[entry.category] ?? 0) + 1;
      }
    }
    setEntryCounts(counts);
    setTotalEntries(a.entries.filter(e => e.category !== "rules").length);
  }, []);

  const storyPriority = getPriorityLevel(archive, "story");

  function handleStoryPriority() {
    const current = getPriorityLevel(archive, "story");
    let updated;
    if (current === "none") updated = setPriority(archive, "story", "blue");
    else if (current === "blue") updated = setPriority(archive, "story", "red");
    else updated = setPriority(archive, "story", "none");
    saveArchive(updated); setArchive(updated);
  }

  function handleCategoryPriority(category: StoryCategory, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const id = `story-${category}`;
    const current = getPriorityLevel(archive, id);
    let updated;
    if (current === "none") updated = setPriority(archive, id, "blue");
    else if (current === "blue") updated = setPriority(archive, id, "red");
    else updated = setPriority(archive, id, "none");
    saveArchive(updated); setArchive(updated);
  }

  const filteredCategories = STORY_CATEGORIES.filter(cat =>
    !search.trim() || CATEGORY_LABELS[cat].toLowerCase().includes(search.toLowerCase())
  );

  const priorityColor = (p: string) => p === "red" ? "#ef4444" : p === "blue" ? "#3b82f6" : "var(--va-border)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>

      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
        <div>
          <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.25rem" }}>📖 Story</h1>
          <p style={{ color: "var(--va-text-muted)" }}>{totalEntries} entries across your archive</p>
        </div>
        <button onClick={handleStoryPriority}
          style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: `2px solid ${priorityColor(storyPriority)}`, background: storyPriority !== "none" ? priorityColor(storyPriority) : "transparent", color: storyPriority !== "none" ? "white" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", transition: "all 0.2s", flexShrink: 0 }}>
          {storyPriority === "red" ? "🔴 First Priority" : storyPriority === "blue" ? "🔵 Second Priority" : "Set Priority"}
        </button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..."
        style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", width: "100%", maxWidth: "28rem", display: "block", marginBottom: "2rem", marginTop: "1rem", boxSizing: "border-box" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
        {filteredCategories.map(category => {
          const count = entryCounts[category] ?? 0;
          const catPriority = getPriorityLevel(archive, `story-${category}`);
          const pColor = priorityColor(catPriority);
          return (
            <div key={category} style={{ position: "relative" }}>
              <Link href={`/story-studio/${category}`}
                style={{ background: "var(--va-surface)", border: `1px solid ${catPriority !== "none" ? pColor : "var(--va-border)"}`, borderRadius: "0.75rem", padding: "1rem", textDecoration: "none", display: "block", opacity: count > 0 ? 1 : 0.7, transition: "border-color 0.2s" }}
                onMouseEnter={(e) => { if (catPriority === "none") e.currentTarget.style.borderColor = "var(--va-accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = catPriority !== "none" ? pColor : "var(--va-border)"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>{CATEGORY_ICONS[category]}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    {count > 0 && <span style={{ fontSize: "0.7rem", background: "rgba(59,130,246,0.2)", color: "var(--va-accent)", padding: "0.125rem 0.375rem", borderRadius: "9999px" }}>{count}</span>}
                  </div>
                </div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--va-text)" }}>{CATEGORY_LABELS[category]}</p>
                {count === 0 && <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>Empty</p>}
              </Link>
              {/* Priority button */}
              <button
                onClick={(e) => handleCategoryPriority(category, e)}
                title={catPriority === "none" ? "Click to set as 2nd priority" : catPriority === "blue" ? "Click to set as 1st priority" : "Click to remove priority"}
                style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: catPriority !== "none" ? pColor : "var(--va-border)", border: "none", borderRadius: "9999px", width: "1.25rem", height: "1.25rem", cursor: "pointer", fontSize: "0.625rem", color: catPriority !== "none" ? "white" : "var(--va-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", transition: "background 0.2s", zIndex: 1 }}>
                {catPriority === "red" ? "●" : catPriority === "blue" ? "●" : "+"}
              </button>
            </div>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <p style={{ color: "var(--va-text-muted)", textAlign: "center", paddingTop: "3rem" }}>No categories match "{search}"</p>
      )}
    </div>
  );
}