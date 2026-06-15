"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  hasGeminiKey, hasGeminiQualityKey,
  geminiSmartCategoryReview, geminiGenerateSavePrompt,
  geminiClassifyText, geminiDistillStory, geminiImportStoryToVault
} from "../../lib/geminiEngine";
import {
  addEntry, addPlayerEntry, replaceEntry, loadArchive, saveArchive,
  detectContradiction, regenerateMasterPrompt,
  CATEGORY_LABELS, CATEGORY_ICONS, StoryCategory, VaultEntry, ArchiveData,
  saveInboxFileToIDB, loadInboxFileFromIDB, deleteInboxFileFromIDB, listInboxFilesFromIDB,
} from "@/lib/archiveEngine";

type Suggestion = { text: string; category: StoryCategory };
type ContradictionState = {
  existingEntry: VaultEntry; newText: string; category: StoryCategory;
  remainingQueue: Suggestion[]; currentArchive: ArchiveData;
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as StoryCategory[];

// ─── DEFAULT SAVE EXTRACTION PROMPT ──────────────────────────────────────────
const DEFAULT_SAVE_PROMPT = `# SESSION SAVE — EXTRACTION REQUEST

You are about to help me save my current story/RPG session so I can continue it later with full continuity. Please answer every section below as completely and accurately as possible based on everything that has happened in our session together. Be thorough — missing details will break continuity.

---

## 1. SESSION SUMMARY
Write a detailed paragraph summarizing everything that happened in this session from beginning to end. Include the major beats, turning points, and how the tone shifted.

## 2. CURRENT SCENE
Describe exactly where we are right now:
- Location (name, description, atmosphere)
- Time of day and current conditions
- Who is physically present
- What was happening the moment we stopped

## 3. MY CHARACTER — CURRENT STATUS
- Full name and any titles or aliases
- Current physical appearance and condition (injuries, fatigue, equipment worn)
- Current emotional and psychological state
- Any abilities, powers, or skills used or revealed this session
- Current inventory (important items, weapons, artifacts)
- Any changes to the character from this session

## 4. KEY CHARACTERS ENCOUNTERED
For each significant character met or interacted with this session:
- Name and role
- What was said or revealed
- Current relationship with my character (trust level, tone, attitude)
- Any secrets, lies, or hidden information they carry

## 5. RELATIONSHIPS — CHANGES THIS SESSION
- Which relationships deepened, shifted, or broke
- Any new bonds formed
- Any betrayals, surprises, or emotional moments between characters

## 6. NEW LORE AND WORLD FACTS REVEALED
- History, myths, or secrets learned
- Rules of the world clarified
- Locations discovered or described in detail
- Organizations, factions, or powers revealed

## 7. ACTIVE QUESTS AND OBJECTIVES
For each active quest:
- Quest name and goal
- Who gave it and why
- Progress made this session
- Current obstacles or complications

## 8. UNRESOLVED THREADS
- Open mysteries or unanswered questions
- Conflicts left unresolved
- Promises made or debts owed
- Story hooks planted for future sessions

## 9. SIGNIFICANT DECISIONS MADE
List every major choice made this session, what options were available, what was chosen, and what the immediate consequence was.

## 10. WHAT HAPPENS NEXT
Based on exactly where we stopped:
- What is the immediate situation when we resume?
- What threats or opportunities are active?
- What does my character need to do first?

---

Please answer every section. Do not skip or abbreviate. This information will be used to reconstruct the session in full detail.`;

export default function InboxPage() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [imported, setImported] = useState(false);
  const [contradiction, setContradiction] = useState<ContradictionState | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [copiedSave, setCopiedSave] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [aiClassifying, setAiClassifying] = useState(false);
  const [reviewResults, setReviewResults] = useState<Array<{
    text: string; originalCategory: string; suggestedCategory: string; reason: string; changed: boolean; accepted: boolean;
  }>>([]);
  const [showReview, setShowReview] = useState(false);
  const [dynamicSavePrompt, setDynamicSavePrompt] = useState("");
  const [generatingSavePrompt, setGeneratingSavePrompt] = useState(false);

  // Distill Story state — local queue like canon tab
  type InboxDistillItem = { id: string; sourceId: string; filename: string; status: "queued" | "running" | "done" | "error"; progress: string; result: string; importedCount: number; };
  const [distillQueue, setDistillQueue] = useState<InboxDistillItem[]>([]);
  const distillProcessing = useRef(false);
  const [showDistillPanel, setShowDistillPanel] = useState(false);
  const [distillSourceId, setDistillSourceId] = useState<"paste" | string>("paste");
  const [viewingDistillResult, setViewingDistillResult] = useState("");
  const [viewingDistillTitle, setViewingDistillTitle] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importDoneId, setImportDoneId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"paste" | "files">("paste");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; name: string; size: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load inbox file metadata from IDB on mount
  useEffect(() => {
    const stored = localStorage.getItem("valArchivesInboxFileMeta");
    if (stored) {
      try { setUploadedFiles(JSON.parse(stored)); } catch {}
    }
  }, []);

  function saveFileMeta(files: Array<{ id: string; name: string; size: number }>) {
    setUploadedFiles(files);
    localStorage.setItem("valArchivesInboxFileMeta", JSON.stringify(files));
  }

  // ── Distill Queue Processing ───────────────────────────────────────────────
  useEffect(() => {
    async function processNext() {
      if (distillProcessing.current) return;
      const next = distillQueue.find(i => i.status === "queued");
      if (!next) return;

      distillProcessing.current = true;
      setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "running", progress: "Loading content..." } : i));

      try {
        let content = "";
        if (next.sourceId === "paste") {
          content = input;
        } else {
          const loaded = await loadInboxFileFromIDB(next.sourceId);
          if (!loaded) throw new Error("Could not load file from storage");
          content = loaded;
        }

        const result = await geminiDistillStory(content, next.filename, (msg) => {
          setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, progress: msg } : i));
        });

        setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "done", result, progress: "✓ Distillation complete!" } : i));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "error", progress: "✗ " + msg } : i));
      }

      distillProcessing.current = false;
    }
    processNext();
  }, [distillQueue, input]);

  // ── Import distilled result to Player Story ────────────────────────────────
  async function importToPlayerStory(item: InboxDistillItem) {
    if (!item.result) return;
    setImportingId(item.id);
    setImportDoneId(null);

    try {
      const entries = await geminiImportStoryToVault(item.result, item.filename, (msg) => {
        setDistillQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: msg } : i));
      });

      let archive = loadArchive();
      const seen = new Set<string>();
      for (const entry of entries) {
        const key = entry.text.trim().toLowerCase().slice(0, 60);
        if (seen.has(key)) continue;
        seen.add(key);
        archive = addPlayerEntry(archive, entry.text.trim(), entry.category as StoryCategory);
      }
      saveArchive(regenerateMasterPrompt(archive));

      setDistillQueue(prev => prev.map(i => i.id === item.id ? { ...i, importedCount: entries.length, progress: "✓ " + entries.length + " entries imported to 🎮 Player Story" } : i));
      setImportDoneId(item.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setDistillQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: "✗ Import error: " + msg } : i));
    }
    setImportingId(null);
  }

  // ── File upload — saves content to IDB, metadata to localStorage ──────────
  async function handleFileUpload(files: FileList) {
    const newMeta: Array<{ id: string; name: string; size: number }> = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let text = "";
      if (ext === "txt" || ext === "md") {
        text = await file.text();
      } else if (ext === "pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        try {
          const decoder = new TextDecoder("utf-8", { fatal: false });
          const raw = decoder.decode(bytes);
          const matches = raw.matchAll(/BT\s*([\s\S]*?)ET/g);
          for (const match of matches) {
            const block = match[1];
            const strings = block.matchAll(/\(([^)]*)\)\s*T[jJ]/g);
            for (const s of strings) {
              text += s[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ") + " ";
            }
          }
        } catch {}
        if (text.trim().length < 100) text = `[PDF: ${file.name} — Could not extract text. Use Copy & Paste tab instead.]`;
      }
      if (text) {
        const id = crypto.randomUUID();
        await saveInboxFileToIDB(id, text);
        newMeta.push({ id, name: file.name, size: text.length });
      }
    }
    if (newMeta.length > 0) {
      saveFileMeta([...uploadedFiles, ...newMeta]);
    }
  }

  // ── Add to distill queue ──────────────────────────────────────────────────
  function addFileToDistillQueue(sourceId: "paste" | string) {
    if (!hasGeminiQualityKey()) { alert("Gemini key required. Add it in Settings → AI."); return; }
    if (sourceId === "paste" && !input.trim()) { alert("Nothing to distill. Paste some content first."); return; }
    const meta = sourceId !== "paste" ? uploadedFiles.find(f => f.id === sourceId) : null;
    const filename = meta ? meta.name : "Session Notes";
    if (distillQueue.find(i => i.sourceId === sourceId && (i.status === "queued" || i.status === "running"))) return;
    setDistillQueue(prev => [...prev, {
      id: crypto.randomUUID(), sourceId, filename,
      status: "queued", progress: "Queued", result: "", importedCount: 0
    }]);
  }

  // ── Existing inbox functions ───────────────────────────────────────────────
  function analyzeInput() { setSuggestions([]); setImported(false); }

  function updateCategory(index: number, category: StoryCategory) {
    setSuggestions(prev => prev.map((item, i) => i === index ? { ...item, category } : item));
  }
  function removeSuggestion(index: number) {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  }

  function processNext(queue: Suggestion[], archive: ArchiveData) {
    if (queue.length === 0) {
      // Save to Player Story subtab
      saveArchive(regenerateMasterPrompt(archive));
      setSuggestions([]); setInput(""); setImported(true); setContradiction(null); return;
    }
    const [current, ...rest] = queue;
    const result = detectContradiction(archive, current.text, current.category);
    if (result.hasContradiction && result.existingEntry) {
      setContradiction({ existingEntry: result.existingEntry, newText: current.text, category: current.category, remainingQueue: rest, currentArchive: archive });
      return;
    }
    // Add to Player Story subtab
    processNext(rest, addPlayerEntry(archive, current.text, current.category));
  }

  function importSuggestions() { processNext(suggestions, loadArchive()); }
  function resolveKeepBoth() { if (!contradiction) return; processNext(contradiction.remainingQueue, addPlayerEntry(contradiction.currentArchive, contradiction.newText, contradiction.category)); }
  function resolveReplace() { if (!contradiction) return; processNext(contradiction.remainingQueue, replaceEntry(contradiction.currentArchive, contradiction.existingEntry.id, contradiction.newText, contradiction.category)); }
  function resolveSkip() { if (!contradiction) return; processNext(contradiction.remainingQueue, contradiction.currentArchive); }

  const S = {
    tab: (active: boolean) => ({
      padding: "0.5rem 1.25rem", borderRadius: "0.5rem 0.5rem 0 0", border: "none",
      borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent",
      background: active ? "var(--va-surface)" : "transparent",
      color: active ? "#c4b5fd" : "var(--va-text-muted)",
      cursor: "pointer", fontWeight: active ? "700" : "400", fontSize: "0.875rem",
    } as React.CSSProperties),
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>

      {/* Contradiction Modal */}
      {contradiction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid #92400e", borderRadius: "0.75rem", padding: "2rem", maxWidth: "32rem", width: "100%" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#fbbf24", marginBottom: "0.5rem" }}>⚠️ Contradiction Detected</h2>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>New information may conflict with something already in your Vault.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.25rem" }}>EXISTING</p>
                <p style={{ color: "#fca5a5", fontSize: "0.875rem" }}>{contradiction.existingEntry.text}</p>
              </div>
              <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.25rem" }}>NEW</p>
                <p style={{ color: "#86efac", fontSize: "0.875rem" }}>{contradiction.newText}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button onClick={resolveKeepBoth} style={{ background: "var(--va-accent)", color: "white", padding: "0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Keep Both</button>
              <button onClick={resolveReplace} style={{ background: "#b45309", color: "white", padding: "0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Replace Existing</button>
              <button onClick={resolveSkip} style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* Save Prompt Modal */}
      {showSavePrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-accent)", borderRadius: "0.75rem", padding: "2rem", maxWidth: "56rem", width: "100%", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--va-accent)" }}>💾 Session Save Prompt</h2>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>Send this to your AI to extract everything from your session.</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {hasGeminiKey() && (
                  <button onClick={async () => {
                    setGeneratingSavePrompt(true);
                    const archive = loadArchive();
                    const withPrompt = regenerateMasterPrompt(archive);
                    const dynamic = await geminiGenerateSavePrompt(withPrompt.masterPrompt);
                    if (dynamic) setDynamicSavePrompt(dynamic);
                    setGeneratingSavePrompt(false);
                  }} disabled={generatingSavePrompt}
                    style={{ background: "#7c3aed", color: "white", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: generatingSavePrompt ? 0.6 : 1 }}>
                    {generatingSavePrompt ? "✨ Generating..." : "✨ AI Personalize"}
                  </button>
                )}
                {dynamicSavePrompt && (
                  <button onClick={() => setDynamicSavePrompt("")}
                    style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>
                    Use Default
                  </button>
                )}
                <button onClick={() => { navigator.clipboard.writeText(dynamicSavePrompt || DEFAULT_SAVE_PROMPT); setCopiedSave(true); setTimeout(() => setCopiedSave(false), 2000); }}
                  style={{ background: "var(--va-accent)", color: "white", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
                  {copiedSave ? "✓ Copied!" : "📋 Copy"}
                </button>
                <button onClick={() => { const blob = new Blob([dynamicSavePrompt || DEFAULT_SAVE_PROMPT], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "session_save_prompt.txt"; a.click(); URL.revokeObjectURL(url); }}
                  style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>
                  📄 Export TXT
                </button>
                <button onClick={() => { setShowSavePrompt(false); setDynamicSavePrompt(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>Close</button>
              </div>
            </div>
            {dynamicSavePrompt && <p style={{ fontSize: "0.75rem", color: "#c4b5fd", marginBottom: "0.5rem" }}>✨ AI-personalized for your archive</p>}
            <textarea value={dynamicSavePrompt || DEFAULT_SAVE_PROMPT} onChange={e => dynamicSavePrompt ? setDynamicSavePrompt(e.target.value) : null} readOnly={!dynamicSavePrompt}
              style={{ flex: 1, minHeight: "400px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", outline: "none", resize: "none", fontSize: "0.8rem", fontFamily: "monospace", color: "var(--va-text)", lineHeight: "1.6" }} />
          </div>
        </div>
      )}


      {/* Save Prompt Modal */}
      {showSavePrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-accent)", borderRadius: "0.75rem", padding: "2rem", maxWidth: "56rem", width: "100%", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--va-accent)" }}>💾 Session Save Prompt</h2>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>Send this to your AI to extract everything from your session.</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {hasGeminiKey() && (
                  <button onClick={async () => {
                    setGeneratingSavePrompt(true);
                    const archive = loadArchive();
                    const withPrompt = regenerateMasterPrompt(archive);
                    const dynamic = await geminiGenerateSavePrompt(withPrompt.masterPrompt);
                    if (dynamic) setDynamicSavePrompt(dynamic);
                    setGeneratingSavePrompt(false);
                  }} disabled={generatingSavePrompt}
                    style={{ background: "#7c3aed", color: "white", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: generatingSavePrompt ? 0.6 : 1 }}>
                    {generatingSavePrompt ? "✨ Generating..." : "✨ AI Personalize"}
                  </button>
                )}
                {dynamicSavePrompt && (
                  <button onClick={() => setDynamicSavePrompt("")}
                    style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>
                    Use Default
                  </button>
                )}
                <button onClick={() => { navigator.clipboard.writeText(dynamicSavePrompt || DEFAULT_SAVE_PROMPT); setCopiedSave(true); setTimeout(() => setCopiedSave(false), 2000); }}
                  style={{ background: "var(--va-accent)", color: "white", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
                  {copiedSave ? "✓ Copied!" : "📋 Copy"}
                </button>
                <button onClick={() => { const blob = new Blob([dynamicSavePrompt || DEFAULT_SAVE_PROMPT], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "session_save_prompt.txt"; a.click(); URL.revokeObjectURL(url); }}
                  style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>
                  📄 Export TXT
                </button>
                <button onClick={() => { setShowSavePrompt(false); setDynamicSavePrompt(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>Close</button>
              </div>
            </div>
            {dynamicSavePrompt && <p style={{ fontSize: "0.75rem", color: "#c4b5fd", marginBottom: "0.5rem" }}>✨ AI-personalized for your archive</p>}
            <textarea value={dynamicSavePrompt || DEFAULT_SAVE_PROMPT} onChange={e => dynamicSavePrompt ? setDynamicSavePrompt(e.target.value) : null} readOnly={!dynamicSavePrompt}
              style={{ flex: 1, minHeight: "400px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", outline: "none", resize: "none", fontSize: "0.8rem", fontFamily: "monospace", color: "var(--va-text)", lineHeight: "1.6" }} />
          </div>
        </div>
      )}


      {/* ── Distill Story Side Panel ─────────────────────────────────────────── */}
      {showDistillPanel && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 1001, width: "min(600px, 95vw)", background: "var(--va-surface)", borderLeft: "1px solid var(--va-border)", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.3)" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.2rem" }}>✨ Distill Story</h2>
              <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>Gemini reads your content and creates a structured Story Reference → imports to 🎮 Player Story subtab</p>
            </div>
            <button onClick={() => setShowDistillPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem" }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
            {/* Add to queue */}
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.625rem" }}>Add content to distill queue:</p>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <select value={distillSourceId} onChange={e => setDistillSourceId(e.target.value)}
                  style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "var(--va-text)", fontSize: "0.875rem", outline: "none" }}>
                  <option value="paste">📝 Pasted text in Inbox</option>
                  {uploadedFiles.map(f => <option key={f.id} value={f.id}>📄 {f.name}</option>)}
                </select>
                <button onClick={() => addFileToDistillQueue(distillSourceId)}
                  style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", cursor: "pointer", fontWeight: "700", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                  ✨ Add to Queue
                </button>
              </div>

              <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "0.875rem", fontSize: "0.75rem", color: "var(--va-text-muted)", lineHeight: "1.6" }}>
                Gemini reads your <strong style={{ color: "var(--va-text)" }}>entire content at once</strong> → structured Story Reference → imports to <strong style={{ color: "#c4b5fd" }}>🎮 Player Story subtab only</strong>. You can close this panel while it runs.
              </div>

              {/* Queue list */}
              {distillQueue.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                    Distill Queue ({distillQueue.length})
                  </p>
                  {distillQueue.map(item => {
                    // Parse chunk progress for progress bar: "(2/4) Distilling..."
                    const chunkMatch = item.progress?.match(/\((\d+)\/(\d+)\)/);
                    const currentChunk = chunkMatch ? parseInt(chunkMatch[1]) : 0;
                    const totalChunks = chunkMatch ? parseInt(chunkMatch[2]) : 4;
                    const pct = item.status === "done" ? 100 : item.status === "running" ? Math.round((currentChunk / totalChunks) * 100) : 0;
                    // Time estimate: ~4 min per chunk
                    const chunksLeft = totalChunks - currentChunk;
                    const minsLeft = chunksLeft * 4;
                    const timeEstimate = item.status === "running" && currentChunk > 0
                      ? `~${minsLeft} min remaining`
                      : item.status === "running" && currentChunk === 0
                      ? "~16 min total"
                      : "";

                    return (
                    <div key={item.id} style={{ background: "var(--va-bg)", border: `1px solid ${item.status === "running" ? "#7c3aed" : item.status === "done" ? "#22c55e" : item.status === "error" ? "#ef4444" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.625rem 0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--va-text)" }}>
                          {item.status === "running" ? "⏳" : item.status === "done" ? "✓" : item.status === "error" ? "✗" : "🕐"} {item.filename.replace(/\.[^/.]+$/, "").slice(0, 30)}
                        </span>
                        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                          {timeEstimate && <span style={{ fontSize: "0.65rem", color: "var(--va-text-muted)" }}>{timeEstimate}</span>}
                          {item.status === "done" && item.importedCount === 0 && (
                            <button onClick={() => importToPlayerStory(item)} disabled={importingId === item.id}
                              style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.7rem", fontWeight: "600", opacity: importingId === item.id ? 0.6 : 1 }}>
                              {importingId === item.id ? "Importing..." : "⚡ Import to 🎮 Player Story"}
                            </button>
                          )}
                          {item.importedCount > 0 && (
                            <span style={{ fontSize: "0.7rem", color: "#4ade80", fontWeight: "600" }}>✓ {item.importedCount} imported</span>
                          )}
                          {(item.status === "queued" || item.status === "done" || item.status === "error") && (
                            <button onClick={() => setDistillQueue(prev => prev.filter(i => i.id !== item.id))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.8rem" }}>×</button>
                          )}
                        </div>
                      </div>
                      {/* Progress bar */}
                      {(item.status === "running" || item.status === "done") && (
                        <div style={{ height: "4px", background: "var(--va-border)", borderRadius: "9999px", overflow: "hidden", marginBottom: "0.3rem" }}>
                          <div style={{ height: "100%", background: item.status === "done" ? "#22c55e" : "#7c3aed", borderRadius: "9999px", transition: "width 0.5s", width: pct + "%" }} />
                        </div>
                      )}
                      <p style={{ fontSize: "0.68rem", color: item.status === "error" ? "#f87171" : item.status === "done" ? "#4ade80" : "#c4b5fd", margin: 0 }}>
                        {item.progress}
                      </p>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>📥 Inbox</h1>
          <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Paste session notes, upload files, or distill into structured Player Story entries.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          {hasGeminiQualityKey() && (
            <button onClick={() => setShowDistillPanel(true)}
              style={{ background: "#7c3aed", color: "white", padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
              ✨ Distill Story
            </button>
          )}
          <button onClick={() => setShowSavePrompt(true)}
            style={{ background: "var(--va-surface)", border: "1px solid var(--va-accent)", color: "var(--va-accent)", padding: "0.625rem 1rem", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
            💾 Save Prompt
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--va-border)", marginBottom: "1.25rem", gap: "0.25rem" }}>
        <button style={S.tab(activeTab === "paste")} onClick={() => setActiveTab("paste")}>📝 Copy & Paste</button>
        <button style={S.tab(activeTab === "files")} onClick={() => setActiveTab("files")}>📁 Upload Files</button>
      </div>

      {/* Copy & Paste tab */}
      {activeTab === "paste" && (
        <div>
          <textarea value={input} onChange={e => { setInput(e.target.value); setImported(false); }}
            placeholder={`Paste session notes, character info, story content...\n\nExamples:\n"Valefor arrived at Hogsmeade and found Hermione waiting outside the Three Broomsticks. She looked worried — someone had broken into her dormitory and stolen her notes on the Hollow ability."`}
            style={{ width: "100%", height: "14rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", boxSizing: "border-box" as const, lineHeight: "1.6" }} />

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
            <button onClick={async () => {
              if (!input.trim()) return;
              if (hasGeminiKey()) {
                setAiClassifying(true); setSuggestions([]);
                const aiResults = await geminiClassifyText(input, Object.keys(CATEGORY_LABELS));
                if (aiResults.length > 0) { setSuggestions(aiResults as Suggestion[]); setAiClassifying(false); return; }
                setAiClassifying(false);
              }
            }} disabled={!input.trim() || aiClassifying}
              style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", opacity: (!input.trim() || aiClassifying) ? 0.4 : 1 }}>
              {aiClassifying ? "✨ Classifying..." : hasGeminiKey() ? "✨ Analyze" : "Analyze"}
            </button>
            <button disabled={!suggestions.length} onClick={importSuggestions}
              style={{ background: "#16a34a", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", opacity: !suggestions.length ? 0.4 : 1 }}>
              Import to 🎮 Player Story
            </button>
            {suggestions.length > 0 && hasGeminiKey() && (
              <button onClick={async () => {
                setReviewing(true); setShowReview(false);
                const archive = loadArchive();
                const withPrompt = regenerateMasterPrompt(archive);
                const results = await geminiSmartCategoryReview(suggestions, ALL_CATEGORIES, withPrompt.masterPrompt);
                setReviewResults(results.map(r => ({ ...r, accepted: r.changed }))); setShowReview(true); setReviewing(false);
              }} disabled={reviewing}
                style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", opacity: reviewing ? 0.6 : 1 }}>
                {reviewing ? "✨ Reviewing..." : "✨ AI Smart Review"}
              </button>
            )}
          </div>

          {imported && (
            <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(20,83,45,0.3)", border: "1px solid #15803d", borderRadius: "0.375rem", color: "#4ade80", fontSize: "0.875rem" }}>
              ✓ Imported to 🎮 Player Story subtab. Master Prompt updated.
            </div>
          )}
        </div>
      )}

      {/* Upload Files tab */}
      {activeTab === "files" && (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files); }}
            style={{ border: "2px dashed var(--va-border)", borderRadius: "0.75rem", padding: "2rem", textAlign: "center", cursor: "pointer", marginBottom: "1rem", transition: "border-color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#7c3aed"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--va-border)"}>
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📁</p>
            <p style={{ color: "var(--va-text)", fontWeight: "600", marginBottom: "0.25rem" }}>Click to upload or drag & drop</p>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem" }}>TXT, MD, PDF supported</p>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" multiple onChange={e => { if (e.target.files) handleFileUpload(e.target.files); }} style={{ display: "none" }} />
          </div>

          {uploadedFiles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>Uploaded Files ({uploadedFiles.length})</p>
              {uploadedFiles.map(file => (
                <div key={file.id} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontWeight: "600", fontSize: "0.875rem" }}>📄 {file.name}</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>{file.size.toLocaleString()} chars</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {hasGeminiQualityKey() && (
                      <button onClick={() => { setDistillSourceId(file.id); setShowDistillPanel(true); }}
                        style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.375rem", padding: "0.25rem 0.625rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600" }}>
                        ✨ Distill
                      </button>
                    )}
                    <button onClick={async () => {
                      const dl = await loadInboxFileFromIDB(file.id);
                      if (!dl) return;
                      const blob = new Blob([dl], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = file.name; a.click();
                      URL.revokeObjectURL(url);
                    }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem" }} title="Download">⬇️</button>
                    <button onClick={async () => { await deleteInboxFileFromIDB(file.id); saveFileMeta(uploadedFiles.filter(f => f.id !== file.id)); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1rem" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Smart Review Panel */}
      {showReview && reviewResults.length > 0 && (
        <div style={{ marginTop: "1.5rem", background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontWeight: "bold", color: "#c4b5fd", marginBottom: "0.25rem" }}>✨ AI Smart Review</h3>
              <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>
                {reviewResults.filter(r => r.changed).length} changes suggested · Accept or reject each one
              </p>
            </div>
            <button onClick={() => {
              const updated = suggestions.map(s => {
                const review = reviewResults.find(r => r.text === s.text);
                if (review && review.changed && review.accepted) return { ...s, category: review.suggestedCategory as typeof s.category };
                return s;
              });
              setSuggestions(updated); setShowReview(false); setReviewResults([]);
            }} style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
              Apply Accepted
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {reviewResults.filter(r => r.changed).map((result, i) => (
              <div key={i} style={{ background: "var(--va-bg)", border: `1px solid ${result.accepted ? "#7c3aed" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.75rem" }}>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text)", marginBottom: "0.375rem" }}>{result.text}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", textDecoration: "line-through" }}>{result.originalCategory}</span>
                  <span style={{ fontSize: "0.7rem", color: "#7c3aed" }}>→ {result.suggestedCategory}</span>
                  {result.reason && <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)" }}>({result.reason})</span>}
                  <button onClick={() => setReviewResults(prev => prev.map((r, idx) => idx === reviewResults.indexOf(result) ? { ...r, accepted: !r.accepted } : r))}
                    style={{ marginLeft: "auto", background: result.accepted ? "#7c3aed" : "var(--va-border)", color: result.accepted ? "white" : "var(--va-text-muted)", padding: "0.2rem 0.625rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600" }}>
                    {result.accepted ? "✓ Accept" : "✗ Reject"}
                  </button>
                </div>
              </div>
            ))}
            {reviewResults.filter(r => r.changed).length === 0 && (
              <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", textAlign: "center", padding: "1rem" }}>✓ All classifications look correct.</p>
            )}
          </div>
        </div>
      )}

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            {suggestions.length} entries · Will import to <span style={{ color: "#c4b5fd" }}>🎮 Player Story subtab</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {suggestions.map((item, index) => (
              <div key={index} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "var(--va-text)", fontSize: "0.875rem" }}>{item.text}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                  <span style={{ fontSize: "1.25rem" }}>{CATEGORY_ICONS[item.category]}</span>
                  <select value={item.category} onChange={e => updateCategory(index, e.target.value as StoryCategory)}
                    style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--va-accent)", outline: "none", maxWidth: "140px" }}>
                    {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
                  </select>
                  <button onClick={() => removeSuggestion(index)} style={{ color: "var(--va-text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}