"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { hasGeminiKey, hasGeminiQualityKey, geminiCanonPlacement, geminiDistillCanon, geminiRefineDistilledCanon, geminiImportCanonToVault, ExtractedVaultEntry } from "../../lib/geminiEngine";
import { useExtraction, ExtractionQueueItem, useCanonDistill, useCanonImport } from "../ExtractionContext";
import {
  loadArchive, saveArchive, regenerateMasterPrompt, ArchiveData,
  addCanonCategory, removeCanonCategory,
  addCanonEntry, removeCanonEntry,
  getPriorityLevel, setPriority,
  addEntry, addEntriesWithSource, CATEGORY_LABELS,
} from "@/lib/archiveEngine";

// ─── IDB helpers for large canon content ──────────────────────────────────────
const CANON_IDB_PREFIX = "valArchivesCanon_";

function openCanonIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("valArchivesCanonDB", 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("canon")) db.createObjectStore("canon");
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function saveCanonContentToIDB(entryId: string, content: string): Promise<void> {
  try {
    const db = await openCanonIDB();
    const tx = db.transaction("canon", "readwrite");
    tx.objectStore("canon").put(content, CANON_IDB_PREFIX + entryId);
  } catch {}
}

async function loadCanonContentFromIDB(entryId: string): Promise<string | null> {
  try {
    const db = await openCanonIDB();
    return new Promise((resolve) => {
      const tx = db.transaction("canon", "readonly");
      const req = tx.objectStore("canon").get(CANON_IDB_PREFIX + entryId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function deleteCanonContentFromIDB(entryId: string): Promise<void> {
  try {
    const db = await openCanonIDB();
    const tx = db.transaction("canon", "readwrite");
    tx.objectStore("canon").delete(CANON_IDB_PREFIX + entryId);
  } catch {}
}

const LARGE_CONTENT_THRESHOLD = 5000; // chars — above this goes to IDB
const IDB_PLACEHOLDER = "[CONTENT_IN_IDB]"; // marker in localStorage version

// ─── Full Canon Extraction Prompt — for use with the user's own AI chat ────────
const CANON_EXTRACTION_PROMPT = `# CANON EXTRACTION ENGINE

You are an expert Canon Archivist, Lore Analyst, Continuity Editor, and RPG Game Master Assistant.

Your task is to transform the provided source material into a complete canon reference document.

## CRITICAL RULES

1. Treat the source material as absolute canon.
2. Do not invent, infer, speculate, simplify, or fill gaps.
3. Record information exactly as supported by the text.
4. Missing information is worse than excessive information.
5. Preserve chronology, context, motivations, consequences, and relationships.
6. Include both major and minor details whenever they could matter to a Game Master.
7. Assume future story decisions may depend on seemingly insignificant details.
8. If a fact appears only once, include it.
9. If a character appears only briefly, include them.
10. If an event causes later consequences, note both the event and the consequence.
11. Never compress multiple events into one event if they occur separately.
12. Preserve story logic and cause-and-effect chains.
13. Do not replace multiple events with a summary if the original text presents them separately.
14. When in doubt, record more detail rather than less.
15. Preserve important conversations, explanations, revelations, motivations, and consequences, not just outcomes.
16. Track both what happened and why it happened.
17. Track both what characters believe and what is actually true.
18. Record information even if it appears unimportant; it may become relevant later.

---

## EXTRACTION PRIORITY

Extract everything that could matter for:

* Story continuity
* Character behavior
* Worldbuilding
* Future plot developments
* Relationships
* Rules of the setting
* Mysteries
* Secrets
* Organizations
* Political structures
* Historical events
* Magical systems
* Technology systems
* Combat systems
* Social structures

---

## CHARACTERS

For EVERY named character:

* Full name
* Aliases
* Titles
* Physical description
* Personality traits
* Abilities
* Occupation/role
* Goals
* Motivations
* Fears
* Relationships
* History
* Secrets
* Important possessions
* Notable dialogue patterns
* Important actions
* Character development
* Current status

Include:

* Major characters
* Minor characters
* One-scene characters
* Mentioned characters
* Historical characters
* Deceased characters

---

## CHARACTER ARCS

For every major character:

* Starting state
* Initial beliefs
* Major experiences
* Important decisions
* Internal changes
* Relationship changes
* Key successes
* Key failures
* Ending state

Preserve how each character evolves throughout the story.

---

## LOCATIONS

For EVERY location:

* Description
* Physical appearance
* Purpose
* Significance
* Residents
* Factions present
* Events occurring there
* Secrets
* History
* Important objects found there

---

## RELATIONSHIPS

For EVERY meaningful relationship:

* Participants
* Relationship type
* History
* Dynamic
* Conflicts
* Trust level
* Loyalty level
* Evolution over time

---

## POWERS / MAGIC / RULES

Extract:

* Spells
* Powers
* Techniques
* Systems
* Rules
* Limitations
* Costs
* Weaknesses
* Training methods
* Supernatural mechanics

Include exact limitations whenever known.

---

## ITEMS / ARTIFACTS

For EVERY important item:

* Description
* Function
* Owner
* History
* Powers
* Restrictions
* Current status

---

## ORGANIZATIONS

For EVERY group:

* Purpose
* Membership
* Hierarchy
* Goals
* Influence
* Resources
* Rivals
* History

---

## WORLD LORE

Extract:

* History
* Myths
* Legends
* Religions
* Politics
* Geography
* Culture
* Economics
* Laws
* Education
* Social customs

---

## SECRETS AND REVEALS

Track separately:

* Hidden identities
* Mysteries
* Revelations
* Plot twists
* Foreshadowing
* Deceptions
* False assumptions

For each entry include:

* What characters believe
* What is actually true
* Evidence supporting the belief
* When the truth is revealed
* Consequences of the reveal

---

## TIMELINE

Create a chronological timeline.

Do NOT summarize entire arcs into one entry.

Record events individually.

For each event include:

* Approximate date/time
* Participants
* What happened
* Why it happened
* Immediate consequences
* Long-term consequences

Preserve chronology and narrative causality.

---

## CAUSE AND EFFECT CHAINS

For every major event:

* What happened?
* Who caused it?
* Why did they do it?
* How was it accomplished?
* Immediate consequences
* Long-term consequences
* Which future events depended on this event?

Show how events connect rather than treating them as isolated facts.

Preserve narrative causality.

---

## STORY STRUCTURE

Create a complete narrative breakdown.

### BEGINNING

* Initial world state
* Main characters introduced
* Inciting incident
* Initial goals
* Initial conflicts

### RISING ACTION

* Major discoveries
* Investigations
* Obstacles
* Character growth
* Escalating conflicts
* Important decisions

### TURNING POINTS

* Major reveals
* Plot twists
* New information
* Reversals
* Decision points

### CLIMAX

For the final confrontation include:

* Participants
* Objectives
* Sequence of events
* Key decisions
* Reveals
* Outcome
* Why the outcome occurred

### RESOLUTION

* Immediate aftermath
* Character outcomes
* World changes
* Explanations given
* Problems solved
* Remaining consequences

### ENDING STATE

For every major character include:

* Final status
* Current relationships
* Goals moving forward

Also include:

* Unresolved mysteries
* Future story hooks
* Setup for sequels

Preserve story flow from beginning to end.

---

## CONVERSATIONS AND EXPLANATIONS

Extract all major explanatory scenes.

For each include:

* Participants
* Information revealed
* Why the information matters
* Consequences of learning it

Examples:

* Mentor explanations
* Villain monologues
* Mystery solutions
* Historical revelations
* Rule explanations
* End-of-story explanations

Do not reduce important explanations to a single sentence.

---

## CANON SAFETY CHECK

Before finishing:

1. Verify all named characters are listed.
2. Verify all named locations are listed.
3. Verify all organizations are listed.
4. Verify all magical systems/rules are listed.
5. Verify all major plot events appear in the timeline.
6. Verify all major revelations appear in Secrets and Reveals.
7. Verify chronology remains intact.
8. Verify no significant information from the source material has been omitted.

---

## SECOND-PASS AUDIT

After completing the document:

1. Estimate confidence that no significant canon information was omitted.
2. Perform a second-pass review.
3. Identify anything that may have been missed.
4. Identify sections that may need expansion.
5. List potentially overlooked minor characters.
6. List potentially overlooked locations.
7. List potentially overlooked events.
8. List potentially overlooked lore.
9. List potentially overlooked relationships.
10. List potentially overlooked explanations or conversations.

Output the audit separately from the main document.

---

Output as a structured Game Master Reference Document.`;


// ─── Built-in Canon Categories ────────────────────────────────────────────────
const BUILTIN_CATEGORIES = [
  { id: "pdf-files",      name: "PDF Files",       icon: "📄", desc: "Upload PDF documents" },
  { id: "text-files",     name: "Text Files",       icon: "📝", desc: "Upload .txt or .md files" },
  { id: "copy-paste",     name: "Copy & Paste",     icon: "📋", desc: "Paste text directly" },
  { id: "timeline-events",name: "Timeline Events",  icon: "🗓️", desc: "Year-by-year canon events — stored whole, never split" },
];

export default function CanonPage() {
  const { queue, addToQueue, removeFromQueue, saveItemResults, clearCompleted, isRunning, stopExtraction } = useExtraction();
  const { canonDistillQueue, addToCanonDistillQueue, removeFromCanonDistillQueue, pauseCanonDistillItem, resumeCanonDistillItem, cancelCanonDistillItem, restartCanonDistillItem, isCanonDistillRunning } = useCanonDistill();
  const { canonImportQueue, addToCanonImportQueue, removeFromCanonImportQueue, pauseCanonImportItem, resumeCanonImportItem, cancelCanonImportItem, restartCanonImportItem, isCanonImportRunning } = useCanonImport();
  const [archive, setArchive] = useState(loadArchive());
  const [activeCatId, setActiveCatId] = useState<string>("pdf-files");
  const [customCatName, setCustomCatName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [importingEntryId, setImportingEntryId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const [importDone, setImportDone] = useState(false);
  const [msg, setMsg] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [resolvedContent, setResolvedContent] = useState<Record<string, string>>({});
  const [placementResult, setPlacementResult] = useState<{ placement: string; context: string; suggestion: string } | null>(null);
  const [checkingPlacement, setCheckingPlacement] = useState(false);
  const [lastAddedContent, setLastAddedContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Extract to Vault state ──────────────────────────────────────────────────
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractSourceId, setExtractSourceId] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState("");
  const [extractedEntries, setExtractedEntries] = useState<ExtractedVaultEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [extractDone, setExtractDone] = useState(false);
  // Distill state
  const [showDistillPanel, setShowDistillPanel] = useState(false);
  const [showDistillPromptModal, setShowDistillPromptModal] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [distillSourceId, setDistillSourceId] = useState("");
  const [distillProgress, setDistillProgress] = useState("");
  const [distilling, setDistilling] = useState(false);
  const [distilledResult, setDistilledResult] = useState("");
  const [distillTitle, setDistillTitle] = useState("");
  const [refiningDistill, setRefiningDistill] = useState(false);
  const [viewingDistillId, setViewingDistillId] = useState<string | null>(null);
  const [extractTotalParts, setExtractTotalParts] = useState(0);
  const [extractCurrentPart, setExtractCurrentPart] = useState(0);
  const [extractFactsFound, setExtractFactsFound] = useState(0);

  useEffect(() => { setArchive(loadArchive()); }, []);

  const customCats = archive.canonCategories ?? [];
  const allCats = [
    ...BUILTIN_CATEGORIES.map(b => ({ ...b, isBuiltin: true })),
    ...customCats.map(c => ({ id: c.id, name: c.name, icon: "🗂️", desc: "Custom category", isBuiltin: false })),
  ];
  const activeCat = allCats.find(c => c.id === activeCatId) ?? allCats[0];

  function getEntries() {
    if (activeCat.isBuiltin) {
      const found = customCats.find(c => c.id === activeCatId);
      return found?.entries ?? [];
    }
    return customCats.find(c => c.id === activeCatId)?.entries ?? [];
  }

  // All entries across all canon categories (for extract picker)
  function getAllCanonEntries() {
    return (archive.canonCategories ?? []).flatMap(cat => cat.entries.map(e => ({ ...e, catName: cat.name })));
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 6000);
  }

  function saveWithFallback(data: ArchiveData) {
    saveArchive(data);
    setArchive(data);
  }

  function ensureBuiltin(id: string, name: string): typeof archive {
    const a = loadArchive();
    if (!(a.canonCategories ?? []).find(c => c.id === id)) {
      const updated = {
        ...a,
        canonCategories: [...(a.canonCategories ?? []), { id, name, entries: [] }],
      };
      saveArchive(updated);
      setArchive(updated);
      return updated;
    }
    return a;
  }

  // ── Extract to Vault ────────────────────────────────────────────────────────

  function openExtractModal() {
    const allEntries = getAllCanonEntries();
    if (allEntries.length === 0) { flash("✗ No canon entries to extract from. Upload some files first."); return; }
    if (!hasGeminiKey()) { flash("✗ Add your API key in Settings → AI to use this feature."); return; }
    if (allEntries.length > 0) setExtractSourceId(allEntries[0].id);
    setExtractedEntries([]);
    setSelectedEntries(new Set());
    setExtractDone(false);
    setExtractProgress("");
    setViewingQueueItem(null);
    setShowExtractModal(true);
  }

  async function openDistillPanel() {
    const allEntries = getAllCanonEntries();
    if (allEntries.length === 0) { flash("✗ No canon files to distill. Upload files first."); return; }
    if (!hasGeminiQualityKey()) { flash("✗ Distill requires your Gemini API key. Add it in Settings → AI."); return; }
    setDistillSourceId(allEntries[0].id);
    setDistilledResult("");
    setDistillProgress("");
    setDistillTitle("");
    setShowDistillPanel(true);
  }

  async function runDistill() {
    const allEntries = getAllCanonEntries();
    const entry = allEntries.find(e => e.id === distillSourceId);
    if (!entry) return;

    setDistilling(true);
    setDistilledResult("");

    let fullContent = entry.content;
    if (entry.content === IDB_PLACEHOLDER) {
      setDistillProgress("Loading file from storage...");
      const idbContent = await loadCanonContentFromIDB(entry.id);
      if (idbContent) {
        fullContent = idbContent;
      } else {
        setDistillProgress("Error: Could not load file content.");
        setDistilling(false);
        return;
      }
    }

    setDistillTitle(entry.filename.replace(/\.[^/.]+$/, "") + " — Canon Reference");

    try {
      const result = await geminiDistillCanon(fullContent, entry.filename, setDistillProgress);
      setDistilledResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Distillation failed";
      if (msg === "NO_GEMINI_KEY") {
        setDistillProgress("✗ Gemini API key required. Add it in Settings → AI.");
      } else {
        setDistillProgress("✗ Error: " + msg);
      }
    }
    setDistilling(false);
  }

  // ── Add to Distill Queue (now backed by shared context — survives navigation) ──
  async function addToDistillQueue(entryId: string, filename: string) {
    const allEntries = getAllCanonEntries();
    const entry = allEntries.find(e => e.id === entryId);
    if (!entry) { flash("✗ File not found"); return; }

    let fullContent = entry.content;
    if (entry.content === IDB_PLACEHOLDER) {
      const idbContent = await loadCanonContentFromIDB(entry.id);
      if (!idbContent) { flash("✗ Could not load file from storage"); return; }
      fullContent = idbContent;
    }

    addToCanonDistillQueue(entryId, fullContent, filename);
  }

  async function refineDistilledResult() {
    if (!distilledResult) return;
    setRefiningDistill(true);
    try {
      const entry = getAllCanonEntries().find(e => e.id === distillSourceId);
      const refined = await geminiRefineDistilledCanon(distilledResult, entry?.filename ?? "");
      setDistilledResult(refined);
    } catch {}
    setRefiningDistill(false);
  }

  async function saveDistilledAsCanon() {
    if (!distilledResult) return;
    const title = distillTitle || "Distilled Canon";
    // Save to canon archives as a new entry
    const a = loadArchive();
    let storedContent = distilledResult;
    const entryId = crypto.randomUUID();
    if (distilledResult.length > LARGE_CONTENT_THRESHOLD) {
      await saveCanonContentToIDB(entryId, distilledResult);
      storedContent = IDB_PLACEHOLDER;
    }
    const updated = addCanonEntry(a, activeCatId, title, storedContent);
    const lastIdx = updated.canonCategories.findIndex(c => c.id === activeCatId);
    if (lastIdx !== -1) {
      const entries = updated.canonCategories[lastIdx].entries;
      entries[entries.length - 1] = { ...entries[entries.length - 1], id: entryId };
    }
    saveArchive(updated);
    setArchive(updated);
    setShowDistillPanel(false);
    setDistilledResult("");
    flash("✓ Distilled canon saved to Canon Archives — ready to Extract to Vault!");
  }

  async function addFileToQueue() {
    const allEntries = getAllCanonEntries();
    const entry = allEntries.find(e => e.id === extractSourceId);
    if (!entry) return;

    let fullContent = entry.content;
    if (entry.content === IDB_PLACEHOLDER) {
      const idbContent = await loadCanonContentFromIDB(entry.id);
      if (idbContent) {
        fullContent = idbContent;
      } else {
        flash("✗ Could not load file content. Try re-uploading.");
        return;
      }
    }

    addToCanonImportQueue(entry.id, fullContent, entry.filename);
    flash(`✓ "${entry.filename}" added to import queue`);
  }

  const [viewingQueueItem, setViewingQueueItem] = useState<string | null>(null);


  function toggleEntry(i: number) {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function saveSelectedEntries() {
    if (!viewingQueueItem) return;
    const count = saveItemResults(viewingQueueItem, selectedEntries);
    setArchive(loadArchive());
    setViewingQueueItem(null);
    setExtractedEntries([]);
    setExtractDone(false);
    flash(`✓ ${count} entries added to your vault.`);
  }

  // ── Import Canon Reference to Vault (Gemini-powered) ────────────────────────
  // Gemini reads the Canon Reference and outputs flat JSON entries.
  // Atomic save — nothing touches the vault until ALL entries are ready.
  async function importDistilledToVault(entryId: string, entryContent: string, entryFilename: string) {
    if (importingEntryId) return;
    if (!hasGeminiQualityKey()) { flash("✗ Gemini key required for Import to Vault. Add it in Settings → AI."); return; }

    setImportingEntryId(entryId);
    setImportDone(false);
    setImportProgress("Loading file content...");

    try {
      // Get the full content
      let fullContent = entryContent;
      if (entryContent === IDB_PLACEHOLDER) {
        const idbContent = await loadCanonContentFromIDB(entryId);
        if (!idbContent) { flash("✗ Could not load file from storage"); setImportingEntryId(null); return; }
        fullContent = idbContent;
      }

      setImportProgress("Sending to Gemini — this takes 30-60 seconds...");

      // Get all entries from Gemini
      const entries = await geminiImportCanonToVault(
        fullContent,
        entryFilename,
        (msg) => setImportProgress(msg)
      );

      if (entries.length === 0) {
        setImportProgress("✗ Gemini returned no entries. Try again.");
        setImportingEntryId(null);
        return;
      }

      // ATOMIC SAVE — load fresh archive, add all entries, save ONCE
      setImportProgress("Saving " + entries.length + " entries to Canon Story subtab...");
      await new Promise(r => setTimeout(r, 50));

      let currentArchive = loadArchive();
      // Entity-aware dedup now happens inside addEntriesWithSource itself (checks
      // against the whole vault, not just this batch) — just pass entries through as-is.
      const cleaned = entries
        .filter(e => e.text && e.text.trim())
        .map(e => ({ text: e.text.trim(), category: e.category, entity: (e as any).entity, tags: (e as any).tags }));

      currentArchive = addEntriesWithSource(currentArchive, cleaned as any, entryId, entryFilename);

      const refreshed = regenerateMasterPrompt(currentArchive);
      saveArchive(refreshed);
      setArchive({ ...refreshed });

      setImportingEntryId(null);
      setImportDone(true);
      setImportProgress("✓ Done! " + cleaned.length + " entries processed (duplicates against your vault automatically skipped) saved to 📖 Canon Story subtab from " + entryFilename);
      flash("✓ " + entries.length + " entries imported to vault!");

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setImportProgress("✗ Error: " + msg);
      setImportingEntryId(null);
    }
  }


  // ── File upload ─────────────────────────────────────────────────────────────

  async function handleFileUpload(files: FileList | null) {
    if (!files || !activeCatId) return;
    setImporting(true);
    const catName = activeCat.name;
    let a = ensureBuiltin(activeCatId, catName);

    for (const file of Array.from(files)) {
      try {
        let content = "";
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "pdf") {
          content = await new Promise<string>((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = () => {
              const reader = new FileReader();
              reader.onload = async (e) => {
                try {
                  const win = window as any;
                  win.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                  const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
                  const pdf = await win.pdfjsLib.getDocument({ data: typedArray }).promise;
                  const pages: string[] = [];
                  for (let i = 1; i <= Math.min(pdf.numPages, 200); i++) {
                    const page = await pdf.getPage(i);
                    const tc = await page.getTextContent();
                    const txt = tc.items.map((x: any) => x.str).join(" ").replace(/\s+/g, " ").trim();
                    if (txt) pages.push(txt);
                  }
                  const full = pages.join("\n\n");
                  if (!full.trim()) {
                    resolve(`[PDF: ${file.name} — No extractable text. Use Copy & Paste tab instead.]`);
                  } else if (full.length > 150000) {
                    resolve(full.slice(0, 150000) + "\n\n[Truncated — " + file.name + "]");
                  } else {
                    resolve(full);
                  }
                } catch {
                  resolve(`[PDF: ${file.name} — Extraction failed. Please use Copy & Paste tab.]`);
                }
              };
              reader.onerror = () => resolve(`[PDF: ${file.name} — File read error.]`);
              reader.readAsArrayBuffer(file);
            };
            script.onerror = () => resolve(`[PDF: ${file.name} — Could not load PDF reader. Please use Copy & Paste tab.]`);
            if (!(window as any).pdfjsLib) {
              document.head.appendChild(script);
            } else {
              script.onload?.(new Event("load"));
            }
          });
        } else {
          content = await file.text();
        }

        const entryId = crypto.randomUUID();
        const now = new Date().toISOString();
        // Save large content directly to IDB, store placeholder in localStorage
        let storedContent = content;
        if (content.length > LARGE_CONTENT_THRESHOLD) {
          await saveCanonContentToIDB(entryId, content);
          storedContent = IDB_PLACEHOLDER;
        }
        const updated = addCanonEntry(a, activeCatId, file.name, storedContent);
        // Fix the last entry id to match our pre-generated one
        const lastIdx = updated.canonCategories.findIndex(c => c.id === activeCatId);
        if (lastIdx !== -1) {
          const entries = updated.canonCategories[lastIdx].entries;
          entries[entries.length - 1] = { ...entries[entries.length - 1], id: entryId };
        }
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
    saveWithFallback(updated);
    setPasteText(""); setPasteTitle("");
    flash(`✓ "${title}" added to ${catName}`);
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

  async function handleRemoveEntry(entryId: string) {
    if (!confirm("Remove this entry?")) return;
    await deleteCanonContentFromIDB(entryId);
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
  const canonPriority = getPriorityLevel(archive, "canon");
  const entries = getEntries();
  const isTimeline = activeCatId === "timeline-events";
  const allCanonEntries = getAllCanonEntries();

  // Group extracted entries by category for display
  const groupedExtracted: Record<string, Array<{ entry: ExtractedVaultEntry; index: number }>> = {};
  extractedEntries.forEach((entry, i) => {
    if (!groupedExtracted[entry.category]) groupedExtracted[entry.category] = [];
    groupedExtracted[entry.category].push({ entry, index: i });
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", display: "flex", flexDirection: "column" }}>

      {/* ── Floating Progress Indicator (shows during extraction) ──────────── */}
      {extracting && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 2000, background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.75rem", padding: "0.875rem 1.125rem", maxWidth: "320px", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "1rem" }}>⏳</span>
            <span style={{ fontWeight: "700", fontSize: "0.8rem", color: "#c4b5fd" }}>Extracting to Vault...</span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", margin: 0, lineHeight: "1.5" }}>
            {extractTotalParts > 0 ? `Part ${extractCurrentPart} of ${extractTotalParts} — ${extractFactsFound} facts found` : extractProgress || "Starting..."}
          </p>
          <div style={{ marginTop: "0.5rem", height: "3px", background: "var(--va-border)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#7c3aed", borderRadius: "9999px", width: extractTotalParts > 0 ? `${Math.min(100, (extractCurrentPart / extractTotalParts) * 100)}%` : "10%", transition: "width 0.5s" }} />
          </div>
        </div>
      )}


      {/* ── Distill Canon Prompt Modal — for use with user's own AI chat ───────── */}
      {showDistillPromptModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1002, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", width: "min(700px, 95vw)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.25rem" }}>✨ Distill Canon Prompt</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.78rem" }}>
                  Use this with your own AI chat (ChatGPT, Claude, Gemini app, etc.) to avoid API rate limits entirely.
                </p>
              </div>
              <button onClick={() => setShowDistillPromptModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem" }}>×</button>
            </div>

            <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
              <div style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: "0.5rem", padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
                <p style={{ fontWeight: "700", fontSize: "0.875rem", marginBottom: "0.625rem", color: "var(--va-text)" }}>📋 How to use this:</p>
                <ol style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", lineHeight: "1.8", paddingLeft: "1.25rem", margin: 0 }}>
                  <li>Copy the prompt below using the button.</li>
                  <li>Open your own AI chat (ChatGPT, Claude.ai, Gemini app — any AI with a large context window works).</li>
                  <li>Paste the prompt, then upload or paste your book's full text in the same message (or right after, if your AI prefers a separate message).</li>
                  <li>Let it generate the complete Canon Reference Document. For very long books, you may need to ask it to continue if it stops partway, or split the book into a few parts yourself.</li>
                  <li>Copy the AI's response (the full Canon Reference).</li>
                  <li>Come back here, upload it as a new file (or paste it) into Canon Archives.</li>
                  <li>Click <strong style={{ color: "#c4b5fd" }}>⚡ Import to Vault</strong> on that file — Key 1 will split it into individual facts by category, without changing, summarizing, or adding anything.</li>
                </ol>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <p style={{ fontWeight: "600", fontSize: "0.8rem", color: "var(--va-text-muted)" }}>The prompt ({CANON_EXTRACTION_PROMPT.length.toLocaleString()} characters):</p>
                <button onClick={() => {
                  navigator.clipboard.writeText(CANON_EXTRACTION_PROMPT);
                  setPromptCopied(true);
                  setTimeout(() => setPromptCopied(false), 2500);
                }} style={{ background: promptCopied ? "#22c55e" : "#7c3aed", color: "white", border: "none", borderRadius: "0.375rem", padding: "0.4rem 0.875rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600" }}>
                  {promptCopied ? "✓ Copied!" : "📋 Copy Prompt"}
                </button>
              </div>
              <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", maxHeight: "320px", overflowY: "auto" }}>
                <pre style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", whiteSpace: "pre-wrap", fontFamily: "monospace", margin: 0, lineHeight: "1.6" }}>
                  {CANON_EXTRACTION_PROMPT}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Distill Canon Side Panel ─────────────────────────────────────────── */}
      {showDistillPanel && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 1001, width: "min(600px, 95vw)", background: "var(--va-surface)", borderLeft: "1px solid var(--va-border)", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.3)" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.2rem" }}>✨ Distill Canon</h2>
              <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>
                Gemini reads the entire file at once and creates a structured canon reference document
              </p>
            </div>
            <button onClick={() => setShowDistillPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem" }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
            {/* Queue UI */}
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.625rem" }}>Add files to distill queue:</p>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <select value={distillSourceId} onChange={e => setDistillSourceId(e.target.value)}
                  style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "var(--va-text)", fontSize: "0.875rem", outline: "none" }}>
                  {getAllCanonEntries().map(e => (
                    <option key={e.id} value={e.id}>{e.filename}</option>
                  ))}
                </select>
                <button onClick={() => {
                  const entry = getAllCanonEntries().find(e => e.id === distillSourceId);
                  if (entry) addToDistillQueue(entry.id, entry.filename);
                }} style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", cursor: "pointer", fontWeight: "700", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                  ✨ Add to Queue
                </button>
              </div>

              <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "0.875rem", fontSize: "0.75rem", color: "var(--va-text-muted)", lineHeight: "1.6" }}>
                Gemini reads the <strong style={{ color: "var(--va-text)" }}>entire file at once</strong> → structured canon reference → much better extraction results.
                Auto-retries indefinitely if Gemini is busy. You can close this panel and use the site while it runs.
              </div>

              {/* Queue list — now backed by shared context, survives navigation */}
              {canonDistillQueue.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                    Distill Queue ({canonDistillQueue.length}) · also tracked in floating panel
                  </p>
                  {canonDistillQueue.map(item => (
                    <div key={item.id} style={{ background: "var(--va-bg)", border: `1px solid ${item.status === "running" ? "#7c3aed" : item.status === "paused" ? "#fbbf24" : item.status === "done" ? "#22c55e" : item.status === "error" ? "#ef4444" : item.status === "cancelled" ? "var(--va-text-muted)" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.625rem 0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--va-text)" }}>
                          {item.status === "running" ? "⏳" : item.status === "paused" ? "⏸" : item.status === "done" ? "✓" : item.status === "error" ? "✗" : item.status === "cancelled" ? "⊘" : "🕐"} {item.filename.replace(/\.[^/.]+$/, "")}
                        </span>
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                          {item.status === "done" && (
                            <button onClick={() => { setDistilledResult(item.result); setDistillTitle(item.filename.replace(/\.[^/.]+$/, "") + " — Canon Reference"); setViewingDistillId(item.id); }}
                              style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.7rem", fontWeight: "600" }}>
                              View & Save
                            </button>
                          )}
                          {item.status === "running" && (
                            <button onClick={() => pauseCanonDistillItem(item.id)} title="May finish current request first"
                              style={{ background: "none", border: "1px solid #fbbf24", borderRadius: "0.25rem", color: "#fbbf24", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Pause</button>
                          )}
                          {item.status === "paused" && (
                            <button onClick={() => resumeCanonDistillItem(item.id)}
                              style={{ background: "none", border: "1px solid #22c55e", borderRadius: "0.25rem", color: "#22c55e", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Resume</button>
                          )}
                          {(item.status === "running" || item.status === "queued" || item.status === "paused") && (
                            <button onClick={() => cancelCanonDistillItem(item.id)}
                              style={{ background: "none", border: "1px solid #ef4444", borderRadius: "0.25rem", color: "#ef4444", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Cancel</button>
                          )}
                          {(item.status === "error" || item.status === "cancelled") && (
                            <button onClick={() => restartCanonDistillItem(item.id)}
                              style={{ background: "none", border: "1px solid #3b82f6", borderRadius: "0.25rem", color: "#93c5fd", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Restart</button>
                          )}
                          {(item.status === "done" || item.status === "error" || item.status === "cancelled") && (
                            <button onClick={() => removeFromCanonDistillQueue(item.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.8rem" }}>×</button>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: "0.68rem", color: item.status === "error" ? "#f87171" : item.status === "done" ? "#4ade80" : item.status === "paused" ? "#fbbf24" : "#c4b5fd", margin: 0 }}>
                        {item.progress}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Result */}
            {distilledResult && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <p style={{ fontWeight: "700", fontSize: "0.875rem", color: "#4ade80" }}>✓ Distillation complete!</p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={refineDistilledResult} disabled={refiningDistill}
                      style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", opacity: refiningDistill ? 0.6 : 1 }}>
                      {refiningDistill ? "✨ Refining..." : "✨ AI Refine"}
                    </button>
                    <button onClick={() => { setDistilledResult(""); setDistillProgress(""); }}
                      style={{ background: "var(--va-border)", color: "var(--va-text-muted)", border: "none", borderRadius: "0.375rem", padding: "0.375rem 0.625rem", cursor: "pointer", fontSize: "0.75rem" }}>
                      ← Redo
                    </button>
                  </div>
                </div>

                <input value={distillTitle} onChange={e => setDistillTitle(e.target.value)}
                  placeholder="Title for this distilled document..."
                  style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.75rem", boxSizing: "border-box" as const }} />

                <textarea value={distilledResult} onChange={e => setDistilledResult(e.target.value)}
                  style={{ width: "100%", height: "400px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.8rem", lineHeight: "1.7", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" as const }} />

                <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginTop: "0.375rem", marginBottom: "0.75rem" }}>
                  {distilledResult.length.toLocaleString()} chars · Edit above if needed, then save
                </p>
              </div>
            )}
          </div>

          {distilledResult && (
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--va-border)", display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setShowDistillPanel(false)}
                style={{ background: "none", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.6rem 1.25rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem" }}>
                Cancel
              </button>
              <button onClick={saveDistilledAsCanon}
                style={{ flex: 1, background: "#7c3aed", color: "white", border: "none", borderRadius: "0.5rem", padding: "0.6rem", cursor: "pointer", fontWeight: "700", fontSize: "0.875rem" }}>
                ✓ Save to Canon Archives
              </button>
            </div>
          )}

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Import to Vault Side Panel — queue-based, uses Key 1 to split Canon Reference into facts ── */}
      {showExtractModal && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 1000, width: "min(480px, 95vw)", background: "var(--va-surface)", borderLeft: "1px solid var(--va-border)", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.3)" }}>

          {/* Panel header */}
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.2rem" }}>⚡ Import to Vault</h2>
              <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>
                Splits a distilled Canon Reference into individual facts by category — no changes, no summarizing, just sorting.
              </p>
            </div>
            <button onClick={() => setShowExtractModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem", padding: "0.25rem" }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
            <p style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.75rem" }}>Pick a file to import:</p>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.875rem" }}>
              <select
                value={extractSourceId}
                onChange={e => setExtractSourceId(e.target.value)}
                style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.6rem 0.75rem", color: "var(--va-text)", fontSize: "0.875rem", outline: "none" }}
              >
                {getAllCanonEntries().map(e => (
                  <option key={e.id} value={e.id}>{e.filename}</option>
                ))}
              </select>
              <button onClick={addFileToQueue}
                style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1rem", cursor: "pointer", fontWeight: "700", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                ✨ Add
              </button>
            </div>

            <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "0.875rem", fontSize: "0.75rem", color: "var(--va-text-muted)", lineHeight: "1.6" }}>
              Works best on already-distilled Canon Reference files (from Distill Canon, or your own AI chat using the Distill Canon Prompt). You can add multiple files — they'll process one at a time and each gets tracked in the floating panel with pause/cancel/restart.
            </div>

            {/* Queue list — backed by shared context, survives navigation */}
            {canonImportQueue.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  Import Queue ({canonImportQueue.length}) · also tracked in floating panel
                </p>
                {canonImportQueue.map(item => (
                  <div key={item.id} style={{ background: "var(--va-bg)", border: `1px solid ${item.status === "running" ? "#7c3aed" : item.status === "paused" ? "#fbbf24" : item.status === "done" ? "#22c55e" : item.status === "error" ? "#ef4444" : item.status === "cancelled" ? "var(--va-text-muted)" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.625rem 0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--va-text)" }}>
                        {item.status === "running" ? "⏳" : item.status === "paused" ? "⏸" : item.status === "done" ? "✓" : item.status === "error" ? "✗" : item.status === "cancelled" ? "⊘" : "🕐"} {item.filename.replace(/\.[^/.]+$/, "")}
                      </span>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        {item.status === "running" && (
                          <button onClick={() => pauseCanonImportItem(item.id)} title="Pauses after current section"
                            style={{ background: "none", border: "1px solid #fbbf24", borderRadius: "0.25rem", color: "#fbbf24", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Pause</button>
                        )}
                        {item.status === "paused" && (
                          <button onClick={() => resumeCanonImportItem(item.id)}
                            style={{ background: "none", border: "1px solid #22c55e", borderRadius: "0.25rem", color: "#22c55e", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Resume</button>
                        )}
                        {(item.status === "running" || item.status === "queued" || item.status === "paused") && (
                          <button onClick={() => cancelCanonImportItem(item.id)}
                            style={{ background: "none", border: "1px solid #ef4444", borderRadius: "0.25rem", color: "#ef4444", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Cancel</button>
                        )}
                        {(item.status === "error" || item.status === "cancelled") && (
                          <button onClick={() => restartCanonImportItem(item.id)}
                            style={{ background: "none", border: "1px solid #3b82f6", borderRadius: "0.25rem", color: "#93c5fd", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Restart</button>
                        )}
                        {(item.status === "queued" || item.status === "done" || item.status === "error" || item.status === "cancelled") && (
                          <button onClick={() => removeFromCanonImportQueue(item.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.8rem" }}>×</button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: "0.68rem", color: item.status === "error" ? "#f87171" : item.status === "done" ? "#4ade80" : item.status === "paused" ? "#fbbf24" : "#c4b5fd", margin: 0 }}>
                      {item.status === "done" ? "✓ " + item.importedCount + " entries imported to Canon Story" : item.progress}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Distill Canon Prompt button — for use with user's own AI chat, avoids API rate limits */}
          <button onClick={() => setShowDistillPromptModal(true)}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid #7c3aed", background: "#7c3aed", color: "white", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" }}>
            ✨ Distill Canon Prompt
          </button>
          {/* Distill Canon button (in-app, uses your Gemini key/quota) */}
          {hasGeminiQualityKey() && (
            <button onClick={openDistillPanel}
              style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.15)", color: "#c4b5fd", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" }}>
              ✨ Distill Canon (in-app)
            </button>
          )}
          {/* Import to Vault button — opens queue-based picker, uses Key 1 */}
          <button onClick={openExtractModal}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid #7c3aed", background: "rgba(124,58,237,0.15)", color: "#c4b5fd", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" }}>
            ⚡ Import to Vault
          </button>
          <button onClick={handleCanonPriority}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: `2px solid ${canonPriority !== "none" ? (canonPriority === "red" ? "#ef4444" : "#3b82f6") : "var(--va-border)"}`, background: canonPriority !== "none" ? (canonPriority === "red" ? "#ef4444" : "#3b82f6") : "transparent", color: canonPriority !== "none" ? "white" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" }}>
            {canonPriority === "red" ? "🔴 First Priority" : canonPriority === "blue" ? "🔵 Second Priority" : "Set Priority"}
          </button>
        </div>
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
          <div style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
              {activeCat.icon} {activeCat.name}
            </h2>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem" }}>
              {isTimeline ? "⚠️ Timeline Events are stored whole and never split. Exact content appears in Master Prompt as-is." : activeCat.desc}
            </p>
          </div>

          {msg && (
            <div style={{ background: msg.startsWith("✓") ? "rgba(20,83,45,0.3)" : "rgba(127,29,29,0.3)", border: `1px solid ${msg.startsWith("✓") ? "#15803d" : "#7f1d1d"}`, borderRadius: "0.375rem", padding: "0.625rem 1rem", color: msg.startsWith("✓") ? "#4ade80" : "#fca5a5", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {msg}
            </div>
          )}

          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem" }}>

            {activeCatId === "pdf-files" && (
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Upload PDF Files</p>
                <div onClick={() => fileRef.current?.click()}
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

            {activeCatId === "text-files" && (
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Upload Text or Markdown Files</p>
                <div onClick={() => fileRef.current?.click()}
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

            {activeCatId === "copy-paste" && (
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Paste Text Directly</p>
                <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Title (optional)..."
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

            {activeCatId === "timeline-events" && (
              <div>
                <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#93c5fd" }}>
                  🗓️ <strong>Timeline Events behave differently.</strong> Content is stored exactly as you write it — never split or divided.
                </div>
                <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="e.g. Harry Potter Year 1 — 1991 Events"
                  style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`September 1, 1991 — Harry Potter boards the Hogwarts Express...\nSeptember 1, 1991 — Harry meets Ron Weasley and Hermione Granger...`}
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

            {!BUILTIN_CATEGORIES.find(b => b.id === activeCatId) && (
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Add to {activeCat.name}</p>
                <div onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--va-accent)"; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--va-border)"; }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--va-border)"; handleFileUpload(e.dataTransfer.files); }}
                  style={{ border: "2px dashed var(--va-border)", borderRadius: "0.5rem", padding: "1.25rem", textAlign: "center", cursor: "pointer", marginBottom: "1rem", transition: "border-color 0.2s" }}>
                  <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>{importing ? "⏳ Reading..." : "📁 Click to upload file (PDF, TXT, MD)"}</p>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" multiple style={{ display: "none" }} onChange={(e) => handleFileUpload(e.target.files)} />
                <div style={{ borderTop: "1px solid var(--va-border)", paddingTop: "1rem" }}>
                  <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Title (optional)..."
                    style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Or paste text directly..."
                    style={{ width: "100%", height: "120px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.75rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", marginBottom: "0.5rem", boxSizing: "border-box" }} />
                  <button onClick={handlePaste} disabled={!pasteText.trim()}
                    style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !pasteText.trim() ? 0.3 : 1 }}>
                    Add to Archive
                  </button>
                </div>
              </div>
            )}
          </div>

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
                        <span style={{ color: "var(--va-text-muted)", fontSize: "0.7rem", flexShrink: 0 }}>
                          {entry.content === IDB_PLACEHOLDER
                            ? (resolvedContent[entry.id] ? resolvedContent[entry.id].length.toLocaleString() + " chars" : "Large file (stored)")
                            : entry.content.length.toLocaleString() + " chars"}
                        </span>
                        {isTimeline && <span style={{ background: "rgba(59,130,246,0.2)", color: "#93c5fd", fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: "9999px", flexShrink: 0 }}>VERBATIM</span>}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "center" }}>
                        <button onClick={async () => {
                          if (expandedEntry === entry.id) { setExpandedEntry(null); return; }
                          if (entry.content === IDB_PLACEHOLDER && !resolvedContent[entry.id]) {
                            const idb = await loadCanonContentFromIDB(entry.id);
                            if (idb) setResolvedContent(prev => ({ ...prev, [entry.id]: idb }));
                            else { flash("✗ Could not load file from storage"); return; }
                          }
                          setExpandedEntry(entry.id);
                        }} style={{ background: "var(--va-border)", border: "none", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>
                          {expandedEntry === entry.id ? "▲ Hide" : "▼ View"}
                        </button>
                        <button onClick={async () => {
                          let dl = entry.content;
                          if (entry.content === IDB_PLACEHOLDER) {
                            const idb = await loadCanonContentFromIDB(entry.id);
                            if (idb) dl = idb; else { flash("✗ Could not load file"); return; }
                          }
                          const blob = new Blob([dl], { type: "text/markdown" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = entry.filename.replace(/\.[^/.]+$/, "") + ".md";
                          a.click();
                          URL.revokeObjectURL(url);
                        }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem" }} title="Download">⬇️</button>
                        <button onClick={() => handleRemoveEntry(entry.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem" }}>🗑️</button>
                      </div>
                    </div>
                    {expandedEntry === entry.id && (
                      <div style={{ borderTop: "1px solid var(--va-border)", padding: "0.75rem 1rem", maxHeight: "300px", overflowY: "auto" }}>
                        <pre style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", whiteSpace: "pre-wrap", fontFamily: "monospace", margin: 0, lineHeight: "1.6" }}>
                          {entry.content === IDB_PLACEHOLDER ? (resolvedContent[entry.id] ?? "Loading...") : entry.content}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Import to Vault progress */}
              {(importingEntryId || importDone) && importProgress && (
                <div style={{ marginTop: "0.875rem", background: importDone ? "rgba(34,197,94,0.08)" : "rgba(124,58,237,0.08)", border: "1px solid " + (importDone ? "#22c55e" : "#7c3aed"), borderRadius: "0.5rem", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  {importingEntryId && !importDone && <div style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid #7c3aed", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />}
                  <p style={{ fontSize: "0.8rem", color: importDone ? "#4ade80" : "#c4b5fd", margin: 0, flex: 1 }}>{importProgress}</p>
                  {importDone && <button onClick={() => { setImportDone(false); setImportProgress(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1rem", flexShrink: 0 }}>✕</button>}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}