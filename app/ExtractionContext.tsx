"use client";

import { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";
import { geminiExtractCanonToVault, geminiDistillStory, geminiImportStoryToVault, ExtractedVaultEntry } from "../lib/geminiEngine";
import { loadArchive, loadArchiveAsync, saveArchive, addEntry, addPlayerEntry, StoryCategory } from "../lib/archiveEngine";

export interface ExtractionQueueItem {
  id: string;
  filename: string;
  content: string;
  status: "queued" | "running" | "done" | "error";
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
  status: "queued" | "distilling" | "importing" | "done" | "error";
  progress: string;
  result: string; // distilled Story Reference
  importedCount: number;
}

interface ExtractionContextType {
  queue: ExtractionQueueItem[];
  addToQueue: (id: string, content: string, filename: string) => void;
  removeFromQueue: (id: string) => void;
  saveItemResults: (id: string, selectedIndices: Set<number>) => Promise<number>;
  clearCompleted: () => void;
  isRunning: boolean;
  retryItem: (id: string) => void;
  stopExtraction: () => void;
  // Inbox distill queue
  distillQueue: DistillQueueItem[];
  addToDistillQueue: (id: string, content: string, filename: string) => void;
  removeFromDistillQueue: (id: string) => void;
  isDistillRunning: boolean;
}

const ExtractionContext = createContext<ExtractionContextType>({
  queue: [],
  addToQueue: () => {},
  removeFromQueue: () => {},
  saveItemResults: async () => 0,
  clearCompleted: () => {},
  isRunning: false,
  retryItem: () => {},
  stopExtraction: () => {},
  distillQueue: [],
  addToDistillQueue: () => {},
  removeFromDistillQueue: () => {},
  isDistillRunning: false,
});

export function ExtractionProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ExtractionQueueItem[]>([]);
  // stopExtraction is defined below but referenced in popup via context
  const isProcessing = useRef(false);
  const abortRef = useRef(false);
  const [distillQueue, setDistillQueue] = useState<DistillQueueItem[]>([]);
  const isDistillProcessing = useRef(false);
  // Draggable popup position
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  function updateItem(id: string, updates: Partial<ExtractionQueueItem>) {
    setQueue(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  }

  function addToQueue(id: string, content: string, filename: string) {
    setQueue(prev => {
      if (prev.find(item => item.id === id && (item.status === "queued" || item.status === "running"))) return prev;
      return [...prev, {
        id, filename, content,
        status: "queued",
        currentPart: 0,
        totalParts: Math.ceil(Math.min(content.length, 800000) / 40000),
        factsFound: 0,
        results: [],
        message: "Queued",
      }];
    });
  }

  function stopExtraction() {
    abortRef.current = true;
    // Mark running item as error
    setQueue(prev => prev.map(item =>
      item.status === "running" ? { ...item, status: "error", message: "Stopped by user" } : item
    ));
    setTimeout(() => { isProcessing.current = false; abortRef.current = false; }, 500);
  }

  function retryItem(id: string) {
    setQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status: "queued", currentPart: 0, factsFound: 0, results: [], message: "Retrying..." } : item
    ));
  }

  function removeFromQueue(id: string) {
    setQueue(prev => prev.filter(item => item.id !== id));
  }

  async function saveItemResults(id: string, selectedIndices: Set<number>): Promise<number> {
    const item = queue.find(i => i.id === id);
    if (!item || item.results.length === 0) return 0;
    // Always load from IDB to get full data
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

  // Dragging logic
  function onMouseDown(e: React.MouseEvent) {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: popupPos.x, py: popupPos.y };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      setPopupPos({
        x: dragStart.current.px + (e.clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.clientY - dragStart.current.my),
      });
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

  // ── Distill Queue Processing (Inbox → Player Story) ─────────────────────────
  useEffect(() => {
    async function processNextDistill() {
      if (isDistillProcessing.current) return;
      const next = distillQueue.find(i => i.status === "queued");
      if (!next) return;

      isDistillProcessing.current = true;

      // Stage 1: Distill
      setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "distilling", progress: "Sending to Gemini..." } : i));

      try {
        const result = await geminiDistillStory(next.content, next.filename, (msg) => {
          setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, progress: msg } : i));
        });

        // Stage 2: Import
        setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "importing", result, progress: "Importing to Player Story..." } : i));

        const entries = await geminiImportStoryToVault(result, next.filename, (msg) => {
          setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, progress: msg } : i));
        });

        // Atomic save to Player Story subtab
        let archive = loadArchive();
        const seen = new Set<string>();
        for (const entry of entries) {
          const key = entry.text.trim().toLowerCase().slice(0, 60);
          if (seen.has(key)) continue;
          seen.add(key);
          archive = addPlayerEntry(archive, entry.text.trim(), entry.category as StoryCategory);
        }
        saveArchive(archive);

        setDistillQueue(prev => prev.map(i => i.id === next.id ? {
          ...i, status: "done", importedCount: entries.length,
          progress: "✓ " + entries.length + " entries imported to Player Story"
        } : i));

      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        setDistillQueue(prev => prev.map(i => i.id === next.id ? { ...i, status: "error", progress: "✗ " + msg } : i));
      }

      isDistillProcessing.current = false;
    }

    processNextDistill();
  }, [distillQueue]);

  function addToDistillQueue(id: string, content: string, filename: string) {
    if (distillQueue.find(i => i.id === id && (i.status === "queued" || i.status === "distilling" || i.status === "importing"))) return;
    setDistillQueue(prev => [...prev, {
      id, filename, content,
      status: "queued", progress: "Queued", result: "", importedCount: 0
    }]);
  }

  function removeFromDistillQueue(id: string) {
    setDistillQueue(prev => prev.filter(i => i.id !== id));
  }

  const isDistillRunning = distillQueue.some(i => i.status === "distilling" || i.status === "importing");

  // ── Extraction Queue Processing ───────────────────────────────────────────
  // Auto-process queue — one item at a time
  useEffect(() => {
    async function processNext() {
      if (isProcessing.current) return;
      const nextItem = queue.find(item => item.status === "queued");
      if (!nextItem) return;

      isProcessing.current = true;
      abortRef.current = false;
      updateItem(nextItem.id, { status: "running", message: "Starting..." });

      try {
        // Cap content at 800k chars to avoid endless processing
        const cappedContent = nextItem.content.slice(0, 800000);
        const totalParts = Math.ceil(cappedContent.length / 40000);
        updateItem(nextItem.id, { totalParts });

        const results = await geminiExtractCanonToVault(
          cappedContent,
          nextItem.filename,
          (msg) => {
            if (abortRef.current) return;
            const partMatch = msg.match(/part (\d+) of (\d+)/i) || msg.match(/Processing part (\d+) of (\d+)/i);
            const factsMatch = msg.match(/\((\d+) facts/);
            const completeMatch = msg.startsWith("Complete") ? msg.match(/(\d+) facts/) : null;

            setQueue(prev => prev.map(item => {
              if (item.id !== nextItem.id) return item;
              return {
                ...item,
                message: msg,
                currentPart: partMatch ? parseInt(partMatch[1]) : item.currentPart,
                totalParts: partMatch ? parseInt(partMatch[2]) : item.totalParts,
                factsFound: completeMatch ? parseInt(completeMatch[1])
                  : factsMatch ? parseInt(factsMatch[1])
                  : item.factsFound,
              };
            }));
          }
        );

        updateItem(nextItem.id, {
          status: "done",
          results,
          factsFound: results.length,
          message: `Complete — ${results.length} facts extracted`,
          currentPart: totalParts,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Extraction failed";
        updateItem(nextItem.id, { status: "error", message: msg });
      }

      isProcessing.current = false;
    }

    processNext();
  }, [queue]);

  const currentItem = queue.find(item => item.status === "running");
  const queuedCount = queue.filter(item => item.status === "queued").length;
  const isRunning = !!currentItem;
  const allDone = queue.length > 0 && queue.every(i => i.status === "done" || i.status === "error") && !isRunning;

  const popupStyle: React.CSSProperties = {
    position: "fixed",
    bottom: popupPos.y === 0 ? "1.5rem" : "auto",
    top: popupPos.y !== 0 ? `calc(100vh - 1.5rem - 120px + ${popupPos.y}px)` : "auto",
    right: popupPos.x === 0 ? "1.5rem" : "auto",
    left: popupPos.x !== 0 ? `calc(100vw - 1.5rem - 280px + ${popupPos.x}px)` : "auto",
    zIndex: 9999,
    background: "var(--va-surface)",
    border: `1px solid ${isRunning ? "#7c3aed" : allDone ? "#22c55e" : "var(--va-border)"}`,
    borderRadius: "0.75rem",
    padding: "0.875rem 1.125rem",
    width: "280px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    userSelect: "none",
  };

  return (
    <ExtractionContext.Provider value={{ queue, addToQueue, removeFromQueue, saveItemResults, clearCompleted, isRunning, retryItem, stopExtraction, distillQueue, addToDistillQueue, removeFromDistillQueue, isDistillRunning }}>
      {children}

      {/* Global floating extraction popup */}
      {queue.length > 0 && (
        <div style={popupStyle}>
          {/* Drag handle */}
          <div
            onMouseDown={onMouseDown}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", cursor: dragging ? "grabbing" : "grab" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem" }}>
                {isRunning ? "⏳" : allDone ? "✓" : "🕐"}
              </span>
              <span style={{ fontWeight: "700", fontSize: "0.78rem", color: isRunning ? "#c4b5fd" : allDone ? "#4ade80" : "var(--va-text)" }}>
                {isRunning ? "Extracting..." : allDone ? "All done!" : "Queue paused"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.65rem", color: "var(--va-text-muted)" }}>⠿⠿</span>
              {allDone && (
                <button onClick={clearCompleted} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.9rem", padding: "0 0.125rem" }}>×</button>
              )}
            </div>
          </div>

          {/* Current running item */}
          {currentItem && (
            <div style={{ marginBottom: "0.375rem" }}>
              <p style={{ fontSize: "0.72rem", color: "var(--va-text)", marginBottom: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentItem.filename.replace(/\.(txt|pdf)$/i, "")}
              </p>
              <div style={{ height: "4px", background: "var(--va-border)", borderRadius: "9999px", overflow: "hidden", marginBottom: "0.25rem" }}>
                <div style={{
                  height: "100%", background: "#7c3aed", borderRadius: "9999px", transition: "width 0.5s",
                  width: currentItem.totalParts > 0 ? `${Math.min(100, (currentItem.currentPart / currentItem.totalParts) * 100)}%` : "5%"
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: "0.68rem", color: "var(--va-text-muted)", margin: 0 }}>
                  Part {currentItem.currentPart} of {currentItem.totalParts} · {currentItem.factsFound} facts
                </p>
                <button onClick={stopExtraction}
                  style={{ fontSize: "0.65rem", color: "#f87171", background: "none", border: "1px solid #f87171", borderRadius: "0.25rem", padding: "0.1rem 0.4rem", cursor: "pointer" }}>
                  Stop
                </button>
              </div>
            </div>
          )}

          {/* Queue summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", maxHeight: "100px", overflowY: "auto" }}>
            {queue.filter(i => i.id !== currentItem?.id).map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.68rem" }}>
                <span>{item.status === "done" ? "✓" : item.status === "error" ? "✗" : "🕐"}</span>
                <span style={{
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: item.status === "done" ? "#4ade80" : item.status === "error" ? "#f87171" : "var(--va-text-muted)"
                }}>
                  {item.filename.replace(/\.(txt|pdf)$/i, "")}
                </span>
                {item.status === "done" && <span style={{ color: "#4ade80", flexShrink: 0 }}>{item.factsFound}</span>}
                {item.status === "error" && (
                  <button onClick={() => retryItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: "0.65rem", flexShrink: 0 }}>retry</button>
                )}
              </div>
            ))}
          </div>

          {allDone && (
            <a href="/canon" style={{ display: "block", marginTop: "0.5rem", background: "var(--va-accent)", color: "white", padding: "0.35rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.72rem", fontWeight: "600", textAlign: "center", textDecoration: "none" }}>
              Save results in Canon Archives →
            </a>
          )}

          {queuedCount > 0 && !isRunning && (
            <p style={{ fontSize: "0.68rem", color: "var(--va-text-muted)", marginTop: "0.25rem", textAlign: "center" }}>
              {queuedCount} file{queuedCount !== 1 ? "s" : ""} waiting...
            </p>
          )}
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
    isDistillRunning: ctx.isDistillRunning,
  };
}