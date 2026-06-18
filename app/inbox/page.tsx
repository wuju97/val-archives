"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  hasGeminiKey, hasGeminiQualityKey,
  geminiSmartCategoryReview, geminiGenerateSavePrompt,
  geminiClassifyText, geminiDistillStory, geminiImportStoryToVault
} from "../../lib/geminiEngine";
import { useDistill } from "../ExtractionContext";
import {
  addEntry, addPlayerEntry, addPlayerEntriesWithSource, replaceEntry, loadArchive, saveArchive,
  detectContradiction, regenerateMasterPrompt, addCanonEntry, removeCanonEntry, addCanonCategory,
  CATEGORY_LABELS, CATEGORY_ICONS, StoryCategory, VaultEntry, ArchiveData, CanonEntry,
  saveInboxFileToIDB, loadInboxFileFromIDB, deleteInboxFileFromIDB, listInboxFilesFromIDB,
} from "@/lib/archiveEngine";

// ─── Full Player Story Distillation Engine Prompt — for use with the user's own AI chat ──
const PLAYER_STORY_DISTILLATION_PROMPT = `# PLAYER STORY DISTILLATION ENGINE

You are an expert RPG Campaign Historian, Continuity Editor, Character Arc Analyst, and Story Archivist.

Your task is to transform the provided story or session material into a Player Story Reference Document.

The purpose of this document is to preserve everything related to the player character's journey, actions, choices, consequences, relationships, growth, achievements, failures, and influence on the world.

This document will be stored separately from Canon Reference Documents.

Focus on the player story, not general world lore.

---

## CRITICAL RULES

1. Record only information explicitly supported by the source material.
2. Preserve chronology.
3. Preserve consequences.
4. Preserve cause-and-effect relationships.
5. Preserve player agency.
6. Preserve character growth.
7. Preserve important conversations.
8. Preserve beliefs, assumptions, and misunderstandings.
9. Record both successes and failures.
10. Record both intended and unintended consequences.
11. Missing information is worse than excessive information.
12. Do not summarize multiple events into a single event if they occurred separately.
13. Preserve emotional and relationship development.
14. Preserve world changes caused by the player.

---

## PLAYER CHARACTER PROFILE

For the player character:

* Name
* Aliases
* Titles
* Occupation
* Role
* Goals
* Motivations
* Fears
* Personality traits
* Beliefs
* Strengths
* Weaknesses
* Current status

Track how these change throughout the story.

---

## PLAYER ACTIONS

Record every significant player action.

For each action include:

* What happened
* Why the player chose it
* Who was involved
* Immediate consequences
* Long-term consequences

---

## PLAYER DECISIONS

Track all important decisions.

For each decision include:

* Situation
* Options available
* Choice made
* Reason for the choice (if known)
* Consequences

---

## PLAYER RELATIONSHIPS

Track all meaningful relationships involving the player.

For each relationship include:

* Participants
* Relationship type
* Starting state
* Important moments
* Changes over time
* Current state

Examples:

* Friendships
* Rivalries
* Romance
* Mentorships
* Alliances
* Enmities

---

## PLAYER KNOWLEDGE

Track what the player character knows.

Include:

* Discoveries
* Secrets learned
* Mysteries investigated
* False assumptions
* Misunderstandings
* Hidden information not yet discovered

Separate:

* What the player believes
* What is actually true

---

## PLAYER INVENTORY & REWARDS

Track:

* Important items gained
* Important items lost
* Artifacts acquired
* Rewards
* Wealth changes
* Titles earned

Include how and when they were obtained.

---

## PLAYER ABILITIES & GROWTH

Track:

* Skills learned
* Powers gained
* Training completed
* Milestones reached
* Character development
* Major growth moments

---

## PLAYER ACHIEVEMENTS

Track:

* Victories
* Accomplishments
* Goals completed
* Challenges overcome
* Important contributions

---

## PLAYER FAILURES

Track:

* Mistakes
* Failed plans
* Defeats
* Consequences
* Lost opportunities

---

## PLAYER IMPACT ON THE WORLD

Track changes caused directly or indirectly by the player.

For each include:

* What changed
* How the player caused it
* Who was affected
* Immediate consequences
* Long-term consequences

---

## PLAYER TIMELINE

Create a chronological timeline.

Do NOT summarize arcs.

Record events individually.

For each event include:

* Approximate date/time
* Participants
* What happened
* Why it happened
* Consequences

Preserve cause-and-effect relationships.

---

## PLAYER CHARACTER ARC

Track the evolution of the player character.

Include:

* Starting state
* Early goals
* Important experiences
* Major decisions
* Internal changes
* Relationship changes
* Turning points
* Current state

---

## STORY DIVERGENCES

Track all ways the player's actions altered events.

For each divergence include:

* Original expected outcome (if known)
* What the player did
* What changed
* Consequences

---

## OPEN THREADS

Track unresolved story elements.

Include:

* Active quests
* Unanswered questions
* Unresolved relationships
* Pending consequences
* Future opportunities

---

## CONTINUITY CHECK

Before finishing:

1. Verify all major player actions are recorded.
2. Verify all major decisions are recorded.
3. Verify all meaningful relationships are recorded.
4. Verify all major consequences are recorded.
5. Verify all major rewards and losses are recorded.
6. Verify chronology remains intact.
7. Verify all major story divergences are recorded.
8. Verify no significant player-related information has been omitted.

---

## SECOND-PASS AUDIT

After completing the document:

* Estimate confidence that no significant player-story information was omitted.
* Identify potentially missed actions.
* Identify potentially missed consequences.
* Identify potentially missed relationships.
* Identify potentially missed character growth moments.
* Identify potentially missed divergences.

Output as a structured Player Story Reference Document.`;

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

## 11. VAULT EXTRACTION HINTS
List any information from this session that should be added to long-term memory.
Include:
- Character development
- New relationships
- Relationship changes
- New powers
- New items
- New locations
- New organizations
- New lore
- New mysteries
- New world changes
- New goals
- New enemies
- New allies
Focus only on information that should persist beyond this session.

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

  // Distill Story — now backed by shared context, survives navigation
  const {
    distillQueue, addToDistillQueue: addToSharedDistillQueue, removeFromDistillQueue,
    pauseDistillItem, resumeDistillItem, cancelDistillItem, restartDistillItem,
    distillImportQueue, importDistillItem, queueStoryReferenceForImport, pauseDistillImportItem, resumeDistillImportItem,
    cancelDistillImportItem, restartDistillImportItem,
  } = useDistill();
  const [showDistillPanel, setShowDistillPanel] = useState(false);
  const [showDistillPromptModal, setShowDistillPromptModal] = useState(false);
  const [storyPromptCopied, setStoryPromptCopied] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSourceId, setImportSourceId] = useState<string>("");
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

  // ── Manual import trigger — calls the shared distillImportQueue ────────────
  function importToPlayerStory(distillItemId: string) {
    importDistillItem(distillItemId);
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

  // ── Add to distill queue — resolves content upfront so it survives navigation ──
  async function addFileToDistillQueue(sourceId: "paste" | string) {
    if (!hasGeminiQualityKey()) { alert("Gemini key required. Add it in Settings → AI."); return; }
    if (sourceId === "paste" && !input.trim()) { alert("Nothing to distill. Paste some content first."); return; }
    const meta = sourceId !== "paste" ? uploadedFiles.find(f => f.id === sourceId) : null;
    const filename = meta ? meta.name : "Session Notes";

    let content = "";
    if (sourceId === "paste") {
      content = input;
    } else {
      const loaded = await loadInboxFileFromIDB(sourceId);
      if (!loaded) { alert("✗ Could not load file from storage"); return; }
      content = loaded;
    }

    addToSharedDistillQueue(crypto.randomUUID(), content, filename);
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


      {/* ── Distill Story Prompt Modal — for use with user's own AI chat ────────── */}
      {showDistillPromptModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1002, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", width: "min(700px, 95vw)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.25rem" }}>✨ Distill Story Prompt</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.78rem" }}>
                  Use this with your own AI chat to distill session notes into a Player Story Reference — avoids API rate limits entirely.
                </p>
              </div>
              <button onClick={() => setShowDistillPromptModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem" }}>×</button>
            </div>

            <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
              <div style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: "0.5rem", padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
                <p style={{ fontWeight: "700", fontSize: "0.875rem", marginBottom: "0.625rem", color: "var(--va-text)" }}>📋 How to use this:</p>
                <ol style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", lineHeight: "1.8", paddingLeft: "1.25rem", margin: 0 }}>
                  <li>Copy the prompt below.</li>
                  <li>Open your own AI chat (ChatGPT, Claude.ai, Gemini app, etc.).</li>
                  <li>Paste the prompt, then paste or upload your session notes / story content in the same message.</li>
                  <li>This focuses entirely on what YOUR character did, decided, learned, and changed — not general world lore (that's what Canon Distill is for).</li>
                  <li>Copy the AI's response (the full Player Story Reference).</li>
                  <li>Come back here, paste it into the input box or upload it as a file, then distill or directly save it as a Story Reference.</li>
                  <li>Click <strong style={{ color: "#c4b5fd" }}>⚡ Import to Vault</strong> to split it into individual facts and send them to 🎮 Player Story.</li>
                </ol>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <p style={{ fontWeight: "600", fontSize: "0.8rem", color: "var(--va-text-muted)" }}>The prompt ({PLAYER_STORY_DISTILLATION_PROMPT.length.toLocaleString()} characters):</p>
                <button onClick={() => {
                  navigator.clipboard.writeText(PLAYER_STORY_DISTILLATION_PROMPT);
                  setStoryPromptCopied(true);
                  setTimeout(() => setStoryPromptCopied(false), 2500);
                }} style={{ background: storyPromptCopied ? "#22c55e" : "#7c3aed", color: "white", border: "none", borderRadius: "0.375rem", padding: "0.4rem 0.875rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600" }}>
                  {storyPromptCopied ? "✓ Copied!" : "📋 Copy Prompt"}
                </button>
              </div>
              <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", maxHeight: "320px", overflowY: "auto" }}>
                <pre style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", whiteSpace: "pre-wrap", fontFamily: "monospace", margin: 0, lineHeight: "1.6" }}>
                  {PLAYER_STORY_DISTILLATION_PROMPT}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Import to Vault Modal — queue-based, picks from Saved Story References ── */}
      {showImportModal && (() => {
        const archive = loadArchive();
        const storyRefCat = (archive.inboxDistillCategories ?? []).find(c => c.name === "Story References");
        const refs = storyRefCat?.entries ?? [];
        return (
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 1000, width: "min(480px, 95vw)", background: "var(--va-surface)", borderLeft: "1px solid var(--va-border)", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.3)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.2rem" }}>⚡ Import to Vault</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>
                  Splits a Story Reference into individual facts — sent to 🎮 Player Story.
                </p>
              </div>
              <button onClick={() => setShowImportModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1.25rem", padding: "0.25rem" }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
              {refs.length === 0 ? (
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
                  No Saved Story References yet. Distill something first — either in-app or by pasting a result from your own AI chat using the Distill Story Prompt.
                </p>
              ) : (
                <>
                  <p style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.75rem" }}>Pick a Story Reference to import:</p>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.875rem" }}>
                    <select
                      value={importSourceId || refs[0]?.id || ""}
                      onChange={e => setImportSourceId(e.target.value)}
                      style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.6rem 0.75rem", color: "var(--va-text)", fontSize: "0.875rem", outline: "none" }}
                    >
                      {refs.map(r => (
                        <option key={r.id} value={r.id}>{r.filename}</option>
                      ))}
                    </select>
                    <button onClick={() => {
                      const id = importSourceId || refs[0]?.id;
                      const ref = refs.find(r => r.id === id);
                      if (!ref) return;
                      queueStoryReferenceForImport(ref.id, ref.content, ref.filename);
                      alert(`✓ "${ref.filename}" added to import queue`);
                    }} style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.5rem", padding: "0.6rem 1rem", cursor: "pointer", fontWeight: "700", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                      ✨ Add
                    </button>
                  </div>
                </>
              )}

              {distillImportQueue.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "0.5rem" }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                    Import Queue ({distillImportQueue.length}) · also tracked in floating panel
                  </p>
                  {distillImportQueue.map(item => (
                    <div key={item.id} style={{ background: "var(--va-bg)", border: `1px solid ${item.status === "running" ? "#7c3aed" : item.status === "paused" ? "#fbbf24" : item.status === "done" ? "#22c55e" : item.status === "error" ? "#ef4444" : item.status === "cancelled" ? "var(--va-text-muted)" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.625rem 0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--va-text)" }}>
                          {item.status === "running" ? "⏳" : item.status === "paused" ? "⏸" : item.status === "done" ? "✓" : item.status === "error" ? "✗" : item.status === "cancelled" ? "⊘" : "🕐"} {item.filename.replace(/\.[^/.]+$/, "")}
                        </span>
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                          {item.status === "running" && (
                            <button onClick={() => pauseDistillImportItem(item.id)}
                              style={{ background: "none", border: "1px solid #fbbf24", borderRadius: "0.25rem", color: "#fbbf24", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Pause</button>
                          )}
                          {item.status === "paused" && (
                            <button onClick={() => resumeDistillImportItem(item.id)}
                              style={{ background: "none", border: "1px solid #22c55e", borderRadius: "0.25rem", color: "#22c55e", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Resume</button>
                          )}
                          {(item.status === "running" || item.status === "queued" || item.status === "paused") && (
                            <button onClick={() => cancelDistillImportItem(item.id)}
                              style={{ background: "none", border: "1px solid #ef4444", borderRadius: "0.25rem", color: "#ef4444", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Cancel</button>
                          )}
                          {(item.status === "error" || item.status === "cancelled") && (
                            <button onClick={() => restartDistillImportItem(item.id)}
                              style={{ background: "none", border: "1px solid #3b82f6", borderRadius: "0.25rem", color: "#93c5fd", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Restart</button>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: "0.68rem", color: item.status === "error" ? "#f87171" : item.status === "done" ? "#4ade80" : item.status === "paused" ? "#fbbf24" : "#c4b5fd", margin: 0 }}>
                        {item.status === "done" ? "✓ " + item.importedCount + " entries imported to Player Story" : item.progress}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Distill Story Side Panel ─────────────────────────────────────────── */}
      {showDistillPanel && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 1001, width: "min(600px, 95vw)", background: "var(--va-surface)", borderLeft: "1px solid var(--va-border)", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.3)" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.2rem" }}>✨ Distill Story (in-app)</h2>
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

              {/* Queue list — now backed by shared context, survives navigation */}
              {distillQueue.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                    Distill Queue ({distillQueue.length}) · also tracked in floating panel
                  </p>
                  {distillQueue.map(item => {
                    const chunkMatch = item.progress?.match(/\((\d+)\/(\d+)\)/);
                    const currentChunk = chunkMatch ? parseInt(chunkMatch[1]) : 0;
                    const totalChunks = chunkMatch ? parseInt(chunkMatch[2]) : 4;
                    const pct = item.status === "done" ? 100 : item.status === "running" ? Math.round((currentChunk / totalChunks) * 100) : 0;
                    const chunksLeft = totalChunks - currentChunk;
                    const minsLeft = chunksLeft * 4;
                    const timeEstimate = item.status === "running" && currentChunk > 0
                      ? `~${minsLeft} min remaining`
                      : item.status === "running" && currentChunk === 0
                      ? "~16 min total"
                      : "";

                    const importItem = distillImportQueue.find(d => d.id === item.id);
                    const importDone = importItem?.status === "done";
                    const importActive = importItem && (importItem.status === "running" || importItem.status === "queued" || importItem.status === "paused");

                    return (
                    <div key={item.id} style={{ background: "var(--va-bg)", border: `1px solid ${item.status === "running" ? "#7c3aed" : item.status === "paused" ? "#fbbf24" : item.status === "done" ? "#22c55e" : item.status === "error" ? "#ef4444" : item.status === "cancelled" ? "var(--va-text-muted)" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.625rem 0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--va-text)" }}>
                          {item.status === "running" ? "⏳" : item.status === "paused" ? "⏸" : item.status === "done" ? "✓" : item.status === "error" ? "✗" : item.status === "cancelled" ? "⊘" : "🕐"} {item.filename.replace(/\.[^/.]+$/, "").slice(0, 30)}
                        </span>
                        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                          {timeEstimate && <span style={{ fontSize: "0.65rem", color: "var(--va-text-muted)" }}>{timeEstimate}</span>}
                          {item.status === "running" && (
                            <button onClick={() => pauseDistillItem(item.id)}
                              style={{ background: "none", border: "1px solid #fbbf24", borderRadius: "0.25rem", color: "#fbbf24", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Pause</button>
                          )}
                          {item.status === "paused" && (
                            <button onClick={() => resumeDistillItem(item.id)}
                              style={{ background: "none", border: "1px solid #22c55e", borderRadius: "0.25rem", color: "#22c55e", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Resume</button>
                          )}
                          {(item.status === "running" || item.status === "queued" || item.status === "paused") && (
                            <button onClick={() => cancelDistillItem(item.id)}
                              style={{ background: "none", border: "1px solid #ef4444", borderRadius: "0.25rem", color: "#ef4444", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Cancel</button>
                          )}
                          {(item.status === "error" || item.status === "cancelled") && (
                            <button onClick={() => restartDistillItem(item.id)}
                              style={{ background: "none", border: "1px solid #3b82f6", borderRadius: "0.25rem", color: "#93c5fd", fontSize: "0.68rem", padding: "0.15rem 0.4rem", cursor: "pointer" }}>Restart</button>
                          )}
                          {item.status === "done" && !importDone && (
                            <button onClick={() => importToPlayerStory(item.id)} disabled={!!importActive}
                              style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.7rem", fontWeight: "600", opacity: importActive ? 0.6 : 1 }}>
                              {importActive ? "Importing..." : "⚡ Import to 🎮 Player Story"}
                            </button>
                          )}
                          {importDone && (
                            <span style={{ fontSize: "0.7rem", color: "#4ade80", fontWeight: "600" }}>✓ {importItem!.importedCount} imported</span>
                          )}
                          {(item.status === "queued" || item.status === "done" || item.status === "error" || item.status === "cancelled") && (
                            <button onClick={() => removeFromDistillQueue(item.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.8rem" }}>×</button>
                          )}
                        </div>
                      </div>
                      {(item.status === "running" || item.status === "done") && (
                        <div style={{ height: "4px", background: "var(--va-border)", borderRadius: "9999px", overflow: "hidden", marginBottom: "0.3rem" }}>
                          <div style={{ height: "100%", background: item.status === "done" ? "#22c55e" : "#7c3aed", borderRadius: "9999px", transition: "width 0.5s", width: pct + "%" }} />
                        </div>
                      )}
                      <p style={{ fontSize: "0.68rem", color: item.status === "error" ? "#f87171" : item.status === "done" ? "#4ade80" : item.status === "paused" ? "#fbbf24" : "#c4b5fd", margin: 0 }}>
                        {importActive ? importItem!.progress : item.progress}
                      </p>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Saved Story References */}
            {(() => {
              const archive = loadArchive();
              const storyRefCat = (archive.inboxDistillCategories ?? []).find(c => c.name === "Story References");
              const refs = storyRefCat?.entries ?? [];
              if (refs.length === 0) return null;
              return (
                <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--va-border)" }}>
                  <p style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.625rem" }}>📄 Saved Story References ({refs.length})</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {refs.slice().reverse().map(ref => (
                      <div key={ref.id} style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ref.filename}</span>
                          <span style={{ fontSize: "0.68rem", color: "var(--va-text-muted)", flexShrink: 0 }}>{ref.content.length.toLocaleString()} chars</span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button onClick={() => { setViewingDistillResult(ref.content); setViewingDistillTitle(ref.filename); }}
                            style={{ background: "var(--va-border)", border: "none", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.7rem" }}>▼ View</button>
                          <button onClick={() => {
                            const blob = new Blob([ref.content], { type: "text/markdown" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = ref.filename.replace(/[^a-z0-9]/gi, "_") + ".md"; a.click();
                            URL.revokeObjectURL(url);
                          }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.8rem" }} title="Download">⬇️</button>
                          <button onClick={async () => {
                            setImportingId(ref.id);
                            try {
                              const entries = await geminiImportStoryToVault(ref.content, ref.filename, () => {});
                              let arc = loadArchive();
                              const cleaned = entries
                                .filter(e => e.text && e.text.trim())
                                .map(e => ({ text: e.text.trim(), category: e.category, entity: (e as any).entity, tags: (e as any).tags }));
                              arc = addPlayerEntriesWithSource(arc, cleaned as Array<{ text: string; category: StoryCategory; entity?: string; tags?: string[] }>, ref.id, ref.filename);
                              saveArchive(regenerateMasterPrompt(arc));
                              alert("✓ " + cleaned.length + " entries processed (duplicates against your vault skipped) — imported to 🎮 Player Story");
                            } catch (e) {
                              alert("✗ Import failed: " + (e instanceof Error ? e.message : "error"));
                            }
                            setImportingId(null);
                          }} disabled={importingId === ref.id}
                            style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "0.25rem", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.7rem", fontWeight: "600", opacity: importingId === ref.id ? 0.6 : 1 }}>
                            {importingId === ref.id ? "Importing..." : "⚡ Re-import"}
                          </button>
                          <button onClick={() => {
                            if (!confirm("Delete this Story Reference file? (Vault entries already imported are not affected)")) return;
                            let arc = loadArchive();
                            const cats = (arc.inboxDistillCategories ?? []).map(c =>
                              c.id !== storyRefCat!.id ? c : { ...c, entries: c.entries.filter(e => e.id !== ref.id) }
                            );
                            saveArchive({ ...arc, inboxDistillCategories: cats });
                          }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.8rem" }}>🗑️</button>
                        </div>
                        {viewingDistillResult === ref.content && (
                          <div style={{ marginTop: "0.625rem", borderTop: "1px solid var(--va-border)", paddingTop: "0.625rem", maxHeight: "240px", overflowY: "auto" }}>
                            <pre style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", whiteSpace: "pre-wrap", fontFamily: "monospace", margin: 0 }}>{ref.content}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
          <button onClick={() => setShowDistillPromptModal(true)}
            style={{ background: "#7c3aed", color: "white", padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
            ✨ Distill Story Prompt
          </button>
          {hasGeminiQualityKey() && (
            <button onClick={() => setShowDistillPanel(true)}
              style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)", color: "#c4b5fd", padding: "0.625rem 1rem", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
              ✨ Distill Story (in-app)
            </button>
          )}
          {hasGeminiKey() && (
            <button onClick={() => setShowImportModal(true)}
              style={{ background: "rgba(124,58,237,0.15)", border: "1px solid #7c3aed", color: "#c4b5fd", padding: "0.625rem 1rem", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
              ⚡ Import to Vault
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
                        ✨ Distill (in-app)
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