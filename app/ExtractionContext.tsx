 "use client";

import { createContext, useContext, useRef, useState, ReactNode } from "react";
import { geminiExtractCanonToVault, ExtractedVaultEntry } from "../lib/geminiEngine";
import { loadArchive, saveArchive, addEntry } from "../lib/archiveEngine";

interface ExtractionJob {
  id: string;
  filename: string;
  status: "running" | "done" | "error";
  currentPart: number;
  totalParts: number;
  factsFound: number;
  results: ExtractedVaultEntry[];
  message: string;
}

interface ExtractionContextType {
  job: ExtractionJob | null;
  startExtraction: (entryId: string, content: string, filename: string) => void;
  saveResults: (selectedIndices: Set<number>) => number;
  clearJob: () => void;
}

const ExtractionContext = createContext<ExtractionContextType>({
  job: null,
  startExtraction: () => {},
  saveResults: () => 0,
  clearJob: () => {},
});

export function ExtractionProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<ExtractionJob | null>(null);
  const jobRef = useRef<ExtractionJob | null>(null);

  function updateJob(updates: Partial<ExtractionJob>) {
    setJob(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      jobRef.current = updated;
      return updated;
    });
  }

  async function startExtraction(entryId: string, content: string, filename: string) {
    const newJob: ExtractionJob = {
      id: entryId,
      filename,
      status: "running",
      currentPart: 0,
      totalParts: Math.ceil(content.length / 40000),
      factsFound: 0,
      results: [],
      message: "Starting...",
    };
    setJob(newJob);
    jobRef.current = newJob;

    try {
      const results = await geminiExtractCanonToVault(
        content,
        filename,
        (msg) => {
          const partMatch = msg.match(/part (\d+) of (\d+)/i) || msg.match(/Processing part (\d+) of (\d+)/i);
          const factsMatch = msg.match(/\((\d+) facts/);
          const completeMatch = msg.startsWith("Complete") ? msg.match(/(\d+) facts/) : null;

          updateJob({
            message: msg,
            currentPart: partMatch ? parseInt(partMatch[1]) : jobRef.current?.currentPart ?? 0,
            totalParts: partMatch ? parseInt(partMatch[2]) : jobRef.current?.totalParts ?? 0,
            factsFound: completeMatch ? parseInt(completeMatch[1]) : factsMatch ? parseInt(factsMatch[1]) : jobRef.current?.factsFound ?? 0,
          });
        }
      );

      updateJob({ status: "done", results, factsFound: results.length, message: `Complete — ${results.length} facts extracted!` });
    } catch (e) {
      updateJob({ status: "error", message: e instanceof Error ? e.message : "Extraction failed" });
    }
  }

  function saveResults(selectedIndices: Set<number>): number {
    if (!job || job.results.length === 0) return 0;
    let archive = loadArchive();
    let count = 0;
    for (const i of selectedIndices) {
      const entry = job.results[i];
      if (!entry) continue;
      archive = addEntry(archive, entry.text, entry.category as any);
      count++;
    }
    saveArchive(archive);
    return count;
  }

  function clearJob() {
    setJob(null);
    jobRef.current = null;
  }

  return (
    <ExtractionContext.Provider value={{ job, startExtraction, saveResults, clearJob }}>
      {children}
      {/* Global floating indicator — visible on ALL pages */}
      {job && job.status === "running" && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.75rem", padding: "0.875rem 1.125rem", maxWidth: "300px", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "0.9rem" }}>⏳</span>
            <span style={{ fontWeight: "700", fontSize: "0.78rem", color: "#c4b5fd" }}>Extracting: {job.filename.replace(".txt","").replace(".pdf","")}</span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", margin: "0 0 0.375rem" }}>
            Part {job.currentPart} of {job.totalParts} · {job.factsFound} facts found
          </p>
          <div style={{ height: "4px", background: "var(--va-border)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#7c3aed", borderRadius: "9999px", transition: "width 0.5s", width: job.totalParts > 0 ? `${Math.min(100, (job.currentPart / job.totalParts) * 100)}%` : "5%" }} />
          </div>
        </div>
      )}
      {/* Completion notification */}
      {job && job.status === "done" && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, background: "var(--va-surface)", border: "1px solid #22c55e", borderRadius: "0.75rem", padding: "0.875rem 1.125rem", maxWidth: "300px", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontWeight: "700", fontSize: "0.8rem", color: "#4ade80", marginBottom: "0.2rem" }}>✓ Extraction complete!</p>
              <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>{job.filename} · {job.factsFound} facts ready</p>
            </div>
            <button onClick={clearJob} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "1rem", padding: "0.25rem" }}>×</button>
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