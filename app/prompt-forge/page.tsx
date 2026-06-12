"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadArchive, CATEGORY_LABELS, CATEGORY_ICONS, StoryCategory } from "@/lib/archiveEngine";
import { hasGeminiKey, geminiRefineForgeOutput } from "@/lib/geminiEngine";

const KEYWORD_MAP: Array<{ keywords: string[]; categories: StoryCategory[] }> = [
  { keywords: ["character","person","hero","villain","npc","protagonist"], categories: ["characters","relationships","emotional-architecture"] },
  { keywords: ["relationship","love","romance","friend","enemy","rival"], categories: ["relationships","characters","emotional-architecture"] },
  { keywords: ["magic","spell","power","ability","supernatural"], categories: ["magic-supernatural","items-equipment","rules"] },
  { keywords: ["world","lore","history","mythology","legend"], categories: ["world-overview","history","lore-mythology"] },
  { keywords: ["location","place","city","dungeon","castle","map"], categories: ["locations","geography"] },
  { keywords: ["combat","fight","battle","war","weapon","strategy"], categories: ["conflict-combat","items-equipment","rules"] },
  { keywords: ["quest","mission","plot","story","objective"], categories: ["quests-plotlines","timeline-continuity","mysteries"] },
  { keywords: ["faction","organization","guild","politics","power"], categories: ["factions","organizations","political-systems"] },
  { keywords: ["rpg","campaign","game","session","player","dm","gm"], categories: ["rules","player-character","session-notes","conflict-combat"] },
  { keywords: ["write","style","tone","narrative","editor","critique"], categories: ["writing-style","themes-tone"] },
  { keywords: ["mystery","secret","hidden","conspiracy","unknown"], categories: ["mysteries","information-architecture"] },
  { keywords: ["emotion","trauma","feel","psychological","internal"], categories: ["emotional-architecture","characters","relationships"] },
  { keywords: ["creature","monster","beast","wildlife","animal"], categories: ["creatures-wildlife","locations"] },
  { keywords: ["item","artifact","equipment","relic","treasure"], categories: ["items-equipment","history"] },
  { keywords: ["timeline","event","history","past","era","age"], categories: ["timeline-continuity","history","session-notes"] },
];

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as StoryCategory[];

export default function PromptForgePage() {
  const router = useRouter();
  const [archive, setArchive] = useState(loadArchive());
  const [goal, setGoal] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<StoryCategory[]>([]);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [sentToFinal, setSentToFinal] = useState(false);
  const [refining, setRefining] = useState(false);

  useEffect(() => { setArchive(loadArchive()); }, []);

  function analyzeGoal() {
    const detected = new Set<StoryCategory>();
    const lower = goal.toLowerCase();
    for (const { keywords, categories } of KEYWORD_MAP) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) categories.forEach((c) => detected.add(c));
      }
    }
    const categoriesWithEntries = new Set(archive.entries.map((e) => e.category));
    for (const cat of detected) { if (!categoriesWithEntries.has(cat)) detected.delete(cat); }
    if (detected.size === 0) categoriesWithEntries.forEach((c) => detected.add(c));
    setSelectedCategories(Array.from(detected));
  }

  function toggleCategory(category: StoryCategory) {
    setSelectedCategories((prev) => prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]);
  }

  function forgePrompt() {
    const goalLower = goal.toLowerCase();
    const context = archive.entries
      .filter((e) => selectedCategories.includes(e.category))
      .map((e) => `• [${CATEGORY_LABELS[e.category]}] ${e.text}`)
      .join("\n");

    if (!context) { setEditablePrompt("No entries found for the selected categories. Add information via the Inbox first."); return; }

    let prompt = "";
    if (goalLower.includes("editor") || goalLower.includes("critique")) {
      prompt = `Role:\nYou are an expert editor and story critic.\n\nObjective:\n${goal}\n\nArchive Context:\n${context}\n\nInstructions:\n- Identify weaknesses and inconsistencies.\n- Suggest improvements grounded in the archive.\n- Be constructive but honest.\n\nOutput:\nProvide clear feedback and recommendations.`;
    } else if (goalLower.includes("rpg") || goalLower.includes("campaign") || goalLower.includes("game master") || goalLower.includes("gm") || goalLower.includes("dm")) {
      prompt = `Role:\nYou are an immersive Game Master running a living story campaign.\n\nObjective:\n${goal}\n\nWorld & Archive Context:\n${context}\n\nInstructions:\n- Treat all archive entries as established canon.\n- Maintain perfect continuity with stored facts.\n- Never contradict established relationships, rules, or events.\n- Encourage meaningful player choices.\n\nOutput:\nRespond as the Game Master, preserving all continuity.`;
    } else if (goalLower.includes("character") || goalLower.includes("profile")) {
      prompt = `Role:\nYou are a deep character analyst and story consultant.\n\nObjective:\n${goal}\n\nCharacter & World Context:\n${context}\n\nInstructions:\n- Draw on established relationships, history, and emotional architecture.\n- Stay consistent with stored character traits and arcs.\n\nOutput:\nProvide rich, archive-consistent character analysis.`;
    } else if (goalLower.includes("brainstorm") || goalLower.includes("idea")) {
      prompt = `Objective:\n${goal}\n\nArchive Context:\n${context}\n\nInstructions:\n- Generate ideas consistent with the established archive.\n- Flag any idea that might create contradictions.\n\nOutput:\nPresent ideas clearly, noting how each fits the existing archive.`;
    } else {
      prompt = `Role:\nYou are a helpful assistant with full knowledge of this archive.\n\nObjective:\n${goal}\n\nArchive Context:\n${context}\n\nInstructions:\n- Use the archive as your primary source of truth.\n- Never invent facts that contradict stored entries.\n\nOutput:\nProvide the best possible response grounded in the archive.`;
    }
    setEditablePrompt(prompt);
    setSentToFinal(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(editablePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExport() {
    const blob = new Blob([editablePrompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "forged-prompt.txt";
    a.click(); URL.revokeObjectURL(url);
  }

  function handleSendToFinal() {
    // Store forge output in sessionStorage so Custom Prompt page can read it
    sessionStorage.setItem("forgeOutput", editablePrompt);
    setSentToFinal(true);
    setTimeout(() => router.push("/custom-prompt"), 800);
  }

  const categoriesWithEntries = new Set(archive.entries.map((e) => e.category));

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>
      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "bold" }}>⚒ Prompt Forge</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleCopy} disabled={!editablePrompt} style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: !editablePrompt ? 0.3 : 1, fontSize: "0.875rem" }}>{copied ? "✓ Copied" : "📋 Copy"}</button>
          <button onClick={handleExport} disabled={!editablePrompt} style={{ background: "#16a34a", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: !editablePrompt ? 0.3 : 1, fontSize: "0.875rem" }}>📄 Export</button>
          <button onClick={() => setEditablePrompt("")} disabled={!editablePrompt} style={{ background: "#d97706", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: !editablePrompt ? 0.3 : 1, fontSize: "0.875rem" }}>🔄 Reset</button>
        </div>
      </div>

      {/* Goal input */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: "bold", marginBottom: "0.75rem" }}>What kind of prompt do you want?</h2>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder="Example: Create a prompt for a Game Master running a Harry Potter RPG with Valefor as the player character."
          style={{ width: "100%", height: "8rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", outline: "none", resize: "none", fontSize: "0.875rem", color: "var(--va-text)", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
          <button onClick={analyzeGoal} disabled={!goal.trim()} style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: !goal.trim() ? 0.3 : 1 }}>⚒ Analyze Goal</button>
          <button onClick={forgePrompt} disabled={!selectedCategories.length} style={{ background: "#ea580c", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: !selectedCategories.length ? 0.3 : 1 }}>⚒ Forge Prompt</button>
        </div>
      </div>

      {/* Categories */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Categories</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem" }}>Only categories with entries shown.</p>
        {categoriesWithEntries.size === 0 ? (
          <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>No entries yet. Add information via the Inbox first.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
            {ALL_CATEGORIES.filter((c) => categoriesWithEntries.has(c)).map((category) => (
              <label key={category} style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--va-surface)", padding: "0.75rem", borderRadius: "0.5rem", cursor: "pointer", border: "1px solid var(--va-border)" }}>
                <input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} style={{ accentColor: "var(--va-accent)" }} />
                <span style={{ fontSize: "0.875rem", color: "var(--va-text)" }}>{CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Workspace */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "bold" }}>Forged Prompt Workspace</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {editablePrompt && hasGeminiKey() && (
              <button onClick={async () => { setRefining(true); const refined = await geminiRefineForgeOutput(editablePrompt, goal); setEditablePrompt(refined); setRefining(false); }}
                disabled={refining}
                style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: refining ? 0.6 : 1 }}>
                {refining ? "✨ Refining..." : "✨ AI Refine"}
              </button>
            )}
            {editablePrompt && (
              <button onClick={handleSendToFinal}
                style={{ background: sentToFinal ? "#15803d" : "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", transition: "background 0.2s" }}>
                {sentToFinal ? "✓ Sending to Final Prompt..." : "⚡ Send to Final Prompt"}
              </button>
            )}
          </div>
        </div>
        <textarea value={editablePrompt} onChange={(e) => setEditablePrompt(e.target.value)}
          placeholder="Your forged prompt will appear here. Click 'Send to Final Prompt' to combine it with your Master Prompt and Custom Instructions."
          style={{ width: "100%", height: "40vh", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", outline: "none", resize: "none", fontSize: "0.875rem", color: "var(--va-text)", boxSizing: "border-box" }} />
      </div>
    </div>
  );
}