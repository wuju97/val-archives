"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadArchive, regenerateMasterPrompt } from "@/lib/archiveEngine";
import { hasGeminiKey, geminiRefineMasterPrompt } from "@/lib/geminiEngine";

export default function MasterPromptPage() {
  const [prompt, setPrompt] = useState("");
  const [archiveName, setArchiveName] = useState("");
  const [entryCount, setEntryCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    const archive = regenerateMasterPrompt(loadArchive());
    setPrompt(archive.masterPrompt);
    setArchiveName(archive.archiveName);
    setEntryCount(archive.entries.length);
  }, []);

  function copyPrompt() {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportPrompt() {
    if (!prompt) return;
    const blob = new Blob([`Archive: ${archiveName}\n\n${prompt}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${archiveName.replace(/\s+/g, "_")}_master_prompt.txt`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>
      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>👑 Master Prompt</h1>
          {archiveName && <p style={{ color: "var(--va-text-muted)" }}>{archiveName} · {entryCount} entries</p>}
          <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>Auto-generated · updates when you import</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={copyPrompt} disabled={!prompt} style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: !prompt ? 0.3 : 1 }}>{copied ? "✓ Copied!" : "📋 Copy"}</button>
          <button onClick={exportPrompt} disabled={!prompt} style={{ background: "#16a34a", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: !prompt ? 0.3 : 1 }}>📄 Export TXT</button>
          {hasGeminiKey() && (
            <button onClick={async () => { if (!prompt) return; setRefining(true); const refined = await geminiRefineMasterPrompt(prompt); setPrompt(refined); setRefining(false); }} disabled={!prompt || refining}
              style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: (!prompt || refining) ? 0.3 : 1 }}>
              {refining ? "✨ Refining..." : "✨ AI Refine"}
            </button>
          )}
        </div>
      </div>
      {prompt ? (
        <textarea value={prompt} readOnly style={{ width: "100%", height: "75vh", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", outline: "none", resize: "none", fontSize: "0.875rem", fontFamily: "monospace", color: "var(--va-text)" }} />
      ) : (
        <div style={{ textAlign: "center", paddingTop: "8rem" }}>
          <p style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>🌌</p>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--va-text-muted)", marginBottom: "0.75rem" }}>Archive is empty</h2>
          <p style={{ color: "var(--va-text-muted)", marginBottom: "2rem" }}>Add entries via the Inbox to generate your Master Prompt.</p>
          <Link href="/inbox" style={{ background: "var(--va-accent)", color: "white", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", textDecoration: "none", fontWeight: "600" }}>📥 Go to Inbox</Link>
        </div>
      )}
    </div>
  );
}