"use client";

import { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";
import {
  geminiExtractCanonToVault, ExtractedVaultEntry,
  geminiDistillStory, geminiImportStoryToVault,
  geminiDistillCanon, geminiImportCanonToVault,
} from "../lib/geminiEngine";
import {
  loadArchive, loadArchiveAsync, saveArchive, addEntry, addPlayerEntry,
  addEntriesWithSource, addPlayerEntriesWithSource, StoryCategory,
  addCanonEntry,
} from "../lib/archiveEngine";

// ── Shared status type for all 4 queues ──────────────────────────────────────
type QueueStatus = "queued" | "running" | "paused" | "done" | "error" | "cancelled";

export interface ExtractionQueueItem {
  id: string;
  filename: string;
  content: string;
  status: QueueStatus;
  currentPart: number;
  totalParts: number;
  factsFound: number;
  results: ExtractedVaultEntry[];
  message: string;
  savedCount?: number;
}

export interface DistillQueueItem {
  id: string;
  filename: string;
  content: string;
  status: QueueStatus;
  progress: string;
  result: string;
  importedCount: number;
}

export interface CanonDistillQueueItem {
  id: string;
  filename: string;
  content: string;
  status: QueueStatus;
  progress: string;
  result: string;
  canonCategoryId?: string; // which canon category to save the result into, once distilled
}

export interface CanonImportQueueItem {
  id: string;
  filename: string;        // display name of the Canon Reference being imported
  canonContent: string;    // the Canon Reference text to import
  status: QueueStatus;
  progress: string;
  importedCount: number;
}

interface ExtractionContextType {
  // Raw extraction (txt → vault, no distill step)
  queue: ExtractionQueueItem[];
  addToQueue: (id: string, content: string, filename: string) => void;
  removeFromQueue: (id: string) => void;
  saveItemResults: (id: string, selectedIndices: Set<number>) => Promise<number>;
  clearCompleted: () => void;
  isRunning: boolean;
  retryItem: (id: string) => void;
  stopExtraction: () => void;

  // Inbox Distill Story
  distillQueue: DistillQueueItem[];
  addToDistillQueue: (id: string, content: string, filename: string) => void;
  removeFromDistillQueue: (id: string) => void;
  pauseDistillItem: (id: string) => void;
  resumeDistillItem: (id: string) => void;
  cancelDistillItem: (id: string) => void;
  restartDistillItem: (id: string) => void;
  isDistillRunning: boolean;

  // Inbox Import (separate manual step, triggered after reviewing distilled result)
  distillImportQueue: Array<{ id: string; filename: string; storyContent: string; status: QueueStatus; progress: string; importedCount: number }>;
  importDistillItem: (distillItemId: string) => void;
  pauseDistillImportItem: (id: string) => void;
  resumeDistillImportItem: (id: string) => void;
  cancelDistillImportItem: (id: string) => void;
  restartDistillImportItem: (id: string) => void;
  isDistillImportRunning: boolean;

  // Canon Distill
  canonDistillQueue: CanonDistillQueueItem[];
  addToCanonDistillQueue: (id: string, content: string, filename: string, canonCategoryId?: string) => void;
  removeFromCanonDistillQueue: (id: string) => void;
  pauseCanonDistillItem: (id: string) => void;
  resumeCanonDistillItem: (id: string) => void;
  cancelCanonDistillItem: (id: string) => void;
  restartCanonDistillItem: (id: string) => void;
  isCanonDistillRunning: boolean;

  // Canon Import to Vault
  canonImportQueue: CanonImportQueueItem[];
  addToCanonImportQueue: (id: string, canonContent: string, filename: string) => void;
  removeFromCanonImportQueue: (id: string) => void;
  pauseCanonImportItem: (id: string) => void;
  resumeCanonImportItem: (id: string) => void;
  cancelCanonImportItem: (id: string) => void;
  restartCanonImportItem: (id: string) => void;
  isCanonImportRunning: boolean;
}

const ExtractionContext = createContext<ExtractionContextType>({
  queue: [], addToQueue: () => {}, removeFromQueue: () => {}, saveItemResults: async () => 0,
  clearCompleted: () => {}, isRunning: false, retryItem: () => {}, stopExtraction: () => {},

  distillQueue: [], addToDistillQueue: () => {}, removeFromDistillQueue: () => {},
  pauseDistillItem: () => {}, resumeDistillItem: () => {}, cancelDistillItem: () => {}, restartDistillItem: () => {},
  isDistillRunning: false,

  distillImportQueue: [], importDistillItem: () => {},
  pauseDistillImportItem: () => {}, resumeDistillImportItem: () => {}, cancelDistillImportItem: () => {}, restartDistillImportItem: () => {},
  isDistillImportRunning: false,

  canonDistillQueue: [], addToCanonDistillQueue: () => {}, removeFromCanonDistillQueue: () => {},
  pauseCanonDistillItem: () => {}, resumeCanonDistillItem: () => {}, cancelCanonDistillItem: () => {}, restartCanonDistillItem: () => {},
  isCanonDistillRunning: false,

  canonImportQueue: [], addToCanonImportQueue: () => {}, removeFromCanonImportQueue: () => {},
  pauseCanonImportItem: () => {}, resumeCanonImportItem: () => {}, cancelCanonImportItem: () => {}, restartCanonImportItem: () => {},
  isCanonImportRunning: false,
});

export function ExtractionProvider({ children }: { children: ReactNode }) {
  // ── Raw Extraction queue (unchanged from before) ────────────────────────────
  const [queue, setQueue] = useState<ExtractionQueueItem[]>([]);
  const isProcessing = useRef(false);
  const abortRef = useRef(false);

  // ── Inbox Distill queue ──────────────────────────────────────────────────────
  const [distillQueue, setDistillQueue] = useState<DistillQueueItem[]>([]);
  const isDistillProcessing = useRef(false);
  const distillAbortFlags = useRef<Record<string, "pause" | "cancel" | null>>({});

  // ── Canon Distill queue ───────────────────────────────────────────────────────
  const [canonDistillQueue, setCanonDistillQueue] = useState<CanonDistillQueueItem[]>([]);
  const isCanonDistillProcessing = useRef(false);
  const canonDistillAbortFlags = useRef<Record<string, "pause" | "cancel" | null>>({});

  // ── Canon Import queue ────────────────────────────────────────────────────────
  const [canonImportQueue, setCanonImportQueue] = useState<CanonImportQueueItem[]>([]);
  const isCanonImportProcessing = useRef(false);
  const canonImportAbortFlags = useRef<Record<string, "pause" | "cancel" | null>>({});

  // Draggable floating panel position
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  function onMouseDown(e: React.MouseEvent) {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: popupPos.x, py: popupPos.y };
  }
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      setPopupPos({ x: dragStart.current.px + (e.clientX - dragStart.current.mx), y: dragStart.current.py + (e.clientY - dragStart.current.my) });
    }
    function onMouseUp() { setDragging(false); }
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  // ════════════════════════════════════════════════════════════════════════════
  // RAW EXTRACTION QUEUE (existing, unchanged behavior)
  // ════════════════════════════════════════════════════════════════════════════
  function updateItem(id: string, updates: Partial<ExtractionQueueItem>) {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }
  function addToQueue(id: string, content: string, filename: string) {
    setQueue(prev => {
      if (prev.find(item => item.id === id && (item.status === "queued" || item.status === "running"))) return prev;
      return [...prev, { id, filename, content, status: "queued" as QueueStatus, currentPart: 0, totalParts: Math.ceil(Math.min(content.length, 800000) / 40000), factsFound: 0, results: [], message: "Queued" }];
    });
  }
  function stopExtraction() {
    abortRef.current = true;
    setQueue(prev => prev.map(item => item.status === "running" ? { ...item, status: "error", message: "Stopped by user" } : item));
    setTimeout(() => { isProcessing.current = false; abortRef.current = false; }, 500);
  }
  function retryItem(id: string) {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, status: "queued", currentPart: 0, factsFound: 0, results: [], message: "Retrying..." } : item));
  }
  function removeFromQueue(id: string) {
    setQueue(prev => prev.filter(item => item.id !== id));
  }
  async function saveItemResults(id: string, selectedIndices: Set<number>): Promise<number> {
    const item = queue.find(i => i.id === id);
    if (!item || item.results.length === 0) return 0;
    const archive = await loadArchiveAsync();
    let updated = archive;
    let count = 0;
    for (const i of selectedIndices) {
      const entry = item.results[i];
      if (!entry) continue;
      updated = addEntry(updated, entry.text, entry.category as any);
      count++;
    }
    saveArchive(updated);
    updateItem(id, { savedCount: count });
    return count;
  }
  function clearCompleted() {
    setQueue(prev => prev.filter(item => item.status === "queued" || item.status === "running"));
  }

  useEffect(() => {
    async function processNext() {
      if (isProcessing.current) return;
      const nextItem = queue.find(item => item.status === "queued");
      if (!nextItem) return;
      isProcessing.current = true;
      abortRef.current = false;
      updateItem(nextItem.id, { status: "running", message: "Starting..." });
      try {
        const cappedContent = nextItem.content.slice(0, 800000);
        const totalParts = Math.ceil(cappedContent.length / 40000);
        updateItem(nextItem.id, { totalParts });
        const results = await geminiExtractCanonToVault(cappedContent, nextItem.filename, (msg) => {
          if (abortRef.current) return;
          const partMatch = msg.match(/part (\d+) of (\d+)/i) || msg.match(/Processing part (\d+) of (\d+)/i);
          const factsMatch = msg.match(/\((\d+) facts/);
          const completeMatch = msg.startsWith("Complete") ? msg.match(/(\d+) facts/) : null;
          setQueue(prev => prev.map(item => item.id !== nextItem.id ? item : {
            ...item, message: msg,
            currentPart: partMatch ? parseInt(partMatch[1]) : item.currentPart,
            totalParts: partMatch ? parseInt(partMatch[2]) : item.totalParts,
            factsFound: completeMatch ? parseInt(completeMatch[1]) : factsMatch ? parseInt(factsMatch[1]) : item.factsFound,
          }));
        });
        updateItem(nextItem.id, { status: "done", results, factsFound: results.length, message: `Complete — ${results.length} facts extracted`, currentPart: totalParts });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Extraction failed";
        updateItem(nextItem.id, { status: "error", message: msg });
      }
      isProcessing.current = false;
    }
    processNext();
  }, [queue]);

  // ════════════════════════════════════════════════════════════════════════════
  // INBOX DISTILL QUEUE — Distill Story + Import to Player Story, pause/cancel/restart
  // ════════════════════════════════════════════════════════════════════════════
  function addToDistillQueue(id: string, content: string, filename: string) {
    if (distillQueue.find(i => i.id === id && (i.status === "queued" || i.status === "running"))) return;
    setDistillQueue(prev => [...prev, { id, filename, content, status: "queued" as QueueStatus, progress: "Queued", result: "", importedCount: 0 }]);
  }
  function removeFromDistillQueue(id: string) {
    delete distillAbortFlags.current[id];
    setDistillQueue(prev => prev.filter(i => i.id !== id));
  }
  function pauseDistillItem(id: string) {
    distillAbortFlags.current[id] = "pause";
    setDistillQueue(prev => prev.map(i => i.id === id ? { ...i, status: "paused", progress: "⏸ Pausing — will stop at next checkpoint..." } : i));
  }
  function resumeDistillItem(id: string) {
    distillAbortFlags.current[id] = null;
    setDistillQueue(prev => prev.map(i => i.id === id ? { ...i, status: "queued", progress: "Resuming..." } : i));
  }
  function cancelDistillItem(id: string) {
    distillAbortFlags.current[id] = "cancel";
    setDistillQueue(prev => prev.map(i => i.id === id ? { ...i, status: "cancelled", progress: "✗ Cancelled by user" } : i));
  }
  function restartDistillItem(id: string) {
    distillAbortFlags.current[id] = null;
    setDistillQueue(prev => prev.map(i => i.id === id ? { ...i, status: "queued", progress: "Restarting from beginning...", result: "", importedCount: 0 } : i));
  }

  // NOTE: This queue only DISTILLS (produces a Story Reference document and saves it
  // to Inbox's "Story References" list). It does NOT auto-import — matching the existing
  // Inbox workflow where the user reviews the distilled result before manually importing.
  // Use importDistillResult() below for the separate manual import step.
  useEffect(() => {
    async function processNextDistill() {
      if (isDistillProcessing.current) return;
      const next = distillQueue.find(i => i.status === "queued");
      if (!next) return;
      isDistillProcessing.current = true;
      setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "running", progress: "Loading content..." } : i));

      const checkAbort = () => distillAbortFlags.current[next.id] === "pause" || distillAbortFlags.current[next.id] === "cancel";

      try {
        const result = await geminiDistillStory(next.content, next.filename, (msg) => {
          setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, progress: msg } : i));
        }, checkAbort);

        if (distillAbortFlags.current[next.id] === "cancel") {
          setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "cancelled", progress: "✗ Cancelled by user" } : i));
          isDistillProcessing.current = false;
          return;
        }
        if (distillAbortFlags.current[next.id] === "pause") {
          setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "paused", result, progress: "⏸ Paused — click Resume to restart distillation" } : i));
          isDistillProcessing.current = false;
          return;
        }

        // Save Story Reference to inboxDistillCategories — persists like Canon References
        let archive = loadArchive();
        const refFilename = next.filename.replace(/\.[^/.]+$/, "") + " — Story Reference";
        let inboxCats = archive.inboxDistillCategories ?? [];
        let defaultCat = inboxCats.find(c => c.name === "Story References");
        if (!defaultCat) {
          defaultCat = { id: crypto.randomUUID(), name: "Story References", entries: [] };
          inboxCats = [...inboxCats, defaultCat];
        }
        const newRefEntry = { id: next.id, filename: refFilename, content: result, addedAt: new Date().toISOString() };
        inboxCats = inboxCats.map(c => c.id === defaultCat!.id ? { ...c, entries: [...c.entries, newRefEntry] } : c);
        saveArchive({ ...archive, inboxDistillCategories: inboxCats });

        setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "done", result, progress: "✓ Distillation complete! Story Reference saved — review it, then import when ready." } : i));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "error", progress: "✗ " + msg } : i));
      }
      isDistillProcessing.current = false;
    }
    processNextDistill();
  }, [distillQueue]);

  const isDistillRunning = distillQueue.some(i => i.status === "running");

  // ── Manual import step — call this when the user clicks "Import to Player Story" ──
  // Reuses the Canon Import queue's abort-flag pattern but writes to Player Story.
  // Exposed via useDistill() as importDistillItem.
  const distillImportAbortFlags = useRef<Record<string, "pause" | "cancel" | null>>({});
  const isDistillImportProcessing = useRef(false);
  const [distillImportQueue, setDistillImportQueue] = useState<Array<{ id: string; filename: string; storyContent: string; status: QueueStatus; progress: string; importedCount: number }>>([]);

  function importDistillItem(distillItemId: string) {
    const item = distillQueue.find(i => i.id === distillItemId);
    if (!item || !item.result) return;
    if (distillImportQueue.find(i => i.id === distillItemId && (i.status === "running" || i.status === "queued" || i.status === "paused"))) return;
    setDistillImportQueue(prev => [...prev, { id: distillItemId, filename: item.filename, storyContent: item.result, status: "queued" as QueueStatus, progress: "Queued", importedCount: 0 }]);
  }
  function pauseDistillImportItem(id: string) {
    distillImportAbortFlags.current[id] = "pause";
    setDistillImportQueue(prev => prev.map(i => i.id === id ? { ...i, status: "paused", progress: "⏸ Pausing — will stop after current section..." } : i));
  }
  function resumeDistillImportItem(id: string) {
    distillImportAbortFlags.current[id] = null;
    setDistillImportQueue(prev => prev.map(i => i.id === id ? { ...i, status: "queued", progress: "Resuming — restarting import..." } : i));
  }
  function cancelDistillImportItem(id: string) {
    distillImportAbortFlags.current[id] = "cancel";
    setDistillImportQueue(prev => prev.map(i => i.id === id ? { ...i, status: "cancelled", progress: "✗ Cancelled by user" } : i));
  }
  function restartDistillImportItem(id: string) {
    distillImportAbortFlags.current[id] = null;
    setDistillImportQueue(prev => prev.map(i => i.id === id ? { ...i, status: "queued", progress: "Restarting from beginning...", importedCount: 0 } : i));
  }

  useEffect(() => {
    async function processNextDistillImport() {
      if (isDistillImportProcessing.current) return;
      const next = distillImportQueue.find(i => i.status === "queued");
      if (!next) return;
      isDistillImportProcessing.current = true;
      setDistillImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "running", progress: "Starting import..." } : i));

      const checkAbort = () => distillImportAbortFlags.current[next.id] === "pause" || distillImportAbortFlags.current[next.id] === "cancel";

      try {
        const entries = await geminiImportStoryToVault(next.storyContent, next.filename, (msg) => {
          setDistillImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, progress: msg } : i));
        }, checkAbort);

        if (distillImportAbortFlags.current[next.id] === "cancel") {
          setDistillImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "cancelled", progress: "✗ Cancelled by user" } : i));
          isDistillImportProcessing.current = false;
          return;
        }
        if (distillImportAbortFlags.current[next.id] === "pause") {
          setDistillImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "paused", progress: "⏸ Paused — " + entries.length + " entries so far. Resume restarts from the beginning." } : i));
          isDistillImportProcessing.current = false;
          return;
        }

        let archive = loadArchive();
        const seen = new Set<string>();
        const deduped: Array<{ text: string; category: string }> = [];
        for (const entry of entries) {
          const key = entry.text.trim().toLowerCase().slice(0, 60);
          if (seen.has(key)) continue;
          seen.add(key); deduped.push({ text: entry.text.trim(), category: entry.category });
        }
        archive = addPlayerEntriesWithSource(archive, deduped as Array<{ text: string; category: StoryCategory }>, next.id, next.filename);
        saveArchive(archive);

        setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, importedCount: deduped.length } : i));
        setDistillImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "done", importedCount: deduped.length, progress: "✓ " + deduped.length + " entries imported to Player Story" } : i));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setDistillImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "error", progress: "✗ " + msg } : i));
      }
      isDistillImportProcessing.current = false;
    }
    processNextDistillImport();
  }, [distillImportQueue]);

  const isDistillImportRunning = distillImportQueue.some(i => i.status === "running");

  // ════════════════════════════════════════════════════════════════════════════
  // CANON DISTILL QUEUE — Distill Canon, pause/cancel/restart
  // ════════════════════════════════════════════════════════════════════════════
  function addToCanonDistillQueue(id: string, content: string, filename: string, canonCategoryId?: string) {
    if (canonDistillQueue.find(i => i.id === id && (i.status === "queued" || i.status === "running"))) return;
    setCanonDistillQueue(prev => [...prev, { id, filename, content, status: "queued" as QueueStatus, progress: "Queued", result: "", canonCategoryId }]);
  }
  function removeFromCanonDistillQueue(id: string) {
    delete canonDistillAbortFlags.current[id];
    setCanonDistillQueue(prev => prev.filter(i => i.id !== id));
  }
  function pauseCanonDistillItem(id: string) {
    // NOTE: Distill Canon is a single non-chunked Gemini call (whole book read at once).
    // Pause can only take effect before the call starts or during a rate-limit retry wait.
    canonDistillAbortFlags.current[id] = "pause";
    setCanonDistillQueue(prev => prev.map(i => i.id === id ? { ...i, status: "paused", progress: "⏸ Pausing — will stop at next safe checkpoint (may finish current request first)..." } : i));
  }
  function resumeCanonDistillItem(id: string) {
    canonDistillAbortFlags.current[id] = null;
    setCanonDistillQueue(prev => prev.map(i => i.id === id ? { ...i, status: "queued", progress: "Resuming — restarting distillation..." } : i));
  }
  function cancelCanonDistillItem(id: string) {
    canonDistillAbortFlags.current[id] = "cancel";
    setCanonDistillQueue(prev => prev.map(i => i.id === id ? { ...i, status: "cancelled", progress: "✗ Cancelled by user" } : i));
  }
  function restartCanonDistillItem(id: string) {
    canonDistillAbortFlags.current[id] = null;
    setCanonDistillQueue(prev => prev.map(i => i.id === id ? { ...i, status: "queued", progress: "Restarting from beginning...", result: "" } : i));
  }

  useEffect(() => {
    async function processNextCanonDistill() {
      if (isCanonDistillProcessing.current) return;
      const next = canonDistillQueue.find(i => i.status === "queued");
      if (!next) return;
      isCanonDistillProcessing.current = true;
      setCanonDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "running", progress: "Sending to Gemini for distillation..." } : i));

      const checkAbort = () => canonDistillAbortFlags.current[next.id] === "pause" || canonDistillAbortFlags.current[next.id] === "cancel";

      try {
        const result = await geminiDistillCanon(next.content, next.filename, (msg) => {
          setCanonDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, progress: msg } : i));
        }, checkAbort);

        if (canonDistillAbortFlags.current[next.id] === "cancel") {
          setCanonDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "cancelled", progress: "✗ Cancelled by user" } : i));
          isCanonDistillProcessing.current = false;
          return;
        }
        if (canonDistillAbortFlags.current[next.id] === "pause") {
          setCanonDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "paused", progress: "⏸ Paused — click Resume to restart distillation" } : i));
          isCanonDistillProcessing.current = false;
          return;
        }

        // Save the distilled Canon Reference into the requested canon category
        if (next.canonCategoryId && result) {
          let archive = loadArchive();
          archive = addCanonEntry(archive, next.canonCategoryId, next.filename.replace(/\.[^/.]+$/, "") + " — Canon Reference", result);
          saveArchive(archive);
        }

        setCanonDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "done", result, progress: "✓ Distillation complete! Canon Reference saved." } : i));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setCanonDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "error", progress: "✗ " + msg } : i));
      }
      isCanonDistillProcessing.current = false;
    }
    processNextCanonDistill();
  }, [canonDistillQueue]);

  const isCanonDistillRunning = canonDistillQueue.some(i => i.status === "running");

  // ════════════════════════════════════════════════════════════════════════════
  // CANON IMPORT QUEUE — Import Canon Reference to Vault, pause/cancel/restart
  // ════════════════════════════════════════════════════════════════════════════
  function addToCanonImportQueue(id: string, canonContent: string, filename: string) {
    if (canonImportQueue.find(i => i.id === id && (i.status === "queued" || i.status === "running"))) return;
    setCanonImportQueue(prev => [...prev, { id, filename, canonContent, status: "queued" as QueueStatus, progress: "Queued", importedCount: 0 }]);
  }
  function removeFromCanonImportQueue(id: string) {
    delete canonImportAbortFlags.current[id];
    setCanonImportQueue(prev => prev.filter(i => i.id !== id));
  }
  function pauseCanonImportItem(id: string) {
    canonImportAbortFlags.current[id] = "pause";
    setCanonImportQueue(prev => prev.map(i => i.id === id ? { ...i, status: "paused", progress: "⏸ Pausing — will stop after current section..." } : i));
  }
  function resumeCanonImportItem(id: string) {
    canonImportAbortFlags.current[id] = null;
    setCanonImportQueue(prev => prev.map(i => i.id === id ? { ...i, status: "queued", progress: "Resuming — restarting import from the beginning..." } : i));
  }
  function cancelCanonImportItem(id: string) {
    canonImportAbortFlags.current[id] = "cancel";
    setCanonImportQueue(prev => prev.map(i => i.id === id ? { ...i, status: "cancelled", progress: "✗ Cancelled by user" } : i));
  }
  function restartCanonImportItem(id: string) {
    canonImportAbortFlags.current[id] = null;
    setCanonImportQueue(prev => prev.map(i => i.id === id ? { ...i, status: "queued", progress: "Restarting from beginning...", importedCount: 0 } : i));
  }

  useEffect(() => {
    async function processNextCanonImport() {
      if (isCanonImportProcessing.current) return;
      const next = canonImportQueue.find(i => i.status === "queued");
      if (!next) return;
      isCanonImportProcessing.current = true;
      setCanonImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "running", progress: "Starting import..." } : i));

      const checkAbort = () => canonImportAbortFlags.current[next.id] === "pause" || canonImportAbortFlags.current[next.id] === "cancel";

      try {
        const entries = await geminiImportCanonToVault(next.canonContent, next.filename, (msg) => {
          setCanonImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, progress: msg } : i));
        }, checkAbort);

        if (canonImportAbortFlags.current[next.id] === "cancel") {
          setCanonImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "cancelled", progress: "✗ Cancelled by user" } : i));
          isCanonImportProcessing.current = false;
          return;
        }
        if (canonImportAbortFlags.current[next.id] === "pause") {
          setCanonImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "paused", progress: "⏸ Paused — " + entries.length + " entries so far. Resume restarts from the beginning." } : i));
          isCanonImportProcessing.current = false;
          return;
        }

        let archive = loadArchive();
        const seen = new Set<string>();
        const deduped: Array<{ text: string; category: string }> = [];
        for (const entry of entries) {
          const key = entry.text.trim().toLowerCase().slice(0, 60);
          if (seen.has(key)) continue;
          seen.add(key); deduped.push({ text: entry.text.trim(), category: entry.category });
        }
        archive = addEntriesWithSource(archive, deduped as Array<{ text: string; category: StoryCategory }>, next.id, next.filename);
        saveArchive(archive);

        setCanonImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "done", importedCount: deduped.length, progress: "✓ " + deduped.length + " entries imported to Canon Story" } : i));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setCanonImportQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "error", progress: "✗ " + msg } : i));
      }
      isCanonImportProcessing.current = false;
    }
    processNextCanonImport();
  }, [canonImportQueue]);

  const isCanonImportRunning = canonImportQueue.some(i => i.status === "running");

  // ════════════════════════════════════════════════════════════════════════════
  // UNIFIED FLOATING PANEL — shows all active items across all 4 queues
  // ════════════════════════════════════════════════════════════════════════════
  const currentRawItem = queue.find(item => item.status === "running");
  const rawQueuedCount = queue.filter(item => item.status === "queued").length;
  const isRunning = !!currentRawItem;

  type PanelRow = {
    key: string;
    label: string;
    queueType: "raw" | "distill" | "distillImport" | "canonDistill" | "canonImport";
    status: QueueStatus;
    progressText: string;
    pct: number; // 0-100, -1 if indeterminate
  };

  const allRows: PanelRow[] = [
    ...queue.filter(i => i.status !== "done" || true).map(i => ({
      key: "raw-" + i.id, label: i.filename, queueType: "raw" as const, status: i.status,
      progressText: i.message, pct: i.totalParts > 0 ? Math.min(100, (i.currentPart / i.totalParts) * 100) : -1,
    })),
    ...distillQueue.map(i => ({
      key: "distill-" + i.id, label: i.filename + " (Inbox Distill)", queueType: "distill" as const, status: i.status,
      progressText: i.progress, pct: -1,
    })),
    ...distillImportQueue.map(i => ({
      key: "distillimport-" + i.id, label: i.filename + " (Inbox Import)", queueType: "distillImport" as const, status: i.status,
      progressText: i.progress, pct: -1,
    })),
    ...canonDistillQueue.map(i => ({
      key: "canondistill-" + i.id, label: i.filename + " (Canon Distill)", queueType: "canonDistill" as const, status: i.status,
      progressText: i.progress, pct: -1,
    })),
    ...canonImportQueue.map(i => ({
      key: "canonimport-" + i.id, label: i.filename + " (Canon Import)", queueType: "canonImport" as const, status: i.status,
      progressText: i.progress, pct: -1,
    })),
  ];

  const totalActive = allRows.filter(r => r.status === "running" || r.status === "queued" || r.status === "paused").length;
  const anyRunning = isRunning || isDistillRunning || isCanonDistillRunning || isCanonImportRunning;
  const hasAnyItems = allRows.length > 0;

  function controlsFor(row: PanelRow): { onPause?: () => void; onResume?: () => void; onCancel?: () => void; onRestart?: () => void; onRemove: () => void } {
    const realId = row.key.replace(/^(raw|distill|distillimport|canondistill|canonimport)-/, "");
    if (row.queueType === "distillImport") {
      return {
        onPause: row.status === "running" ? () => pauseDistillImportItem(realId) : undefined,
        onResume: row.status === "paused" ? () => resumeDistillImportItem(realId) : undefined,
        onCancel: (row.status === "running" || row.status === "queued" || row.status === "paused") ? () => cancelDistillImportItem(realId) : undefined,
        onRestart: (row.status === "error" || row.status === "cancelled" || row.status === "paused") ? () => restartDistillImportItem(realId) : undefined,
        onRemove: () => {}, // distillImportQueue items are tied to their distill item, no standalone remove
      };
    }
    if (row.queueType === "distill") {
      return {
        onPause: row.status === "running" ? () => pauseDistillItem(realId) : undefined,
        onResume: row.status === "paused" ? () => resumeDistillItem(realId) : undefined,
        onCancel: (row.status === "running" || row.status === "queued" || row.status === "paused") ? () => cancelDistillItem(realId) : undefined,
        onRestart: (row.status === "error" || row.status === "cancelled" || row.status === "paused") ? () => restartDistillItem(realId) : undefined,
        onRemove: () => removeFromDistillQueue(realId),
      };
    }
    if (row.queueType === "canonDistill") {
      return {
        onPause: row.status === "running" ? () => pauseCanonDistillItem(realId) : undefined,
        onResume: row.status === "paused" ? () => resumeCanonDistillItem(realId) : undefined,
        onCancel: (row.status === "running" || row.status === "queued" || row.status === "paused") ? () => cancelCanonDistillItem(realId) : undefined,
        onRestart: (row.status === "error" || row.status === "cancelled" || row.status === "paused") ? () => restartCanonDistillItem(realId) : undefined,
        onRemove: () => removeFromCanonDistillQueue(realId),
      };
    }
    if (row.queueType === "canonImport") {
      return {
        onPause: row.status === "running" ? () => pauseCanonImportItem(realId) : undefined,
        onResume: row.status === "paused" ? () => resumeCanonImportItem(realId) : undefined,
        onCancel: (row.status === "running" || row.status === "queued" || row.status === "paused") ? () => cancelCanonImportItem(realId) : undefined,
        onRestart: (row.status === "error" || row.status === "cancelled" || row.status === "paused") ? () => restartCanonImportItem(realId) : undefined,
        onRemove: () => removeFromCanonImportQueue(realId),
      };
    }
    // raw extraction — only supports stop (no per-item pause in old system) and retry
    return {
      onCancel: row.status === "running" ? () => stopExtraction() : undefined,
      onRestart: row.status === "error" ? () => retryItem(realId) : undefined,
      onRemove: () => removeFromQueue(realId),
    };
  }

  const statusColor: Record<QueueStatus, string> = {
    queued: "var(--va-text-muted)", running: "#7c3aed", paused: "#fbbf24",
    done: "#22c55e", error: "#ef4444", cancelled: "var(--va-text-muted)",
  };
  const statusIcon: Record<QueueStatus, string> = {
    queued: "🕐", running: "⏳", paused: "⏸", done: "✓", error: "✗", cancelled: "⊘",
  };

  const popupStyle: React.CSSProperties = {
    position: "fixed",
    bottom: popupPos.y === 0 ? "1.5rem" : "auto",
    top: popupPos.y !== 0 ? `calc(100vh - 1.5rem - 200px + ${popupPos.y}px)` : "auto",
    right: popupPos.x === 0 ? "1.5rem" : "auto",
    left: popupPos.x !== 0 ? `calc(100vw - 1.5rem - 320px + ${popupPos.x}px)` : "auto",
    zIndex: 9999,
    background: "var(--va-surface)",
    border: `1px solid ${anyRunning ? "#7c3aed" : "var(--va-border)"}`,
    borderRadius: "0.75rem",
    width: "320px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    userSelect: "none",
  };

  return (
    <ExtractionContext.Provider value={{
      queue, addToQueue, removeFromQueue, saveItemResults, clearCompleted, isRunning, retryItem, stopExtraction,
      distillQueue, addToDistillQueue, removeFromDistillQueue, pauseDistillItem, resumeDistillItem, cancelDistillItem, restartDistillItem, isDistillRunning,
      distillImportQueue, importDistillItem, pauseDistillImportItem, resumeDistillImportItem, cancelDistillImportItem, restartDistillImportItem, isDistillImportRunning,
      canonDistillQueue, addToCanonDistillQueue, removeFromCanonDistillQueue, pauseCanonDistillItem, resumeCanonDistillItem, cancelCanonDistillItem, restartCanonDistillItem, isCanonDistillRunning,
      canonImportQueue, addToCanonImportQueue, removeFromCanonImportQueue, pauseCanonImportItem, resumeCanonImportItem, cancelCanonImportItem, restartCanonImportItem, isCanonImportRunning,
    }}>
      {children}

      {hasAnyItems && (
        <div style={popupStyle}>
          {/* Header / drag handle */}
          <div onMouseDown={onMouseDown}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", cursor: dragging ? "grabbing" : "grab", borderBottom: panelCollapsed ? "none" : "1px solid var(--va-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {anyRunning && <div style={{ width: "9px", height: "9px", borderRadius: "50%", border: "2px solid #7c3aed", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />}
              <span style={{ fontWeight: "700", fontSize: "0.8rem", color: anyRunning ? "#c4b5fd" : "var(--va-text)" }}>
                {anyRunning ? "Processing..." : "Queue"} ({totalActive} active)
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.6rem", color: "var(--va-text-muted)" }}>⠿⠿</span>
              <button onClick={() => setPanelCollapsed(c => !c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>{panelCollapsed ? "▸" : "▾"}</button>
            </div>
          </div>

          {!panelCollapsed && (
            <div style={{ padding: "0.625rem 0.875rem", maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {allRows.map(row => {
                const ctrl = controlsFor(row);
                return (
                  <div key={row.key} style={{ background: "var(--va-bg)", border: `1px solid ${statusColor[row.status]}`, borderRadius: "0.5rem", padding: "0.5rem 0.625rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem", gap: "0.375rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--va-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {statusIcon[row.status]} {row.label.replace(/\.(txt|pdf|md)$/i, "")}
                      </span>
                      <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                        {ctrl.onPause && <button onClick={ctrl.onPause} title="Pause" style={{ background: "none", border: "1px solid #fbbf24", borderRadius: "0.25rem", color: "#fbbf24", fontSize: "0.62rem", padding: "0.1rem 0.35rem", cursor: "pointer" }}>Pause</button>}
                        {ctrl.onResume && <button onClick={ctrl.onResume} title="Resume" style={{ background: "none", border: "1px solid #22c55e", borderRadius: "0.25rem", color: "#22c55e", fontSize: "0.62rem", padding: "0.1rem 0.35rem", cursor: "pointer" }}>Resume</button>}
                        {ctrl.onCancel && <button onClick={ctrl.onCancel} title="Cancel" style={{ background: "none", border: "1px solid #ef4444", borderRadius: "0.25rem", color: "#ef4444", fontSize: "0.62rem", padding: "0.1rem 0.35rem", cursor: "pointer" }}>Cancel</button>}
                        {ctrl.onRestart && <button onClick={ctrl.onRestart} title="Restart" style={{ background: "none", border: "1px solid #3b82f6", borderRadius: "0.25rem", color: "#93c5fd", fontSize: "0.62rem", padding: "0.1rem 0.35rem", cursor: "pointer" }}>Restart</button>}
                        {(row.status === "done" || row.status === "error" || row.status === "cancelled") && (
                          <button onClick={ctrl.onRemove} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>×</button>
                        )}
                      </div>
                    </div>
                    {row.pct >= 0 && (
                      <div style={{ height: "4px", background: "var(--va-border)", borderRadius: "9999px", overflow: "hidden", marginBottom: "0.25rem" }}>
                        <div style={{ height: "100%", background: statusColor[row.status], borderRadius: "9999px", transition: "width 0.5s", width: row.pct + "%" }} />
                      </div>
                    )}
                    <p style={{ fontSize: "0.65rem", color: row.status === "error" ? "#f87171" : "var(--va-text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.progressText}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </ExtractionContext.Provider>
  );
}

export function useExtraction() {
  return useContext(ExtractionContext);
}

export function useDistill() {
  const ctx = useContext(ExtractionContext);
  return {
    distillQueue: ctx.distillQueue,
    addToDistillQueue: ctx.addToDistillQueue,
    removeFromDistillQueue: ctx.removeFromDistillQueue,
    pauseDistillItem: ctx.pauseDistillItem,
    resumeDistillItem: ctx.resumeDistillItem,
    cancelDistillItem: ctx.cancelDistillItem,
    restartDistillItem: ctx.restartDistillItem,
    isDistillRunning: ctx.isDistillRunning,
    // Separate manual import step — call after reviewing the distilled Story Reference
    distillImportQueue: ctx.distillImportQueue,
    importDistillItem: ctx.importDistillItem,
    pauseDistillImportItem: ctx.pauseDistillImportItem,
    resumeDistillImportItem: ctx.resumeDistillImportItem,
    cancelDistillImportItem: ctx.cancelDistillImportItem,
    restartDistillImportItem: ctx.restartDistillImportItem,
    isDistillImportRunning: ctx.isDistillImportRunning,
  };
}

export function useCanonDistill() {
  const ctx = useContext(ExtractionContext);
  return {
    canonDistillQueue: ctx.canonDistillQueue,
    addToCanonDistillQueue: ctx.addToCanonDistillQueue,
    removeFromCanonDistillQueue: ctx.removeFromCanonDistillQueue,
    pauseCanonDistillItem: ctx.pauseCanonDistillItem,
    resumeCanonDistillItem: ctx.resumeCanonDistillItem,
    cancelCanonDistillItem: ctx.cancelCanonDistillItem,
    restartCanonDistillItem: ctx.restartCanonDistillItem,
    isCanonDistillRunning: ctx.isCanonDistillRunning,
  };
}

export function useCanonImport() {
  const ctx = useContext(ExtractionContext);
  return {
    canonImportQueue: ctx.canonImportQueue,
    addToCanonImportQueue: ctx.addToCanonImportQueue,
    removeFromCanonImportQueue: ctx.removeFromCanonImportQueue,
    pauseCanonImportItem: ctx.pauseCanonImportItem,
    resumeCanonImportItem: ctx.resumeCanonImportItem,
    cancelCanonImportItem: ctx.cancelCanonImportItem,
    restartCanonImportItem: ctx.restartCanonImportItem,
    isCanonImportRunning: ctx.isCanonImportRunning,
  };
}