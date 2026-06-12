"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { loadArchive, saveArchive, addEntry, deleteEntry, regenerateMasterPrompt } from "@/lib/archiveEngine";

export default function DynamicTabPage() {
  const params = useParams();
  const tabName = decodeURIComponent(params.name as string);
  const [archive, setArchive] = useState(loadArchive());
  const [input, setInput] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => { setArchive(loadArchive()); }, []);

  const tabEntries = archive.entries.filter((e) => e.category === "custom" && e.text.startsWith(`[${tabName}] `));

  function handleAdd() {
    if (!input.trim()) return;
    const updated = regenerateMasterPrompt(addEntry(archive, `[${tabName}] ${input.trim()}`, "custom"));
    saveArchive(updated); setArchive(updated); setInput(""); setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleDelete(id: string) {
    const updated = regenerateMasterPrompt(deleteEntry(archive, id));
    saveArchive(updated); setArchive(updated);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>
      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>
      <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>{tabName}</h1>
      <p style={{ color: "var(--va-text-muted)", marginBottom: "2rem" }}>{tabEntries.length} entries</p>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder={`Add to ${tabName}...`} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", flex: 1 }} />
        <button onClick={handleAdd} disabled={!input.trim()} style={{ background: "var(--va-accent)", color: "white", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", opacity: !input.trim() ? 0.3 : 1 }}>Add</button>
      </div>
      {added && <p style={{ color: "#4ade80", fontSize: "0.875rem", marginBottom: "1rem" }}>✓ Added</p>}

      {tabEntries.length === 0 ? (
        <p style={{ color: "var(--va-text-muted)" }}>No entries yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {tabEntries.map((entry) => (
            <div key={entry.id} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: "0.875rem", color: "var(--va-text)" }}>{entry.text.replace(`[${tabName}] `, "")}</p>
              <button onClick={() => handleDelete(entry.id)} style={{ color: "var(--va-text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", marginLeft: "1rem" }}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}