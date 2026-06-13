"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { hasGeminiKey, geminiCanonPlacement } from "../../lib/geminiEngine";
import {
  loadArchive, saveArchive,
  addCanonCategory, removeCanonCategory,
  addCanonEntry, removeCanonEntry,
  getPriorityLevel, setPriority,
} from "@/lib/archiveEngine";

// ─── Built-in Canon Categories ────────────────────────────────────────────────
const BUILTIN_CATEGORIES = [
  { id: "pdf-files",      name: "PDF Files",       icon: "📄", desc: "Upload PDF documents" },
  { id: "text-files",     name: "Text Files",       icon: "📝", desc: "Upload .txt or .md files" },
  { id: "copy-paste",     name: "Copy & Paste",     icon: "📋", desc: "Paste text directly" },
  { id: "timeline-events",name: "Timeline Events",  icon: "🗓️", desc: "Year-by-year canon events — stored whole, never split" },
];

export default function CanonPage() {
  const [archive, setArchive] = useState(loadArchive());
  const [activeCatId, setActiveCatId] = useState<string>("pdf-files");
  const [customCatName, setCustomCatName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [placementResult, setPlacementResult] = useState<{ placement: string; context: string; suggestion: string } | null>(null);
  const [checkingPlacement, setCheckingPlacement] = useState(false);
  const [lastAddedContent, setLastAddedContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setArchive(loadArchive()); }, []);

  // Merge built-in + custom categories
  const customCats = archive.canonCategories ?? [];
  const allCats = [
    ...BUILTIN_CATEGORIES.map(b => ({ ...b, isBuiltin: true })),
    ...customCats.map(c => ({ id: c.id, name: c.name, icon: "🗂️", desc: "Custom category", isBuiltin: false })),
  ];
  const activeCat = allCats.find(c => c.id === activeCatId) ?? allCats[0];

  // Get entries for active category
  function getEntries() {
    if (activeCat.isBuiltin) {
      // Built-in cats store in canonCategories with matching id
      const found = customCats.find(c => c.id === activeCatId);
      return found?.entries ?? [];
    }
    return customCats.find(c => c.id === activeCatId)?.entries ?? [];
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  // Ensure a built-in category exists in storage
  function ensureBuiltin(id: string, name: string): typeof archive {
    const a = loadArchive();
    if (!(a.canonCategories ?? []).find(c => c.id === id)) {
      const updated = {
        ...a,
        canonCategories: [
          ...(a.canonCategories ?? []),
          { id, name, entries: [] },
        ],
      };
      saveArchive(updated);
      setArchive(updated);
      return updated;
    }
    return a;
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || !activeCatId) return;
    setImporting(true);

    const builtin = BUILTIN_CATEGORIES.find(b => b.id === activeCatId);
    const catName = activeCat.name;
    let a = ensureBuiltin(activeCatId, catName);

    for (const file of Array.from(files)) {
      try {
        let content = "";
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "pdf") {
          // Store filename as reference — PDF text extraction is unreliable in browser
          // User can paste the actual content via Copy & Paste tab
          content = `[PDF File: ${file.name}]\n\nThis PDF has been registered in your Canon Archives. To add the actual text content, open the PDF, select all text (Ctrl+A), copy it, and paste it into the Copy & Paste tab.\n\nFile size: ${(file.size / 1024).toFixed(1)} KB`;
          const updated = addCanonEntry(a, activeCatId, file.name, content);
          saveArchive(updated); setArchive(updated); a = updated;
          flash(`✓ "${file.name}" registered — paste text content via Copy & Paste tab`);
          continue;
        } else {
          content = await file.text();
        }

        const updated = addCanonEntry(a, activeCatId, file.name, content);
        saveArchive(updated);
        setArchive(updated);
        a = updated;
        flash(`✓ "${file.name}" added to ${catName}`);
      } catch (err) {
        flash(`✗ Could not read "${file.name}" — ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handlePaste() {
    if (!pasteText.trim()) return;
    const title = pasteTitle.trim() || `Note — ${new Date().toLocaleDateString()}`;
    const catName = activeCat.name;
    let a = ensureBuiltin(activeCatId, catName);
    const updated = addCanonEntry(a, activeCatId, title, pasteText.trim());
    saveArchive(updated); setArchive(updated);
    setPasteText(""); setPasteTitle("");
    flash(`✓ "${title}" added to ${catName}`);
    // Trigger placement analysis
    if (hasGeminiKey()) {
      const existingEntries = (updated.canonCategories ?? [])
        .find(c => c.id === activeCatId)?.entries
        .slice(0, -1).map(e => e.content) ?? [];
      if (existingEntries.length > 0) {
        setCheckingPlacement(true); setPlacementResult(null);
        setLastAddedContent(pasteText.trim().slice(0, 60));
        geminiCanonPlacement(pasteText.trim(), existingEntries, catName).then(result => {
          setPlacementResult(result); setCheckingPlacement(false);
        });
      }
    }
  }

  function handleAddCustomCat() {
    if (!customCatName.trim()) return;
    const updated = addCanonCategory(archive, customCatName.trim());
    saveArchive(updated); setArchive(updated);
    const newCat = updated.canonCategories[updated.canonCategories.length - 1];
    setActiveCatId(newCat.id);
    setCustomCatName("");
  }

  function handleRemoveEntry(entryId: string) {
    if (!confirm("Remove this entry?")) return;
    const updated = removeCanonEntry(archive, activeCatId, entryId);
    saveArchive(updated); setArchive(updated);
  }

  function handleRemoveCustomCat(catId: string) {
    if (!confirm("Remove this category and all its entries?")) return;
    const updated = removeCanonCategory(archive, catId);
    saveArchive(updated); setArchive(updated);
    setActiveCatId("pdf-files");
  }

  function handlePriority(id: string) {
    const current = getPriorityLevel(archive, `canon-${id}`);
    let updated;
    if (current === "none") updated = setPriority(archive, `canon-${id}`, "blue");
    else if (current === "blue") updated = setPriority(archive, `canon-${id}`, "red");
    else updated = setPriority(archive, `canon-${id}`, "none");
    saveArchive(updated); setArchive(updated);
  }

  function handleCanonPriority() {
    const current = getPriorityLevel(archive, "canon");
    let updated;
    if (current === "none") updated = setPriority(archive, "canon", "blue");
    else if (current === "blue") updated = setPriority(archive, "canon", "red");
    else updated = setPriority(archive, "canon", "none");
    saveArchive(updated); setArchive(updated);
  }

  const priorityColor = (id: string) => {
    const p = getPriorityLevel(archive, id);
    return p === "red" ? "#ef4444" : p === "blue" ? "#3b82f6" : "transparent";
  };
  const priorityBorder = (id: string) => {
    const p = getPriorityLevel(archive, id);
    return p === "none" ? "var(--va-border)" : priorityColor(id);
  };
  const priorityLabel = (id: string) => {
    const p = getPriorityLevel(archive, id);
    return p === "red" ? "🔴" : p === "blue" ? "🔵" : "○";
  };
  const canonPriority = getPriorityLevel(archive, "canon");

  const entries = getEntries();
  const isTimeline = activeCatId === "timeline-events";

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "1.25rem 2rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>← Home</Link>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "bold" }}>🏛 Canon Archives</h1>
            {checkingPlacement && (
              <p style={{ fontSize: "0.8rem", color: "#c4b5fd", marginTop: "0.375rem" }}>✨ Analyzing canon placement...</p>
            )}
            {placementResult && placementResult.placement && (
              <div style={{ background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.75rem", padding: "1rem", marginTop: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontWeight: "bold", color: "#c4b5fd", fontSize: "0.875rem" }}>✨ Canon Placement Analysis</h3>
                  <button onClick={() => setPlacementResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)" }}>×</button>
                </div>
                {lastAddedContent && <p style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", marginBottom: "0.5rem", fontStyle: "italic" }}>For: "{lastAddedContent}..."</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <div style={{ background: "var(--va-bg)", borderRadius: "0.375rem", padding: "0.625rem" }}>
                    <p style={{ fontSize: "0.7rem", color: "#7c3aed", fontWeight: "600", marginBottom: "0.125rem" }}>📍 Where it belongs</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--va-text)" }}>{placementResult.placement}</p>
                  </div>
                  <div style={{ background: "var(--va-bg)", borderRadius: "0.375rem", padding: "0.625rem" }}>
                    <p style={{ fontSize: "0.7rem", color: "#7c3aed", fontWeight: "600", marginBottom: "0.125rem" }}>🔗 Why</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--va-text)" }}>{placementResult.context}</p>
                  </div>
                  {placementResult.suggestion && (
                    <div style={{ background: "var(--va-bg)", borderRadius: "0.375rem", padding: "0.625rem" }}>
                      <p style={{ fontSize: "0.7rem", color: "#f59e0b", fontWeight: "600", marginBottom: "0.125rem" }}>⚠️ Continuity Notes</p>
                      <p style={{ fontSize: "0.8rem", color: "var(--va-text)" }}>{placementResult.suggestion}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem", marginTop: "0.1rem" }}>
              Source library — stored as-is and fed directly into Master Prompt
            </p>
          </div>
        </div>
        <button onClick={handleCanonPriority}
          style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: `2px solid ${canonPriority !== "none" ? (canonPriority === "red" ? "#ef4444" : "#3b82f6") : "var(--va-border)"}`, background: canonPriority !== "none" ? (canonPriority === "red" ? "#ef4444" : "#3b82f6") : "transparent", color: canonPriority !== "none" ? "white" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" }}>
          {canonPriority === "red" ? "🔴 First Priority" : canonPriority === "blue" ? "🔵 Second Priority" : "Set Priority"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1 }}>

        {/* LEFT — Category list */}
        <aside style={{ width: "13rem", borderRight: "1px solid var(--va-border)", background: "var(--va-surface)", padding: "0.75rem", flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>

          <p style={{ color: "var(--va-text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.25rem 0.5rem 0.5rem", marginBottom: "0.25rem" }}>File Types</p>

          {BUILTIN_CATEGORIES.map(cat => {
            const pId = `canon-${cat.id}`;
            const isActive = activeCatId === cat.id;
            const entryCount = (customCats.find(c => c.id === cat.id)?.entries ?? []).length;
            return (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <button onClick={() => setActiveCatId(cat.id)}
                  style={{ flex: 1, textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem", background: isActive ? "var(--va-border)" : "transparent", color: isActive ? "var(--va-text)" : "var(--va-text-muted)", display: "flex", alignItems: "center", gap: "0.375rem", justifyContent: "space-between" }}>
                  <span>{cat.icon} {cat.name}</span>
                  {entryCount > 0 && <span style={{ fontSize: "0.65rem", color: "var(--va-accent)", flexShrink: 0 }}>{entryCount}</span>}
                </button>
                <button onClick={() => handlePriority(cat.id)} title={`Priority: ${getPriorityLevel(archive, pId)}`}
                  style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${priorityBorder(pId)}`, background: priorityColor(pId), cursor: "pointer", flexShrink: 0, padding: 0, fontSize: "9px", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {getPriorityLevel(archive, pId) !== "none" ? "●" : ""}
                </button>
              </div>
            );
          })}

          {customCats.filter(c => !BUILTIN_CATEGORIES.find(b => b.id === c.id)).length > 0 && (
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.75rem 0.5rem 0.25rem", marginTop: "0.25rem" }}>Custom</p>
          )}

          {customCats.filter(c => !BUILTIN_CATEGORIES.find(b => b.id === c.id)).map(cat => {
            const pId = `canon-${cat.id}`;
            const isActive = activeCatId === cat.id;
            return (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <button onClick={() => setActiveCatId(cat.id)}
                  style={{ flex: 1, textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem", background: isActive ? "var(--va-border)" : "transparent", color: isActive ? "var(--va-text)" : "var(--va-text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>🗂️ {cat.name}</span>
                  {cat.entries.length > 0 && <span style={{ fontSize: "0.65rem", color: "var(--va-accent)" }}>{cat.entries.length}</span>}
                </button>
                <button onClick={() => handlePriority(cat.id)} title="Priority"
                  style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${priorityBorder(pId)}`, background: priorityColor(pId), cursor: "pointer", flexShrink: 0, padding: 0 }} />
                <button onClick={() => handleRemoveCustomCat(cat.id)} title="Remove"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", padding: "0.125rem", opacity: 0.5 }}>×</button>
              </div>
            );
          })}

          {/* Add custom category */}
          <div style={{ marginTop: "auto", paddingTop: "0.75rem", borderTop: "1px solid var(--va-border)" }}>
            <input value={customCatName} onChange={(e) => setCustomCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCustomCat()}
              placeholder="Custom category..."
              style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.4rem 0.6rem", outline: "none", color: "var(--va-text)", fontSize: "0.75rem", marginBottom: "0.4rem", boxSizing: "border-box" }} />
            <button onClick={handleAddCustomCat} disabled={!customCatName.trim()}
              style={{ width: "100%", background: "var(--va-accent)", color: "white", padding: "0.4rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", opacity: !customCatName.trim() ? 0.3 : 1 }}>
              + Add Category
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: "1.5rem 2rem", maxWidth: "900px" }}>

          {/* Category header */}
          <div style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
              {activeCat.icon} {activeCat.name}
            </h2>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem" }}>
              {isTimeline
                ? "⚠️ Timeline Events are stored whole and never split. Exact content appears in Master Prompt as-is."
                : activeCat.desc}
            </p>
          </div>

          {msg && (
            <div style={{ background: msg.startsWith("✓") ? "rgba(20,83,45,0.3)" : "rgba(127,29,29,0.3)", border: `1px solid ${msg.startsWith("✓") ? "#15803d" : "#7f1d1d"}`, borderRadius: "0.375rem", padding: "0.625rem 1rem", color: msg.startsWith("✓") ? "#4ade80" : "#fca5a5", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {msg}
            </div>
          )}

          {/* Input area based on category type */}
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem" }}>

            {/* PDF Files */}
            {activeCatId === "pdf-files" && (
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Upload PDF Files</p>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--va-accent)"; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--va-border)"; }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--va-border)"; handleFileUpload(e.dataTransfer.files); }}
                  style={{ border: "2px dashed var(--va-border)", borderRadius: "0.5rem", padding: "2rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}>
                  <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</p>
                  <p style={{ color: "var(--va-text)", fontWeight: "600", fontSize: "0.875rem" }}>{importing ? "⏳ Reading PDF..." : "Click to upload PDF"}</p>
                  <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>or drag & drop · .pdf files only</p>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: "none" }} onChange={(e) => handleFileUpload(e.target.files)} />
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem", marginTop: "0.75rem" }}>
                  💡 Tip: PDF text extraction is basic. For best results, use Copy & Paste instead.
                </p>
              </div>
            )}

            {/* Text Files */}
            {activeCatId === "text-files" && (
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Upload Text or Markdown Files</p>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--va-accent)"; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--va-border)"; }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--va-border)"; handleFileUpload(e.dataTransfer.files); }}
                  style={{ border: "2px dashed var(--va-border)", borderRadius: "0.5rem", padding: "2rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}>
                  <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📝</p>
                  <p style={{ color: "var(--va-text)", fontWeight: "600", fontSize: "0.875rem" }}>{importing ? "⏳ Reading..." : "Click to upload .txt or .md file"}</p>
                  <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>or drag & drop</p>
                </div>
                <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" multiple style={{ display: "none" }} onChange={(e) => handleFileUpload(e.target.files)} />
              </div>
            )}

            {/* Copy & Paste */}
            {activeCatId === "copy-paste" && (
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Paste Text Directly</p>
                <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Title (optional)..."
                  style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste any text — lore, story content, world info, character descriptions..."
                  style={{ width: "100%", height: "160px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                <button onClick={handlePaste} disabled={!pasteText.trim()}
                  style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !pasteText.trim() ? 0.3 : 1 }}>
                  Add to Archive
                </button>
              </div>
            )}

            {/* Timeline Events — special */}
            {activeCatId === "timeline-events" && (
              <div>
                <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#93c5fd" }}>
                  🗓️ <strong>Timeline Events behave differently.</strong> Content is stored exactly as you write it — never split or divided. The complete entry appears in the Master Prompt word-for-word to preserve exact chronological context.
                </div>
                <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="e.g. Harry Potter Year 1 — 1991 Events"
                  style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Enter timeline events exactly as you want them remembered:\n\nSeptember 1, 1991 — Harry Potter boards the Hogwarts Express for the first time.\nSeptember 1, 1991 — Harry meets Ron Weasley and Hermione Granger on the train.\nSeptember 1, 1991 — The Sorting Hat places Harry in Gryffindor.\n...`}
                  style={{ width: "100%", height: "220px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", marginBottom: "0.5rem", boxSizing: "border-box", fontFamily: "monospace", lineHeight: "1.6" }} />
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <button onClick={handlePaste} disabled={!pasteText.trim()}
                    style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !pasteText.trim() ? 0.3 : 1 }}>
                    Save Timeline Entry
                  </button>
                  <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>Stored whole · Never split · Appears verbatim in prompts</p>
                </div>
              </div>
            )}

            {/* Custom categories — show all input types */}
            {!BUILTIN_CATEGORIES.find(b => b.id === activeCatId) && (
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Add to {activeCat.name}</p>

                {/* File upload */}
                <div onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--va-accent)"; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--va-border)"; }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--va-border)"; handleFileUpload(e.dataTransfer.files); }}
                  style={{ border: "2px dashed var(--va-border)", borderRadius: "0.5rem", padding: "1.25rem", textAlign: "center", cursor: "pointer", marginBottom: "1rem", transition: "border-color 0.2s" }}>
                  <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>{importing ? "⏳ Reading..." : "📁 Click to upload file (PDF, TXT, MD)"}</p>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" multiple style={{ display: "none" }} onChange={(e) => handleFileUpload(e.target.files)} />

                <div style={{ borderTop: "1px solid var(--va-border)", paddingTop: "1rem" }}>
                  <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)}
                    placeholder="Title (optional)..."
                    style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Or paste text directly..."
                    style={{ width: "100%", height: "120px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                  <button onClick={handlePaste} disabled={!pasteText.trim()}
                    style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !pasteText.trim() ? 0.3 : 1 }}>
                    Add to Archive
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Entries list */}
          {entries.length > 0 && (
            <div>
              <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {entries.length} {entries.length === 1 ? "entry" : "entries"} stored
                {isTimeline ? " · Stored whole · Verbatim in Master Prompt" : " · Tagged as Canon source"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {entries.map(entry => (
                  <div key={entry.id} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "1rem" }}>{isTimeline ? "🗓️" : "📄"}</span>
                        <span style={{ fontWeight: "600", fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.filename}</span>
                        <span style={{ color: "var(--va-text-muted)", fontSize: "0.7rem", flexShrink: 0 }}>{entry.content.length.toLocaleString()} chars</span>
                        {isTimeline && <span style={{ background: "rgba(59,130,246,0.2)", color: "#93c5fd", fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: "9999px", flexShrink: 0 }}>VERBATIM</span>}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                        <button onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                          style={{ background: "var(--va-border)", border: "none", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>
                          {expandedEntry === entry.id ? "▲ Hide" : "▼ View"}
                        </button>
                        <button onClick={() => handleRemoveEntry(entry.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem" }}>🗑️</button>
                      </div>
                    </div>
                    {expandedEntry === entry.id && (
                      <div style={{ borderTop: "1px solid var(--va-border)", padding: "0.75rem 1rem", maxHeight: "300px", overflowY: "auto" }}>
                        <pre style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", whiteSpace: "pre-wrap", fontFamily: "monospace", margin: 0, lineHeight: "1.6" }}>
                          {entry.content}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}