"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadArchive, saveArchive, saveCustomPrompt, regenerateMasterPrompt, compileFinalPrompt } from "@/lib/archiveEngine";
import { hasGeminiKey, geminiEnhanceCustomPrompt } from "../../lib/geminiEngine";

export default function CustomPromptPage() {
  const [archive, setArchive] = useState(loadArchive());
  const [customPrompt, setCustomPrompt] = useState("");
  const [saved, setSaved] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [copiedFinal, setCopiedFinal] = useState(false);
  const [copiedCustom, setCopiedCustom] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [forgeOutput, setForgeOutput] = useState("");

  useEffect(() => {
    const fromForge = sessionStorage.getItem("forgeOutput");
    if (fromForge) {
      setForgeOutput(fromForge);
      sessionStorage.removeItem("forgeOutput");
    }
  }, []);

  useEffect(() => {
    const loaded = loadArchive();
    setArchive(loaded);
    setCustomPrompt(loaded.customPrompt || "");
  }, []);

  function handleSave() {
    const updated = saveCustomPrompt(archive, customPrompt);
    const withPrompts = regenerateMasterPrompt(updated);
    saveArchive(withPrompts);
    setArchive(withPrompts);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleGenerateFinal() {
    const fresh = loadArchive();
    const final = compileFinalPrompt(
      fresh.masterPrompt,
      customPrompt,
      forgeOutput
    );
    setFinalPrompt(final);
    setShowFinal(true);
  }

  function handleCopyFinal() {
    navigator.clipboard.writeText(finalPrompt);
    setCopiedFinal(true);
    setTimeout(() => setCopiedFinal(false), 2000);
  }

  function handleCopyCustom() {
    navigator.clipboard.writeText(customPrompt);
    setCopiedCustom(true);
    setTimeout(() => setCopiedCustom(false), 2000);
  }

  function handleExportFinal() {
    const archive = loadArchive();
    const blob = new Blob([finalPrompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${archive.archiveName.replace(/\s+/g, "_")}_final_prompt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasMaster = !!archive.masterPrompt.trim();
  const hasCustom = !!customPrompt.trim();
  const hasForge = !!forgeOutput.trim();

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>

      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>🕰 Custom Prompt</h1>
      <p style={{ color: "var(--va-text-muted)", marginBottom: "2rem", fontSize: "0.875rem" }}>
        Write global instructions that apply to every prompt. Combined with your Master Prompt and Forge output to create the Final Prompt.
      </p>

      {/* How it works */}
      <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "2rem" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>How It Works</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.875rem" }}>
          <div style={{ background: "var(--va-border)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", color: hasMaster ? "var(--va-text)" : "var(--va-text-muted)" }}>
            {hasMaster ? "✓" : "○"} Master Prompt
          </div>
          <span style={{ color: "var(--va-text-muted)" }}>+</span>
          <div style={{ background: "var(--va-border)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", color: hasCustom ? "var(--va-accent)" : "var(--va-text-muted)", border: hasCustom ? `1px solid var(--va-accent)` : "none" }}>
            {hasCustom ? "✓" : "○"} Custom Prompt ← you are here
          </div>
          <span style={{ color: "var(--va-text-muted)" }}>+</span>
          <div style={{ background: "var(--va-border)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", color: hasForge ? "var(--va-text)" : "var(--va-text-muted)" }}>
            {hasForge ? "✓" : "○"} Forge Output
          </div>
          <span style={{ color: "var(--va-text-muted)" }}>=</span>
          <div style={{ background: "var(--va-accent)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", color: "white", fontWeight: "600" }}>
            Final Prompt
          </div>
        </div>
      </div>

      {/* Custom Prompt Editor */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "1rem", fontWeight: "600", display: "block" }}>Global Instructions</label>
            <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>
              These instructions apply to every prompt. Write your tone, style, and rules here.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleCopyCustom} disabled={!customPrompt.trim()} style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.75rem", opacity: !customPrompt.trim() ? 0.4 : 1 }}>
              {copiedCustom ? "✓ Copied" : "Copy"}
            </button>
            <button onClick={handleSave} style={{ background: "var(--va-accent)", color: "white", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600" }}>
              {saved ? "✓ Saved!" : "Save"}
            </button>
            {hasGeminiKey() && (
              <button onClick={async () => {
                if (!customPrompt.trim()) return;
                setEnhancing(true);
                const fresh = loadArchive();
                const withPrompt = regenerateMasterPrompt(fresh);
                const enhanced = await geminiEnhanceCustomPrompt(customPrompt, withPrompt.masterPrompt);
                setCustomPrompt(enhanced);
                setEnhancing(false);
              }} disabled={!customPrompt.trim() || enhancing}
              style={{ background: "#7c3aed", color: "white", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", opacity: (!customPrompt.trim() || enhancing) ? 0.4 : 1 }}>
                {enhancing ? "✨ Enhancing..." : "✨ AI Enhance"}
              </button>
            )}
          </div>
        </div>

        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={`Write your global instructions here. Examples:\n\n• Write in long, flowing paragraphs. Avoid bullet points.\n• Preserve mystery — never reveal hidden information unless the player earns it.\n• Always maintain a dark, atmospheric tone.\n• Hermione and Valefor's relationship should develop slowly and never be rushed.\n• Respond in second person ("You enter the room...").\n• Keep combat descriptions visceral but not gratuitous.`}
          style={{ width: "100%", height: "280px", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", lineHeight: "1.6", boxSizing: "border-box" }}
        />
      </div>

      {/* Optional Forge Output paste */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: "1rem", fontWeight: "600", display: "block" }}>Forge Output (Optional)</label>
          <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>
            Paste a prompt from Prompt Forge here to combine it into the Final Prompt.
          </p>
        </div>
        <textarea
          value={forgeOutput}
          onChange={(e) => setForgeOutput(e.target.value)}
          placeholder="Paste your Prompt Forge output here, or leave empty..."
          style={{ width: "100%", height: "160px", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", boxSizing: "border-box" }}
        />
      </div>

      {/* Generate Final Prompt */}
      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={handleGenerateFinal}
          style={{ background: "var(--va-accent)", color: "white", padding: "0.75rem 2rem", borderRadius: "0.75rem", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "1rem" }}
        >
          ⚡ Generate Final Prompt
        </button>
        <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.5rem" }}>
          Combines Master Prompt + Custom Instructions {hasForge ? "+ Forge Output" : ""} into one ready-to-use prompt.
        </p>
      </div>

      {/* Final Prompt Output */}
      {showFinal && (
        <div style={{ background: "var(--va-surface)", border: `1px solid var(--va-accent)`, borderRadius: "0.75rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: "bold", color: "var(--va-accent)" }}>⚡ Final Prompt</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>Ready to paste into any AI.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={handleCopyFinal} style={{ background: "var(--va-accent)", color: "white", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
                {copiedFinal ? "✓ Copied!" : "📋 Copy"}
              </button>
              <button onClick={handleExportFinal} style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>
                📄 Export TXT
              </button>
              <button onClick={() => setShowFinal(false)} style={{ background: "none", color: "var(--va-text-muted)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>
                Close
              </button>
            </div>
          </div>
          <textarea
            value={finalPrompt}
            readOnly
            style={{ width: "100%", height: "50vh", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", outline: "none", resize: "none", fontSize: "0.8rem", fontFamily: "monospace", color: "var(--va-text)", boxSizing: "border-box" }}
          />
        </div>
      )}

    </div>
  );
}