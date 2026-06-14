"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { hasGeminiKey, hasGeminiQualityKey, geminiQualityCall } from "@/lib/geminiEngine";
import { loadArchive, saveArchive, getPriorityLevel, setPriority } from "@/lib/archiveEngine";

// ─── Storage (separate from vault — stored in localStorage under its own key) ─
const STORAGE_KEY = "valArchivesRuleBook";

interface RulePrompt {
  id: string;
  title: string;
  content: string; // original — never overwritten by AI
  refinedContent: string | null; // AI refined version — additive only
  source: "typed" | "file" | "paste";
  createdAt: string;
  updatedAt: string;
}

function loadRules(): RulePrompt[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

function saveRules(rules: RulePrompt[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

// ─── IDB for large files ───────────────────────────────────────────────────────
function openRuleIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("valArchivesRuleDB", 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("rules")) db.createObjectStore("rules");
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function saveRuleContentToIDB(id: string, content: string): Promise<void> {
  const db = await openRuleIDB();
  const tx = db.transaction("rules", "readwrite");
  tx.objectStore("rules").put(content, id);
}

async function loadRuleContentFromIDB(id: string): Promise<string | null> {
  const db = await openRuleIDB();
  return new Promise((resolve) => {
    const tx = db.transaction("rules", "readonly");
    const req = tx.objectStore("rules").get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function deleteRuleFromIDB(id: string): Promise<void> {
  const db = await openRuleIDB();
  const tx = db.transaction("rules", "readwrite");
  tx.objectStore("rules").delete(id);
}

const IDB_PLACEHOLDER = "[CONTENT_IN_IDB]";
const LARGE_THRESHOLD = 5000;

export default function RuleBookPage() {
  const [rules, setRules] = useState<RulePrompt[]>([]);
  const [archive, setArchive] = useState(loadArchive());
  const [activeTab, setActiveTab] = useState<"library" | "typed" | "paste">("library");
  const [typedTitle, setTypedTitle] = useState("");
  const [typedContent, setTypedContent] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refineNote, setRefineNote] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [flash, setFlash] = useState("");
  const [viewingContent, setViewingContent] = useState<{ title: string; content: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setRules(loadRules()); }, []);

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
  const priorityColor = priority === "red" ? "#ef4444" : priority === "blue" ? "#3b82f6" : "var(--va-border)";
  const priorityLabel = priority === "red" ? "🔴 First Priority" : priority === "blue" ? "🔵 Second Priority" : "○ Set Priority";

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 3000);
  }

  async function getFullContent(rule: RulePrompt): Promise<string> {
    if (rule.content === IDB_PLACEHOLDER) {
      return await loadRuleContentFromIDB(rule.id) ?? "[Content not found]";
    }
    return rule.content;
  }

  // ─── Add typed prompt ────────────────────────────────────────────────────────
  function handleAddTyped() {
    if (!typedContent.trim()) return;
    const rule: RulePrompt = {
      id: crypto.randomUUID(),
      title: typedTitle.trim() || "Custom Rule Prompt",
      content: typedContent.trim(),
      refinedContent: null,
      source: "typed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...rules, rule];
    setRules(updated);
    saveRules(updated);
    setTypedTitle(""); setTypedContent("");
    showFlash("✓ Rule prompt added to library");
    setActiveTab("library");
  }

  // ─── Add paste prompt ────────────────────────────────────────────────────────
  async function handleAddPaste() {
    if (!pasteContent.trim()) return;
    const id = crypto.randomUUID();
    let storedContent = pasteContent.trim();

    if (storedContent.length > LARGE_THRESHOLD) {
      await saveRuleContentToIDB(id, storedContent);
      storedContent = IDB_PLACEHOLDER;
    }

    const rule: RulePrompt = {
      id,
      title: pasteTitle.trim() || "Pasted Rule Prompt",
      content: storedContent,
      refinedContent: null,
      source: "paste",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...rules, rule];
    setRules(updated);
    saveRules(updated);
    setPasteTitle(""); setPasteContent("");
    showFlash("✓ Pasted prompt added to library");
    setActiveTab("library");
  }

  // ─── Upload files ─────────────────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newRules: RulePrompt[] = [];

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      let content = "";

      if (file.type === "application/pdf") {
        // Extract PDF text using PDF.js from CDN
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = (window as any).pdfjsLib;
          if (pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages: string[] = [];
            for (let p = 1; p <= pdf.numPages; p++) {
              const page = await pdf.getPage(p);
              const tc = await page.getTextContent();
              pages.push(tc.items.map((it: { str: string }) => it.str).join(" "));
            }
            content = pages.join("\n\n");
          } else {
            content = "[PDF.js not loaded — paste the content in the Copy & Paste tab instead]";
          }
        } catch {
          content = "[PDF extraction failed — try the Copy & Paste tab]";
        }
      } else {
        content = await file.text();
      }

      let storedContent = content;
      if (content.length > LARGE_THRESHOLD) {
        await saveRuleContentToIDB(id, content);
        storedContent = IDB_PLACEHOLDER;
      }

      newRules.push({
        id,
        title: file.name.replace(/\.[^/.]+$/, ""),
        content: storedContent,
        refinedContent: null,
        source: "file",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const updated = [...rules, ...newRules];
    setRules(updated);
    saveRules(updated);
    showFlash(`✓ ${newRules.length} file${newRules.length !== 1 ? "s" : ""} added to Rule Book`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── AI Refine (additive only — never touches original) ──────────────────────
  async function handleRefine(rule: RulePrompt) {
    if (!hasGeminiQualityKey()) return;
    setRefiningId(rule.id);

    const fullContent = await getFullContent(rule);

    const prompt = "You are refining a world-building rule prompt for an RPG/story campaign.\n\n"
      + "STRICT RULES FOR YOU:\n"
      + "- You are ADDING clarity and precision to the existing prompt\n"
      + "- You CANNOT delete any rules, directives, or constraints that exist in the original\n"
      + "- You CANNOT replace the original — your output is a REFINED VERSION that preserves everything\n"
      + "- You can fix grammar and phrasing\n"
      + "- You can add clarifying sub-points under existing rules\n"
      + "- You can restructure for readability but ALL original content must remain\n"
      + "- The refined version must be AT LEAST as long as the original\n\n"
      + "ORIGINAL RULE PROMPT:\n"
      + fullContent
      + "\n\nReturn ONLY the refined version with all original content preserved and enhanced:";

    try {
      const refined = await geminiQualityCall(prompt);
      const updatedRules = rules.map(r =>
        r.id === rule.id ? { ...r, refinedContent: refined, updatedAt: new Date().toISOString() } : r
      );
      setRules(updatedRules);
      saveRules(updatedRules);
      showFlash("✓ AI refined version added — original preserved");
    } catch {
      showFlash("✗ Refine failed — check your Gemini key");
    }
    setRefiningId(null);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await deleteRuleFromIDB(id);
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    saveRules(updated);
    setDeleteConfirmId(null);
    showFlash("✓ Rule prompt removed");
  }

  const filtered = rules.filter(r =>
    search.trim() === "" ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.content !== IDB_PLACEHOLDER && r.content.toLowerCase().includes(search.toLowerCase()))
  );

  const S = {
    surface: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" },
    input: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", width: "100%", boxSizing: "border-box" as const },
    muted: { color: "var(--va-text-muted)" },
    btn: { border: "none", cursor: "pointer", borderRadius: "0.375rem", padding: "0.5rem 1rem", fontWeight: "600" as const, fontSize: "0.875rem" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>
      <Link href="/dashboard" style={{ ...S.muted, fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "2.5rem" }}>📋</span>
          <div>
            <h1 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>Rule Book</h1>
            <p style={{ ...S.muted, fontSize: "0.875rem" }}>
              {rules.length} rule prompt{rules.length !== 1 ? "s" : ""} · Used by Master Prompt, Custom Prompt, and Prompt Forge
            </p>
          </div>
        </div>
        <button onClick={handlePriorityClick}
          style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: `2px solid ${priorityColor}`, background: priority !== "none" ? priorityColor : "transparent", color: priority !== "none" ? "white" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", transition: "all 0.2s" }}>
          {priorityLabel}
        </button>
      </div>

      {/* Info banner */}
      <div style={{ ...S.surface, marginBottom: "1.5rem", background: "rgba(124,58,237,0.08)", borderColor: "rgba(124,58,237,0.3)" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", lineHeight: "1.6" }}>
          📌 Rule Book stores your <strong style={{ color: "var(--va-text)" }}>world-building rule prompts</strong> — the directives that govern how your campaign world works.
          Upload files, paste prompts, or type them directly. AI can refine but <strong style={{ color: "#4ade80" }}>never deletes or replaces your original</strong>.
          These prompts are fed directly into Master Prompt and Prompt Forge.
        </p>
      </div>

      {/* Flash message */}
      {flash && (
        <div style={{ background: flash.startsWith("✗") ? "rgba(239,68,68,0.1)" : "rgba(74,222,128,0.1)", border: `1px solid ${flash.startsWith("✗") ? "#ef4444" : "#4ade80"}`, borderRadius: "0.5rem", padding: "0.625rem 1rem", marginBottom: "1rem", fontSize: "0.875rem", color: flash.startsWith("✗") ? "#f87171" : "#4ade80" }}>
          {flash}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", background: "var(--va-surface)", padding: "0.25rem", borderRadius: "0.625rem", border: "1px solid var(--va-border)", width: "fit-content" }}>
        {([["library", "📚 Library"], ["typed", "✏️ Type Prompt"], ["paste", "📋 Copy & Paste"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ ...S.btn, background: activeTab === tab ? "var(--va-accent)" : "transparent", color: activeTab === tab ? "white" : "var(--va-text-muted)", padding: "0.5rem 1rem" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── LIBRARY TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === "library" && (
        <div>
          {/* Upload + Search row */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rule prompts..."
              style={{ ...S.input, flex: 1, minWidth: "200px" }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ ...S.btn, background: "var(--va-accent)", color: "white", flexShrink: 0 }}>
              📁 Upload Files
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" multiple onChange={handleFileUpload} style={{ display: "none" }} />
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: "4rem" }}>
              <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</p>
              <p style={{ ...S.muted }}>
                {rules.length === 0
                  ? "No rule prompts yet. Upload files, paste prompts, or type them using the tabs above."
                  : "No prompts match your search."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {filtered.map((rule, i) => (
                <div key={rule.id} style={{ ...S.surface }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.7rem", background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.125rem 0.5rem", borderRadius: "9999px" }}>
                          {rule.source === "file" ? "📁 File" : rule.source === "paste" ? "📋 Paste" : "✏️ Typed"}
                        </span>
                        {rule.refinedContent && (
                          <span style={{ fontSize: "0.7rem", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", padding: "0.125rem 0.5rem", borderRadius: "9999px" }}>
                            ✨ AI Refined
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontWeight: "700", fontSize: "0.95rem", marginBottom: "0.25rem" }}>{rule.title}</h3>
                      <p style={{ ...S.muted, fontSize: "0.75rem" }}>
                        {rule.content === IDB_PLACEHOLDER ? "Large file (stored)" : rule.content.length.toLocaleString() + " chars"}
                        {" · "}{new Date(rule.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, marginLeft: "0.75rem" }}>
                      <button onClick={async () => {
                        const content = await getFullContent(rule);
                        setViewingContent({ title: rule.title, content });
                      }} style={{ ...S.btn, background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.625rem", fontSize: "0.75rem" }}>
                        View
                      </button>
                      {hasGeminiQualityKey() && (
                        <button onClick={() => handleRefine(rule)} disabled={refiningId === rule.id}
                          style={{ ...S.btn, background: "#7c3aed", color: "white", padding: "0.375rem 0.625rem", fontSize: "0.75rem", opacity: refiningId === rule.id ? 0.6 : 1 }}>
                          {refiningId === rule.id ? "✨..." : "✨ Refine"}
                        </button>
                      )}
                      {deleteConfirmId === rule.id ? (
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <button onClick={() => handleDelete(rule.id)} style={{ ...S.btn, background: "#b91c1c", color: "white", padding: "0.375rem 0.625rem", fontSize: "0.75rem" }}>Delete</button>
                          <button onClick={() => setDeleteConfirmId(null)} style={{ ...S.btn, background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.625rem", fontSize: "0.75rem" }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(rule.id)} style={{ ...S.btn, background: "none", border: "1px solid var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.625rem", fontSize: "0.75rem" }}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preview */}
                  {rule.content !== IDB_PLACEHOLDER && (
                    <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--va-border)", paddingTop: "0.75rem" }}>
                      <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                        {(rule.refinedContent || rule.content).slice(0, 300)}{(rule.refinedContent || rule.content).length > 300 ? "..." : ""}
                      </p>
                    </div>
                  )}

                  {/* Show refined vs original toggle */}
                  {rule.refinedContent && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <button onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                        style={{ fontSize: "0.75rem", color: "var(--va-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        {expandedId === rule.id ? "Hide original ▲" : "Show original vs refined ▼"}
                      </button>
                      {expandedId === rule.id && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
                          <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem" }}>
                            <p style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", marginBottom: "0.375rem", fontWeight: "700" }}>ORIGINAL (unchanged)</p>
                            <p style={{ fontSize: "0.78rem", whiteSpace: "pre-wrap", color: "var(--va-text-muted)", lineHeight: "1.5" }}>{rule.content}</p>
                          </div>
                          <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "0.375rem", padding: "0.75rem" }}>
                            <p style={{ fontSize: "0.7rem", color: "#c4b5fd", marginBottom: "0.375rem", fontWeight: "700" }}>✨ AI REFINED (additive)</p>
                            <p style={{ fontSize: "0.78rem", whiteSpace: "pre-wrap", color: "var(--va-text)", lineHeight: "1.5" }}>{rule.refinedContent}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TYPE PROMPT TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "typed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ ...S.surface }}>
            <h3 style={{ fontWeight: "700", marginBottom: "0.75rem" }}>✏️ Type Your Rule Prompt</h3>
            <p style={{ ...S.muted, fontSize: "0.8rem", marginBottom: "1rem" }}>
              Write your world rules, campaign directives, tone guidelines, or any prompt you want the AI to follow.
            </p>
            <input value={typedTitle} onChange={e => setTypedTitle(e.target.value)} placeholder="Title (e.g. 'HP Campaign Core Rules')"
              style={{ ...S.input, marginBottom: "0.75rem" }} />
            <textarea value={typedContent} onChange={e => setTypedContent(e.target.value)}
              placeholder={"Write your rule prompt here...\n\nExample:\n- Never railroad the player. Always respect player choices.\n- Valefor Nightfrost has the Hollow ability — impressions only, never clean answers.\n- Hermione and Valefor's romance is slow and earned, never acknowledged until the player earns it.\n- Major canon events hold unless the player creates believable divergence."}
              style={{ ...S.input, minHeight: "300px", resize: "vertical", fontFamily: "monospace", lineHeight: "1.6" }} />
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
              <button onClick={handleAddTyped} disabled={!typedContent.trim()}
                style={{ ...S.btn, background: "var(--va-accent)", color: "white", opacity: !typedContent.trim() ? 0.4 : 1 }}>
                Save to Rule Book
              </button>
              <button onClick={() => { setTypedTitle(""); setTypedContent(""); }}
                style={{ ...S.btn, background: "none", border: "1px solid var(--va-border)", color: "var(--va-text-muted)" }}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASTE TAB ─────────────────────────────────────────────────────────────── */}
      {activeTab === "paste" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ ...S.surface }}>
            <h3 style={{ fontWeight: "700", marginBottom: "0.75rem" }}>📋 Paste a Rule Prompt</h3>
            <p style={{ ...S.muted, fontSize: "0.8rem", marginBottom: "1rem" }}>
              Paste any prompt from another source — another AI, a document, your notes. No size limit.
            </p>
            <input value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} placeholder="Title for this prompt"
              style={{ ...S.input, marginBottom: "0.75rem" }} />
            <textarea value={pasteContent} onChange={e => setPasteContent(e.target.value)}
              placeholder="Paste your prompt here..."
              style={{ ...S.input, minHeight: "300px", resize: "vertical", fontFamily: "monospace", lineHeight: "1.6" }} />
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
              <button onClick={handleAddPaste} disabled={!pasteContent.trim()}
                style={{ ...S.btn, background: "var(--va-accent)", color: "white", opacity: !pasteContent.trim() ? 0.4 : 1 }}>
                Save to Rule Book
              </button>
              <button onClick={() => { setPasteTitle(""); setPasteContent(""); }}
                style={{ ...S.btn, background: "none", border: "1px solid var(--va-border)", color: "var(--va-text-muted)" }}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEWER MODAL ─────────────────────────────────────────────────────────── */}
      {viewingContent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "1rem", width: "100%", maxWidth: "800px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontWeight: "700" }}>{viewingContent.title}</h3>
              <button onClick={() => setViewingContent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
              <pre style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap", color: "var(--va-text)", lineHeight: "1.7", fontFamily: "monospace" }}>{viewingContent.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 