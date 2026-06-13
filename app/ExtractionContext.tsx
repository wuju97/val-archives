"use client";

import { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";
import { geminiExtractCanonToVault, ExtractedVaultEntry } from "../lib/geminiEngine";
import { loadArchive, saveArchive, addEntry } from "../lib/archiveEngine";

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

interface ExtractionContextType {
  queue: ExtractionQueueItem[];
  addToQueue: (id: string, content: string, filename: string) => void;
  removeFromQueue: (id: string) => void;
  saveItemResults: (id: string, selectedIndices: Set<number>) => number;
  clearCompleted: () => void;
  isRunning: boolean;
}

const ExtractionContext = createContext<ExtractionContextType>({
  queue: [],
  addToQueue: () => {},
  removeFromQueue: () => {},
  saveItemResults: () => 0,
  clearCompleted: () => {},
  isRunning: false,
});

export function ExtractionProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ExtractionQueueItem[]>([]);
  const isProcessing = useRef(false);

  function updateItem(id: string, updates: Partial<ExtractionQueueItem>) {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }

  function addToQueue(id: string, content: string, filename: string) {
    // Don't add duplicates
    setQueue(prev => {
      if (prev.find(item => item.id === id && item.status !== "done" && item.status !== "error")) return prev;
      return [...prev, {
        id, filename, content,
        status: "queued",
        currentPart: 0,
        totalParts: Math.ceil(content.length / 40000),
        factsFound: 0,
        results: [],
        message: "Queued",
      }];
    });
  }

  function removeFromQueue(id: string) {
    setQueue(prev => prev.filter(item => item.id !== id));
  }

  function saveItemResults(id: string, selectedIndices: Set<number>): number {
    const item = queue.find(i => i.id === id);
    if (!item || item.results.length === 0) return 0;
    let archive = loadArchive();
    let count = 0;
    for (const i of selectedIndices) {
      const entry = item.results[i];
      if (!entry) continue;
      archive = addEntry(archive, entry.text, entry.category as any);
      count++;
    }
    saveArchive(archive);
    updateItem(id, { savedCount: count });
    return count;
  }

  function clearCompleted() {
    setQueue(prev => prev.filter(item => item.status === "queued" || item.status === "running"));
  }

  // Auto-process queue
  useEffect(() => {
    async function processNext() {
      if (isProcessing.current) return;
      
      const nextItem = queue.find(item => item.status === "queued");
      if (!nextItem) return;

      isProcessing.current = true;
      updateItem(nextItem.id, { status: "running", message: "Starting..." });

      try {
        const results = await geminiExtractCanonToVault(
          nextItem.content,
          nextItem.filename,
          (msg) => {
            const partMatch = msg.match(/part (\d+) of (\d+)/i) || msg.match(/Processing part (\d+) of (\d+)/i);
            const factsMatch = msg.match(/\((\d+) facts/);
            const completeMatch = msg.startsWith("Complete") ? msg.match(/(\d+) facts/) : null;

            updateItem(nextItem.id, {
              message: msg,
              currentPart: partMatch ? parseInt(partMatch[1]) : undefined,
              totalParts: partMatch ? parseInt(partMatch[2]) : undefined,
              factsFound: completeMatch ? parseInt(completeMatch[1]) : factsMatch ? parseInt(factsMatch[1]) : undefined,
            } as any);
          }
        );

        updateItem(nextItem.id, {
          status: "done",
          results,
          factsFound: results.length,
          message: `Complete — ${results.length} facts extracted`,
          currentPart: nextItem.totalParts,
        });
      } catch (e) {
        updateItem(nextItem.id, {
          status: "error",
          message: e instanceof Error ? e.message : "Extraction failed",
        });
      }

      isProcessing.current = false;
    }

    processNext();
  }, [queue]);

  const currentItem = queue.find(item => item.status === "running");
  const queuedCount = queue.filter(item => item.status === "queued").length;
  const isRunning = !!currentItem;

  return (
    <ExtractionContext.Provider value={{ queue, addToQueue, removeFromQueue, saveItemResults, clearCompleted, isRunning }}>
      {children}

      {/* ── Global floating extraction indicator ─────────────────────────── */}
      {(isRunning || queuedCount > 0) && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
          background: "var(--va-surface)", border: "1px solid #7c3aed",
          borderRadius: "0.75rem", padding: "0.875rem 1.125rem", width: "280px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)"
        }}>
          {currentItem && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "0.85rem" }}>⏳</span>
                <span style={{ fontWeight: "700", fontSize: "0.78rem", color: "#c4b5fd", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentItem.filename.replace(/\.(txt|pdf)$/i, "")}
                </span>
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", margin: "0 0 0.375rem" }}>
                Part {currentItem.currentPart} of {currentItem.totalParts} · {currentItem.factsFound} facts
              </p>
              <div style={{ height: "4px", background: "var(--va-border)", borderRadius: "9999px", overflow: "hidden", marginBottom: "0.375rem" }}>
                <div style={{
                  height: "100%", background: "#7c3aed", borderRadius: "9999px", transition: "width 0.5s",
                  width: currentItem.totalParts > 0 ? `${Math.min(100, (currentItem.currentPart / currentItem.totalParts) * 100)}%` : "5%"
                }} />
              </div>
            </>
          )}
          {queuedCount > 0 && (
            <p style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", margin: 0 }}>
              {queuedCount} more file{queuedCount !== 1 ? "s" : ""} queued
            </p>
          )}
          <a href="/canon" style={{ display: "block", marginTop: "0.5rem", textAlign: "center", fontSize: "0.7rem", color: "var(--va-accent)", textDecoration: "none" }}>
            Manage queue →
          </a>
        </div>
      )}

      {/* ── Completion notification ───────────────────────────────────────── */}
      {queue.some(item => item.status === "done" && !item.savedCount) && !isRunning && queuedCount === 0 && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
          background: "var(--va-surface)", border: "1px solid #22c55e",
          borderRadius: "0.75rem", padding: "0.875rem 1.125rem", width: "280px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontWeight: "700", fontSize: "0.8rem", color: "#4ade80", marginBottom: "0.2rem" }}>✓ All extractions complete!</p>
              <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>
                {queue.filter(i => i.status === "done").reduce((acc, i) => acc + i.factsFound, 0)} total facts ready to save
              </p>
            </div>
            <button onClick={clearCompleted} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1rem" }}>×</button>
          </div>
          <a href="/canon" style={{ display: "block", marginTop: "0.5rem", background: "var(--va-accent)", color: "white", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: "600", textAlign: "center", textDecoration: "none" }}>
            Go to Canon Archives to save →
          </a>
        </div>
      )}
    </ExtractionContext.Provider>
  );
}

export function useExtraction() {
  return useContext(ExtractionContext);
}