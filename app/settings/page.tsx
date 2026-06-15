"use client";

import Link from "next/link";
import { useMusic } from "../MusicPlayer";
import { useEffect, useState } from "react";
import { clearArchive, exportVault, getActiveVaultId, loadArchive, regenerateMasterPrompt, saveArchive, pushHistory, undoArchive, redoArchive,
  getGistToken, setGistToken, clearGistToken, hasGistToken, testGistConnection,
  saveToGist, loadFromGist, getGistAutoSave, setGistAutoSave } from "@/lib/archiveEngine";
import {
  getGeminiKey, setGeminiKey, clearGeminiKey, testGeminiConnection, hasGeminiKey,
  getGeminiQualityKey, setGeminiQualityKey, clearGeminiQualityKey, testGeminiQualityConnection, hasGeminiQualityKey,
  getDeepSeekKey, setDeepSeekKey, clearDeepSeekKey, testDeepSeekConnection, hasDeepSeekKey,
  getGroqKey, setGroqKey, clearGroqKey, testGroqConnection, hasGroqKey,
  getGeminiQualityKey2, setGeminiQualityKey2, clearGeminiQualityKey2, hasGeminiQualityKey2,
  getGeminiQualityKey3, setGeminiQualityKey3, clearGeminiQualityKey3, hasGeminiQualityKey3,
  geminiChat, geminiErrorMessage, geminiTargetedDelete,
} from "../../lib/geminiEngine";

const ACCENT_COLORS = [
  { name: "Blue",    value: "#3b82f6" },
  { name: "Violet",  value: "#7c3aed" },
  { name: "Emerald", value: "#10b981" },
  { name: "Rose",    value: "#f43f5e" },
  { name: "Amber",   value: "#f59e0b" },
  { name: "Cyan",    value: "#06b6d4" },
  { name: "Pink",    value: "#ec4899" },
  { name: "Orange",  value: "#f97316" },
  { name: "White",   value: "#e8e8f0" },
];

const BG_PRESETS = [
  { name: "Void Black",   bg: "#080808", surface: "#111827", border: "#1f2937", text: "#f9fafb", muted: "#6b7280" },
  { name: "Deep Navy",    bg: "#0a0f1e", surface: "#0f1a2e", border: "#1a2a45", text: "#e2e8f0", muted: "#64748b" },
  { name: "Dark Purple",  bg: "#0d0a1e", surface: "#150f2e", border: "#231745", text: "#ede9fe", muted: "#7c6fa0" },
  { name: "Dark Green",   bg: "#061208", surface: "#0c1f0f", border: "#143318", text: "#dcfce7", muted: "#4b7a55" },
  { name: "Dark Red",     bg: "#120608", surface: "#1f0a0e", border: "#33111a", text: "#ffe4e6", muted: "#9f5060" },
  { name: "Charcoal",     bg: "#111111", surface: "#1c1c1c", border: "#2a2a2a", text: "#f5f5f5", muted: "#888888" },
  { name: "Slate",        bg: "#0f172a", surface: "#1e293b", border: "#334155", text: "#f1f5f9", muted: "#94a3b8" },
  { name: "Light Grey",   bg: "#e5e7eb", surface: "#f3f4f6", border: "#d1d5db", text: "#111827", muted: "#4b5563" },
];

const TAB_EMOJIS = [
  "📖","🌌","⚔️","🔮","🧙","🏰","🗺️","📜","🌙","☀️",
  "🔥","❄️","⚡","🌊","🌿","💀","👁️","🎭","🎲","🏛️",
  "🐉","⚗️","🗡️","🛡️","📿","🔑","🌺","🦅","🐺","💎",
];

type ThemeSettings = {
  brightness: number; accentColor: string; bgPreset: string;
  bgColor: string; surfaceColor: string; borderColor: string;
  textColor: string; mutedColor: string; tabColor: string; tabEmoji: string;
};

const DEFAULT_THEME: ThemeSettings = {
  brightness: 0, accentColor: "#3b82f6", bgPreset: "Void Black",
  bgColor: "#080808", surfaceColor: "#111827", borderColor: "#1f2937",
  textColor: "#f9fafb", mutedColor: "#6b7280", tabColor: "#1f2937", tabEmoji: "📖",
};

function loadTheme(): ThemeSettings {
  try { const saved = localStorage.getItem("valArchivesTheme"); if (saved) return { ...DEFAULT_THEME, ...JSON.parse(saved) }; } catch {}
  return { ...DEFAULT_THEME };
}

function applyTheme(theme: ThemeSettings) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("va-theme-update"));
  const root = document.documentElement;
  if (theme.brightness > 0) {
    const t = theme.brightness / 100;
    function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }
    function hexToRgb(hex: string): [number, number, number] { return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]; }
    function interp(h1: string, h2: string, t: number) { const c1 = hexToRgb(h1), c2 = hexToRgb(h2); return `rgb(${lerp(c1[0],c2[0],t)},${lerp(c1[1],c2[1],t)},${lerp(c1[2],c2[2],t)})`; }
    root.style.setProperty("--va-bg", interp(theme.bgColor, "#e5e7eb", t));
    root.style.setProperty("--va-surface", interp(theme.surfaceColor, "#f3f4f6", t));
    root.style.setProperty("--va-border", interp(theme.borderColor, "#d1d5db", t));
    root.style.setProperty("--va-text", interp(theme.textColor, "#111827", t));
    root.style.setProperty("--va-text-muted", interp(theme.mutedColor, "#4b5563", t));
  } else {
    root.style.setProperty("--va-bg", theme.bgColor);
    root.style.setProperty("--va-surface", theme.surfaceColor);
    root.style.setProperty("--va-border", theme.borderColor);
    root.style.setProperty("--va-text", theme.textColor);
    root.style.setProperty("--va-text-muted", theme.mutedColor);
  }
  root.style.setProperty("--va-accent", theme.accentColor);
}

const INSTRUCTIONS = [
  { title: "📥 Inbox", description: "Player content entry point. Two modes: Copy & Paste tab (paste session notes directly) or Upload Files tab (TXT, MD, PDF — stored permanently in browser storage). Click ✨ Distill Story to open the distill panel — Gemini reads your entire content in 4 focused passes (Characters & Relationships, Events & Quests, World & Lore, Items & Mysteries) and creates a structured Story Reference document. Click ⚡ Import to 🎮 Player Story to send everything to the Player Story subtab in Story Studio. For quick imports without distilling: click ✨ Analyze → AI classifies text → Import to Player Story. The 💾 Save Prompt button generates a session extraction prompt; click ✨ AI Personalize for a version tailored to your specific archive." },
  { title: "🏛 Canon Archives", description: "Source library for canon material. Upload TXT or PDF files — stored permanently in browser storage. Click ✨ Distill Canon to open the distill panel — Gemini reads the entire file at once (up to 900k chars) and creates a structured Canon Reference document with Characters, Locations, Relationships, Magic, Organizations, Key Events, World Rules, Items, and Canon Facts. Add to queue and Gemini processes automatically with indefinite auto-retry. After distillation: click View & Save → Save to Canon Archives, then ⚡ Import to Vault to send everything to the Canon Story subtab. Dedicated to Gemini Key 1 for rate limit isolation." },
  { title: "📖 Story Studio", description: "Two completely separate subtabs: 📖 Canon Story (facts from Canon Archives — what the source material says) and 🎮 Player Story (your character's actual journey from Inbox). Each subtab has 30+ world-building categories including Romance & Love. Canon imports always go to Canon Story only. Inbox imports always go to Player Story only — never mixed. Priority dots on every tile: once = blue (2nd priority), twice = red (1st priority). Click any tile to view, edit, or delete entries." },
  { title: "🌀 Pensieve", description: "Three-stage AI search across both subtabs. Stage 1 (Cerebras): instant keyword scan of all vault entries. Stage 2 (Cerebras): investigates candidates for true relevance. Stage 3 (Gemini Key 3): writes a narrative answer synthesizing the evidence. Filter results by All / Canon Story / Player Story. Each result shows a 📖 or 🎮 label indicating which subtab it came from. Edit or delete entries inline." },
  { title: "👑 Master Prompt", description: "Automatically compiled from BOTH subtabs in priority order. Red priority entries appear at the top with maximum emphasis. Blue priority in the middle. No priority entries interleaved by category. Each section shows Canon Story and Player Story sub-sections with clear distinction. Rules always come first. Click ✨ AI Refine to improve clarity while preserving all content. Copy and paste into any AI to give it complete knowledge of your world." },
  { title: "🕰 Custom Prompt", description: "Write global instructions applied to every prompt — tone, style, things the AI should always or never do. Click ✨ AI Enhance to improve your instructions based on your archive context. Combined with Master Prompt and Forge output to create the Final Prompt." },
  { title: "⚒ Prompt Forge", description: "Build specialized prompts for specific goals. Describe what you want, click Analyze Goal to auto-select categories, then Forge Prompt. Click ✨ AI Refine to improve the output. Send to Final Prompt to combine with Custom Prompt and Master Prompt." },
  { title: "📋 Rule Book", description: "All rules live here — world laws, game mechanics, GM rules. Rules feed into Master Prompt first before any other content. Type a rule and click ✨ to have AI make it clearer and more precise before adding." },
  { title: "⏳ Timeline Save", description: "Store complete session saves intact — no splitting. Paste the AI response to your Save Prompt here and name it. Click + Branch to create an alternate timeline from any save point. The green button on any save or branch makes it the active timeline — only one active at a time. The active timeline feeds into Master Prompt word-for-word." },
  { title: "👤 Character Dashboard", description: "Add up to 5 character panels on the dashboard. Click + Add Character and type any name — Val Archives automatically searches all vault entries across both Canon Story and Player Story subtabs mentioning that name and extracts traits, goals, achievements, allies, and rivals. Click ✨ AI to have AI analyze all matching entries and produce a refined character summary." },
  { title: "🔴🔵 Priority System", description: "Click the dot next to any category tile in either Story subtab. Once = blue (2nd priority, multiple allowed). Twice = red (1st priority, only one at a time). Three times = off. Priority applies per-subtab. Red priority entries appear at the TOP of the Master Prompt with a strong instruction. Blue emphasized in the middle. No priority = interleaved by category, Canon before Player." },
  { title: "✨ The Archivist — AI System", description: "Three Gemini keys with dedicated routing: Key 1 (Canon) handles Distill Canon and Import to Vault — falls back to Key 3. Key 2 (Inbox) handles Distill Story and Import to Player Story — falls back to Key 3. Key 3 (General) handles Pensieve answers, Chat, all ✨ refine buttons, Master Prompt, Prompt Forge — falls back to Key 1 then Key 2. Groq handles Extract to Vault (raw txt fallback). Cerebras handles Pensieve keyword search, Inbox classify, fast tasks. If all keys hit rate limit simultaneously, long processes (distill/import) pause automatically and resume when a key resets." },
  { title: "🗑 AI Targeted Delete", description: "In Settings → Alert Zone. Type what you want to delete — Gemini searches both Canon Story and Player Story subtabs for matching entries. Results show with checkboxes — tick exactly which ones to delete. Select All / None buttons for bulk selection. Uses Undo history for safety." },
  { title: "💾 Vault Safety", description: "Vault entries (Canon Story + Player Story) are stored in both localStorage and IndexedDB — IndexedDB is the primary store and never truncates. Uploaded files in Canon Archives and Inbox are stored in separate IndexedDB databases (valArchivesCanonDB and valArchivesInboxDB) — they survive page refresh, navigation, and vault clears. Clear Vault only wipes story entries, never files or Canon References. Undo history available for accidental deletions." },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [activeSection, setActiveSection] = useState<"display" | "personalisation" | "instructions" | "ai" | "danger" | "music" | "cloud">("display");
  const { songs, currentIndex, isPlaying, volume, loopMode, addSongs, removeSong, playSong, togglePlay, setVolume, setLoopMode, clearAll } = useMusic();
  const [saved, setSaved] = useState(false);
  const [vaultCleared, setVaultCleared] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [qualityApiKey, setQualityApiKey] = useState("");
  const [qualityApiKeyVisible, setQualityApiKeyVisible] = useState(false);
  const [testingQualityApi, setTestingQualityApi] = useState(false);
  const [qualityApiStatus, setQualityApiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [deepSeekKey, setDeepSeekKeyState] = useState("");
  const [testingDeepSeek, setTestingDeepSeek] = useState(false);
  const [deepSeekStatus, setDeepSeekStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [groqKey, setGroqKeyState] = useState("");
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [qualityApiKey2, setQualityApiKey2] = useState("");
  const [qualityApiKey2Visible, setQualityApiKey2Visible] = useState(false);
  const [qualityApiStatus2, setQualityApiStatus2] = useState<{ ok: boolean; message: string } | null>(null);
  const [qualityApiKey3, setQualityApiKey3] = useState("");
  const [qualityApiKey3Visible, setQualityApiKey3Visible] = useState(false);
  const [qualityApiStatus3, setQualityApiStatus3] = useState<{ ok: boolean; message: string } | null>(null);
  const [gistToken, setGistTokenState] = useState("");
  const [gistStatus, setGistStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [gistSaving, setGistSaving] = useState(false);
  const [gistLoading, setGistLoading] = useState(false);
  const [gistAutoSave, setGistAutoSaveState] = useState(false);
  const [gistTokenVisible, setGistTokenVisible] = useState(false);
  const [aiViewMode, setAiViewMode] = useState<"simple" | "advanced">("simple");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [deleteQuery, setDeleteQuery] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<Array<{ id: string; text: string; category: string; reason: string; selected: boolean }>>([]);
  const [deletingTargets, setDeletingTargets] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [undoStatus, setUndoStatus] = useState("");

  useEffect(() => {
    const loaded = loadTheme(); setTheme(loaded); applyTheme(loaded);
    const savedKey = getGeminiKey(); if (savedKey) setApiKey(savedKey);
    const savedQualityKey = getGeminiQualityKey(); if (savedQualityKey) setQualityApiKey(savedQualityKey);
    const savedDSKey = getDeepSeekKey(); if (savedDSKey) setDeepSeekKeyState(savedDSKey);
    const savedGroqKey = getGroqKey(); if (savedGroqKey) setGroqKeyState(savedGroqKey);
    const savedQK2 = getGeminiQualityKey2(); if (savedQK2) setQualityApiKey2(savedQK2);
    const savedQK3 = getGeminiQualityKey3(); if (savedQK3) setQualityApiKey3(savedQK3);
    const savedGistToken = getGistToken(); if (savedGistToken) setGistTokenState(savedGistToken);
    setGistAutoSaveState(getGistAutoSave());
  }, []);

  function updateTheme(updates: Partial<ThemeSettings>) {
    const updated = { ...theme, ...updates }; setTheme(updated); applyTheme(updated);
    localStorage.setItem("valArchivesTheme", JSON.stringify(updated));
  }
  function applyBgPreset(preset: typeof BG_PRESETS[0]) {
    updateTheme({ bgPreset: preset.name, bgColor: preset.bg, surfaceColor: preset.surface, borderColor: preset.border, textColor: preset.text, mutedColor: preset.muted, brightness: 0 });
  }
  function handleSave() { localStorage.setItem("valArchivesTheme", JSON.stringify(theme)); applyTheme(theme); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function handleResetTheme() { setTheme(DEFAULT_THEME); applyTheme(DEFAULT_THEME); localStorage.setItem("valArchivesTheme", JSON.stringify(DEFAULT_THEME)); }
  function handleClearVault() {
    if (!confirm("⚠️ Permanently delete your entire vault? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Everything will be deleted.")) return;
    clearArchive();
    // Also clear dashboard cards from localStorage directly
    localStorage.removeItem("valArchivesDashboardCards");
    setVaultCleared(true);
    // Reload after short delay so IDB clear completes
    setTimeout(() => window.location.reload(), 500);
  }

  const sections = [
    { id: "display", label: "🌙 Display" }, { id: "personalisation", label: "🎨 Personalisation" },
    { id: "instructions", label: "📖 Instructions" }, { id: "ai", label: "✨ AI" },
    { id: "cloud", label: "☁️ Cloud Backup" },
    { id: "music", label: "🎵 Music / BGM" }, { id: "danger", label: "🚨 Alert Zone" },
  ] as const;

  async function handleSendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim(); setChatInput(""); setChatError("");
    const userMsg = { role: "user" as const, text: msg };
    setChatMessages(prev => [...prev, userMsg]); setChatLoading(true);
    try {
      const archive = loadArchive(); const withPrompt = regenerateMasterPrompt(archive);
      const history = chatMessages.map(m => ({ role: m.role, text: m.text }));
      const response = await geminiChat(msg, withPrompt.masterPrompt, history);
      setChatMessages(prev => [...prev, { role: "model", text: response }]);
    } catch (err) { setChatError(geminiErrorMessage(err)); setChatMessages(prev => prev.slice(0, -1)); }
    finally { setChatLoading(false); }
  }

  const S = {
    card: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" },
    input: { background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", fontFamily: "monospace" },
    btn: (bg: string, color = "white") => ({ background: bg, color, padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600" as const, fontSize: "0.875rem" }),
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)" }}>
      <div style={{ borderBottom: "1px solid var(--va-border)", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>← Home</Link>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>⚙ Settings</h1>
        </div>
        <button onClick={handleSave} style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
          {saved ? "✓ Saved!" : "Save Settings"}
        </button>
      </div>

      <div style={{ display: "flex" }}>
        <aside style={{ width: "13rem", borderRight: "1px solid var(--va-border)", padding: "1rem", minHeight: "100vh", background: "var(--va-surface)" }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                style={{ width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontSize: "0.875rem", background: activeSection === s.id ? "var(--va-border)" : "transparent", color: activeSection === s.id ? "var(--va-text)" : "var(--va-text-muted)" }}>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <main style={{ flex: 1, padding: "2rem", maxWidth: (activeSection === "instructions" || activeSection === "danger") ? "100%" : "42rem" }}>

          {/* ── DISPLAY ── */}
          {activeSection === "display" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div><h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Display</h2><p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Fine-tune brightness.</p></div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Brightness <span style={{ color: "var(--va-text-muted)", fontWeight: "normal" }}>{theme.brightness}%</span></label>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Dark</span>
                  <input type="range" min="0" max="100" value={theme.brightness} onChange={e => updateTheme({ brightness: Number(e.target.value) })} style={{ flex: 1, accentColor: "var(--va-accent)" }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Light</span>
                </div>
              </div>
              <button onClick={handleResetTheme} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", textAlign: "left" }}>Reset to defaults</button>
            </div>
          )}

          {/* ── PERSONALISATION ── */}
          {activeSection === "personalisation" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div><h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Personalisation</h2><p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Customize appearance.</p></div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Website Theme</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginBottom: "1rem" }}>
                  {BG_PRESETS.map(preset => (
                    <button key={preset.name} onClick={() => applyBgPreset(preset)}
                      style={{ background: preset.bg, border: theme.bgPreset === preset.name ? `2px solid ${theme.accentColor}` : `1px solid ${preset.border}`, borderRadius: "0.5rem", padding: "0.75rem 0.5rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                      <div style={{ width: "100%", height: "0.5rem", borderRadius: "9999px", background: preset.surface }} />
                      <span style={{ fontSize: "0.625rem", color: preset.text, whiteSpace: "nowrap" }}>{preset.name}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Custom bg:</label>
                  <input type="color" value={theme.bgColor} onChange={e => updateTheme({ bgColor: e.target.value, bgPreset: "Custom" })} style={{ width: "2.5rem", height: "2rem", borderRadius: "0.25rem", border: "1px solid var(--va-border)", background: "transparent", cursor: "pointer" }} />
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--va-text-muted)" }}>{theme.bgColor}</span>
                </div>
              </div>
              <div style={S.card}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Live Preview</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                  <div style={{ height: "0.75rem", borderRadius: "9999px", width: "75%", background: "var(--va-border)" }} />
                  <div style={{ height: "0.75rem", borderRadius: "9999px", width: "50%", background: "var(--va-border)" }} />
                  <div style={{ height: "0.75rem", borderRadius: "9999px", width: "33%", background: "var(--va-accent)" }} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ padding: "0.375rem 0.75rem", borderRadius: "0.375rem", background: "var(--va-accent)", color: "white", fontSize: "0.75rem", fontWeight: "600" }}>Button</div>
                  <div style={{ padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--va-border)", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>Secondary</div>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Accent Color</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  {ACCENT_COLORS.map(color => (
                    <button key={color.value} onClick={() => updateTheme({ accentColor: color.value })} title={color.name}
                      style={{ width: "2.25rem", height: "2.25rem", borderRadius: "9999px", background: color.value, border: "none", cursor: "pointer", outline: theme.accentColor === color.value ? "3px solid white" : "none", outlineOffset: "2px" }} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Custom:</label>
                  <input type="color" value={theme.accentColor} onChange={e => updateTheme({ accentColor: e.target.value })} style={{ width: "2.5rem", height: "2rem", borderRadius: "0.25rem", border: "1px solid var(--va-border)", background: "transparent", cursor: "pointer" }} />
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--va-text-muted)" }}>{theme.accentColor}</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Default Tab Emoji</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {TAB_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => updateTheme({ tabEmoji: emoji })}
                      style={{ width: "2.5rem", height: "2.5rem", fontSize: "1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", background: theme.tabEmoji === emoji ? "var(--va-border)" : "var(--va-surface)", outline: theme.tabEmoji === emoji ? "1px solid var(--va-accent)" : "none" }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.5rem" }}>Import Custom Icon</label>
                <label style={{ cursor: "pointer", display: "block" }}>
                  <div style={{ border: "1px dashed var(--va-border)", borderRadius: "0.5rem", padding: "1.5rem", textAlign: "center" }}>
                    <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Click to upload PNG, JPG, or SVG</p>
                  </div>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => updateTheme({ tabEmoji: ev.target?.result as string }); reader.readAsDataURL(file); }} />
                </label>
              </div>
            </div>
          )}

          {/* ── INSTRUCTIONS ── */}
          {activeSection === "instructions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
              <div><h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Instructions</h2><p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Everything Val Archives can do.</p></div>
              <div style={S.card}><p style={{ fontSize: "0.875rem", lineHeight: "1.6", color: "var(--va-text)" }}><strong>Val Archives</strong> is a Prompt Operating System. Feed it information about your world, story, or RPG campaign. It organizes everything automatically, maintains continuity, and generates powerful prompts you can use with any AI.</p></div>
              {INSTRUCTIONS.map(item => (
                <div key={item.title} style={S.card}>
                  <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{item.title}</h3>
                  <p style={{ fontSize: "0.875rem", lineHeight: "1.6", color: "var(--va-text-muted)", whiteSpace: "pre-line" }}>{item.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── AI ── */}
          {activeSection === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Header */}
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>✨ The Archivist</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Three specialized AI models working as one. Each handles what it does best.</p>
              </div>

              {/* Simple / Advanced toggle */}
              <div style={{ display: "flex", gap: "0.375rem", background: "var(--va-surface)", padding: "0.25rem", borderRadius: "0.5rem", border: "1px solid var(--va-border)", width: "fit-content" }}>
                {(["simple", "advanced"] as const).map(mode => (
                  <button key={mode} onClick={() => setAiViewMode(mode)}
                    style={{ padding: "0.375rem 0.875rem", borderRadius: "0.375rem", border: "none", background: aiViewMode === mode ? "var(--va-accent)" : "transparent", color: aiViewMode === mode ? "white" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.8rem", fontWeight: aiViewMode === mode ? "700" : "400" }}>
                    {mode === "simple" ? "Simple" : "Advanced"}
                  </button>
                ))}
              </div>

              {/* Simple Mode — three key inputs */}
              {aiViewMode === "simple" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                  {/* Cerebras */}
                  <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <div>
                        <p style={{ fontWeight: "700", fontSize: "0.9rem" }}>⚡ Cerebras <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", fontWeight: "400" }}>— The Clerk</span></p>
                        <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginTop: "0.2rem" }}>cloud.cerebras.ai · Free · No card required</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>For: Pensieve keyword search, fast retrieval</p>
                      </div>
                      {hasGeminiKey() && <span style={{ fontSize: "0.7rem", color: "#4ade80", flexShrink: 0 }}>✓ Connected</span>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <input type={apiKeyVisible ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="csk_..."
                        style={{ ...S.input, flex: 1 }} />
                      <button onClick={() => setApiKeyVisible(!apiKeyVisible)} style={{ ...S.btn("var(--va-border)", "var(--va-text-muted)"), padding: "0.5rem 0.75rem" }}>{apiKeyVisible ? "Hide" : "Show"}</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => { if (apiKey.trim()) { setGeminiKey(apiKey.trim()); setApiStatus({ ok: true, message: "Saved" }); setTimeout(() => setApiStatus(null), 2000); } }} disabled={!apiKey.trim()} style={{ ...S.btn("var(--va-accent)"), opacity: !apiKey.trim() ? 0.4 : 1 }}>Save</button>
                      <button onClick={async () => { setTestingApi(true); if (apiKey.trim()) setGeminiKey(apiKey.trim()); const r = await testGeminiConnection(); setApiStatus(r); setTestingApi(false); }} disabled={!apiKey.trim() || testingApi} style={{ ...S.btn("var(--va-border)", "var(--va-text)"), opacity: (!apiKey.trim() || testingApi) ? 0.4 : 1 }}>{testingApi ? "Testing..." : "Test"}</button>
                      <button onClick={() => { clearGeminiKey(); setApiKey(""); }} style={{ ...S.btn("none", "var(--va-text-muted)"), border: "1px solid var(--va-border)" }}>Remove</button>
                    </div>
                    {apiStatus && <p style={{ marginTop: "0.375rem", fontSize: "0.8rem", color: apiStatus.ok ? "#4ade80" : "#f87171" }}>{apiStatus.ok ? "✓" : "✗"} {apiStatus.message}</p>}
                  </div>

                  {/* Groq */}
                  <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <div>
                        <p style={{ fontWeight: "700", fontSize: "0.9rem" }}>🧠 Groq <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", fontWeight: "400" }}>— The Deep Historian</span></p>
                        <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginTop: "0.2rem" }}>console.groq.com · Free · No card required</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>For: Extract to Vault, Timeline Checks, Contradiction Detection, Canon Placement, Verify Categories</p>
                        <p style={{ fontSize: "0.72rem", color: "#fbbf24" }}>Low-frequency, high-stakes tasks. Falls back to Cerebras if not set.</p>
                      </div>
                      {hasGroqKey() && <span style={{ fontSize: "0.7rem", color: "#4ade80", flexShrink: 0 }}>✓ Connected</span>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <input type="password" value={groqKey} onChange={e => setGroqKeyState(e.target.value)} placeholder="gsk_..."
                        style={{ ...S.input, flex: 1 }} />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => { if (groqKey.trim()) { setGroqKey(groqKey.trim()); setGroqStatus({ ok: true, message: "Saved" }); setTimeout(() => setGroqStatus(null), 2000); } }} disabled={!groqKey.trim()} style={{ ...S.btn("var(--va-accent)"), opacity: !groqKey.trim() ? 0.4 : 1 }}>Save</button>
                      <button onClick={async () => { setTestingGroq(true); if (groqKey.trim()) setGroqKey(groqKey.trim()); const r = await testGroqConnection(); setGroqStatus(r); setTestingGroq(false); }} disabled={!groqKey.trim() || testingGroq} style={{ ...S.btn("var(--va-border)", "var(--va-text)"), opacity: (!groqKey.trim() || testingGroq) ? 0.4 : 1 }}>{testingGroq ? "Testing..." : "Test"}</button>
                      <button onClick={() => { clearGroqKey(); setGroqKeyState(""); }} style={{ ...S.btn("none", "var(--va-text-muted)"), border: "1px solid var(--va-border)" }}>Remove</button>
                    </div>
                    {groqStatus && <p style={{ marginTop: "0.375rem", fontSize: "0.8rem", color: groqStatus.ok ? "#4ade80" : "#f87171" }}>{groqStatus.ok ? "✓" : "✗"} {groqStatus.message}</p>}
                  </div>

                  {/* Gemini */}
                  <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <div>
                        <p style={{ fontWeight: "700", fontSize: "0.9rem" }}>✨ Gemini Key 1 — Canon <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", fontWeight: "400" }}>— Dedicated to Canon distill + import</span></p>
                        <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginTop: "0.2rem" }}>Canon Distill → Key 1 → Key 3 fallback</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>aistudio.google.com · Free · No card required</p>
                      </div>
                      {hasGeminiQualityKey() && <span style={{ fontSize: "0.7rem", color: "#4ade80", flexShrink: 0 }}>✓ Connected</span>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <input type={qualityApiKeyVisible ? "text" : "password"} value={qualityApiKey} onChange={e => setQualityApiKey(e.target.value)} placeholder="AIzaSy..."
                        style={{ ...S.input, flex: 1 }} />
                      <button onClick={() => setQualityApiKeyVisible(!qualityApiKeyVisible)} style={{ ...S.btn("var(--va-border)", "var(--va-text-muted)"), padding: "0.5rem 0.75rem" }}>{qualityApiKeyVisible ? "Hide" : "Show"}</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => { if (qualityApiKey.trim()) { setGeminiQualityKey(qualityApiKey.trim()); setQualityApiStatus({ ok: true, message: "Saved" }); setTimeout(() => setQualityApiStatus(null), 2000); } }} disabled={!qualityApiKey.trim()} style={{ ...S.btn("#7c3aed"), opacity: !qualityApiKey.trim() ? 0.4 : 1 }}>Save</button>
                      <button onClick={async () => { setTestingQualityApi(true); if (qualityApiKey.trim()) setGeminiQualityKey(qualityApiKey.trim()); const r = await testGeminiQualityConnection(); setQualityApiStatus(r); setTestingQualityApi(false); }} disabled={!qualityApiKey.trim() || testingQualityApi} style={{ ...S.btn("var(--va-border)", "var(--va-text)"), opacity: (!qualityApiKey.trim() || testingQualityApi) ? 0.4 : 1 }}>{testingQualityApi ? "Testing..." : "Test"}</button>
                      <button onClick={() => { clearGeminiQualityKey(); setQualityApiKey(""); }} style={{ ...S.btn("none", "var(--va-text-muted)"), border: "1px solid var(--va-border)" }}>Remove</button>
                    </div>
                    {qualityApiStatus && <p style={{ marginTop: "0.375rem", fontSize: "0.8rem", color: qualityApiStatus.ok ? "#4ade80" : "#f87171" }}>{qualityApiStatus.ok ? "✓" : "✗"} {qualityApiStatus.message}</p>}
                  </div>

                  {/* Gemini Key 2 */}
                  <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                           <div>
                        <p style={{ fontWeight: "700", fontSize: "0.9rem" }}>✨ Gemini Key 2 — Inbox <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", fontWeight: "400" }}>— Dedicated to Inbox distill + import</span></p>
                        <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginTop: "0.2rem" }}>Inbox Distill → Key 2 → Key 3 fallback</p>
                      </div>
                      {hasGeminiQualityKey2() && <span style={{ fontSize: "0.7rem", color: "#4ade80", flexShrink: 0 }}>✓ Connected</span>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <input type={qualityApiKey2Visible ? "text" : "password"} value={qualityApiKey2} onChange={e => setQualityApiKey2(e.target.value)} placeholder="AIzaSy..."
                        style={{ ...S.input, flex: 1 }} />
                      <button onClick={() => setQualityApiKey2Visible(!qualityApiKey2Visible)} style={{ ...S.btn("var(--va-border)", "var(--va-text-muted)"), padding: "0.5rem 0.75rem" }}>{qualityApiKey2Visible ? "Hide" : "Show"}</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => { if (qualityApiKey2.trim()) { setGeminiQualityKey2(qualityApiKey2.trim()); setQualityApiStatus2({ ok: true, message: "Saved" }); setTimeout(() => setQualityApiStatus2(null), 2000); } }} disabled={!qualityApiKey2.trim()} style={{ ...S.btn("#7c3aed"), opacity: !qualityApiKey2.trim() ? 0.4 : 1 }}>Save</button>
                      <button onClick={async () => { if (qualityApiKey2.trim()) setGeminiQualityKey2(qualityApiKey2.trim()); const r = await testGeminiQualityConnection(); setQualityApiStatus2(r); }} disabled={!qualityApiKey2.trim()} style={{ ...S.btn("var(--va-border)", "var(--va-text)"), opacity: !qualityApiKey2.trim() ? 0.4 : 1 }}>Test</button>
                      <button onClick={() => { clearGeminiQualityKey2(); setQualityApiKey2(""); }} style={{ ...S.btn("none", "var(--va-text-muted)"), border: "1px solid var(--va-border)" }}>Remove</button>
                    </div>
                    {qualityApiStatus2 && <p style={{ marginTop: "0.375rem", fontSize: "0.8rem", color: qualityApiStatus2.ok ? "#4ade80" : "#f87171" }}>{qualityApiStatus2.ok ? "✓" : "✗"} {qualityApiStatus2.message}</p>}
                  </div>

                  {/* Gemini Key 3 */}
                  <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <div>
                        <p style={{ fontWeight: "700", fontSize: "0.9rem" }}>✨ Gemini Key 3 — General <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", fontWeight: "400" }}>— Pensieve, Chat, Refine + fallback for Keys 1 & 2</span></p>
                        <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginTop: "0.2rem" }}>General tasks: Key 3 first. Canon fallback: Key 3. Inbox fallback: Key 3.</p>
                        <p style={{ fontSize: "0.72rem", color: "#fbbf24" }}>If all 3 keys hit rate limit, process pauses and auto-resumes when a key resets.</p>
                      </div>
                      {hasGeminiQualityKey3() && <span style={{ fontSize: "0.7rem", color: "#4ade80", flexShrink: 0 }}>✓ Connected</span>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <input type={qualityApiKey3Visible ? "text" : "password"} value={qualityApiKey3} onChange={e => setQualityApiKey3(e.target.value)} placeholder="AIzaSy..."
                        style={{ ...S.input, flex: 1 }} />
                      <button onClick={() => setQualityApiKey3Visible(!qualityApiKey3Visible)} style={{ ...S.btn("var(--va-border)", "var(--va-text-muted)"), padding: "0.5rem 0.75rem" }}>{qualityApiKey3Visible ? "Hide" : "Show"}</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => { if (qualityApiKey3.trim()) { setGeminiQualityKey3(qualityApiKey3.trim()); setQualityApiStatus3({ ok: true, message: "Saved" }); setTimeout(() => setQualityApiStatus3(null), 2000); } }} disabled={!qualityApiKey3.trim()} style={{ ...S.btn("#7c3aed"), opacity: !qualityApiKey3.trim() ? 0.4 : 1 }}>Save</button>
                      <button onClick={async () => { if (qualityApiKey3.trim()) setGeminiQualityKey3(qualityApiKey3.trim()); const r = await testGeminiQualityConnection(); setQualityApiStatus3(r); }} disabled={!qualityApiKey3.trim()} style={{ ...S.btn("var(--va-border)", "var(--va-text)"), opacity: !qualityApiKey3.trim() ? 0.4 : 1 }}>Test</button>
                      <button onClick={() => { clearGeminiQualityKey3(); setQualityApiKey3(""); }} style={{ ...S.btn("none", "var(--va-text-muted)"), border: "1px solid var(--va-border)" }}>Remove</button>
                    </div>
                    {qualityApiStatus3 && <p style={{ marginTop: "0.375rem", fontSize: "0.8rem", color: qualityApiStatus3.ok ? "#4ade80" : "#f87171" }}>{qualityApiStatus3.ok ? "✓" : "✗"} {qualityApiStatus3.message}</p>}
                  </div>
                </div>
              )}

              {/* Advanced Mode */}
              {aiViewMode === "advanced" && (
                <div style={S.card}>
                  <h3 style={{ fontWeight: "bold", marginBottom: "1rem" }}>The Archivist — Internal Architecture</h3>
                  {[
                    { title: "✨ Gemini Key 1 — Canon", color: "#c4b5fd", tasks: ["Master Prompt refine", "Custom Prompt enhance", "Prompt Forge refine", "Rule enhance", "Save Prompt personalize", "Character Panel AI", "Chat", "Pensieve final answer", "Quick Summaries"] },
                    { title: "🧠 Groq — The Deep Historian", color: "#93c5fd", tasks: ["Extract to Vault", "Timeline Checks", "Contradiction Detection", "Canon Placement", "Verify Categories"] },
                    { title: "⚡ Cerebras — The Clerk + Daily Historian", color: "#86efac", tasks: ["Inbox Sorting", "Verify Categories (basic)", "Entry Suggestions", "Targeted Delete (basic)", "Pensieve keyword pre-filter", "Candidate Retrieval", "Relevance Ranking"] },
                    { title: "⚡ Cerebras — The Clerk", color: "#86efac", tasks: ["Pensieve keyword pre-filter", "Candidate Retrieval", "Relevance Ranking"] },
                  ].map(({ title, color, tasks }) => (
                    <div key={title} style={{ padding: "0.875rem", background: "var(--va-bg)", borderRadius: "0.5rem", borderLeft: `3px solid ${color}`, marginBottom: "0.75rem" }}>
                      <p style={{ fontWeight: "700", color, marginBottom: "0.5rem", fontSize: "0.875rem" }}>{title}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {tasks.map(t => <span key={t} style={{ fontSize: "0.7rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "9999px", padding: "0.1rem 0.5rem", color: "var(--va-text-muted)" }}>{t}</span>)}
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.5rem" }}>Switch to Simple mode to manage API keys.</p>
                </div>
              )}

              {/* Chat */}
              <div style={S.card}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>💬 Chat with Your Archive</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", marginBottom: "0.875rem" }}>AI has full context of your archive. Ask anything.</p>
                <div style={{ height: "320px", overflowY: "auto", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.875rem", marginBottom: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {chatMessages.length === 0 ? (
                    <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "4rem" }}>
                      {hasGeminiKey() ? "Ask anything about your archive..." : "Add your Cerebras key above to start chatting."}
                    </p>
                  ) : chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "80%", padding: "0.625rem 0.875rem", borderRadius: "0.75rem", background: msg.role === "user" ? "var(--va-accent)" : "var(--va-border)", color: "var(--va-text)", fontSize: "0.875rem", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{msg.text}</div>
                    </div>
                  ))}
                  {chatLoading && <div style={{ display: "flex", justifyContent: "flex-start" }}><div style={{ background: "var(--va-border)", padding: "0.625rem 0.875rem", borderRadius: "0.75rem", color: "var(--va-text-muted)", fontSize: "0.875rem" }}>✨ Thinking...</div></div>}
                </div>
                {chatError && <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{chatError}</p>}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }} placeholder="Ask anything... (Enter to send)" disabled={chatLoading}
                    style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem" }} />
                  <button onClick={handleSendChat} disabled={!chatInput.trim() || chatLoading} style={{ ...S.btn("var(--va-accent)"), opacity: (!chatInput.trim() || chatLoading) ? 0.4 : 1 }}>Send</button>
                  <button onClick={() => setChatMessages([])} style={S.btn("var(--va-border)", "var(--va-text-muted)")}>Clear</button>
                </div>
              </div>
            </div>
          )}


          {/* ── CLOUD BACKUP ── */}
          {activeSection === "cloud" && (
            <div>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>☁️ Cloud Backup</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Save your entire vault to GitHub Gist. Free, private, permanent. Works across browsers and devices.</p>
              </div>

              <div style={S.card}>
                <p style={{ fontWeight: "700", fontSize: "0.9rem", marginBottom: "0.25rem" }}>🔑 GitHub Personal Access Token</p>
                <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginBottom: "0.75rem" }}>
                  github.com → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → Generate → check <strong>gist</strong> scope only
                </p>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input type={gistTokenVisible ? "text" : "password"} value={gistToken} onChange={e => setGistTokenState(e.target.value)} placeholder="ghp_..."
                    style={{ ...S.input, flex: 1 }} />
                  <button onClick={() => setGistTokenVisible(!gistTokenVisible)} style={{ ...S.btn("var(--va-border)", "var(--va-text-muted)"), padding: "0.5rem 0.75rem" }}>{gistTokenVisible ? "Hide" : "Show"}</button>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <button onClick={() => { if (gistToken.trim()) { setGistToken(gistToken.trim()); setGistStatus({ ok: true, message: "Saved" }); setTimeout(() => setGistStatus(null), 2000); } }} disabled={!gistToken.trim()}
                    style={{ ...S.btn("var(--va-accent)"), opacity: !gistToken.trim() ? 0.4 : 1 }}>Save</button>
                  <button onClick={async () => { if (gistToken.trim()) setGistToken(gistToken.trim()); const r = await testGistConnection(); setGistStatus(r); }} disabled={!gistToken.trim()}
                    style={{ ...S.btn("var(--va-border)", "var(--va-text)"), opacity: !gistToken.trim() ? 0.4 : 1 }}>Test</button>
                  <button onClick={() => { clearGistToken(); setGistTokenState(""); setGistStatus(null); }}
                    style={{ ...S.btn("none", "var(--va-text-muted)"), border: "1px solid var(--va-border)" }}>Remove</button>
                </div>
                {gistStatus && <p style={{ fontSize: "0.8rem", color: gistStatus.ok ? "#4ade80" : "#f87171", marginBottom: "0.5rem" }}>{gistStatus.ok ? "✓" : "✗"} {gistStatus.message}</p>}

                {/* Auto-save toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 0.875rem", background: "var(--va-bg)", borderRadius: "0.5rem", marginBottom: "0.75rem" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: "600" }}>Auto-save to Gist</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)" }}>Automatically saves every time you import entries or make changes</p>
                  </div>
                  <button onClick={() => { const newVal = !gistAutoSave; setGistAutoSaveState(newVal); setGistAutoSave(newVal); }}
                    style={{ width: "44px", height: "24px", borderRadius: "9999px", border: "none", cursor: "pointer", background: gistAutoSave ? "#22c55e" : "var(--va-border)", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                    <div style={{ position: "absolute", top: "2px", left: gistAutoSave ? "22px" : "2px", width: "20px", height: "20px", borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                  </button>
                </div>

                {/* Manual save/restore */}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={async () => {
                    if (!hasGistToken()) { setGistStatus({ ok: false, message: "Save your token first" }); return; }
                    setGistSaving(true);
                    const archive = loadArchive();
                    const result = await saveToGist(archive);
                    setGistStatus(result);
                    setGistSaving(false);
                  }} disabled={!hasGistToken() || gistSaving}
                    style={{ ...S.btn("#22c55e"), flex: 1, opacity: (!hasGistToken() || gistSaving) ? 0.4 : 1 }}>
                    {gistSaving ? "☁️ Saving..." : "☁️ Save to GitHub Now"}
                  </button>
                  <button onClick={async () => {
                    if (!hasGistToken()) { setGistStatus({ ok: false, message: "Save your token first" }); return; }
                    setGistLoading(true);
                    const result = await loadFromGist();
                    if (result.ok && result.data) {
                      saveArchive(result.data);
                      setGistStatus(result);
                      setTimeout(() => window.location.reload(), 1500);
                    } else {
                      setGistStatus(result);
                    }
                    setGistLoading(false);
                  }} disabled={!hasGistToken() || gistLoading}
                    style={{ ...S.btn("#3b82f6"), flex: 1, opacity: (!hasGistToken() || gistLoading) ? 0.4 : 1 }}>
                    {gistLoading ? "☁️ Loading..." : "☁️ Restore from GitHub"}
                  </button>
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", marginTop: "0.5rem" }}>
                  Restore will reload the page after loading. Your token is stored locally only — never sent anywhere except GitHub.
                </p>
              </div>
            </div>
          )}
          {/* ── MUSIC ── */}
          {activeSection === "music" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div><h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>🎵 Background Music</h2><p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Upload songs from your device. A mini player appears at the bottom-left of every page.</p></div>
              <div style={S.card}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.75rem" }}>📁 Upload Songs</h3>
                <label style={{ display: "block", border: "2px dashed var(--va-border)", borderRadius: "0.5rem", padding: "1.5rem", textAlign: "center", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--va-accent)")} onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--va-border)")}>
                  <p style={{ fontSize: "1.5rem", marginBottom: "0.375rem" }}>🎵</p>
                  <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Click to upload audio files</p>
                  <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>MP3, WAV, OGG, FLAC, M4A supported</p>
                  <input type="file" accept="audio/*" multiple onChange={e => e.target.files && addSongs(e.target.files)} style={{ display: "none" }} />
                </label>
              </div>
              <div style={S.card}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.875rem" }}>⚙️ Playback Settings</h3>
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: "600" }}>🔈 Volume</label>
                    <span style={{ fontSize: "0.875rem", color: "var(--va-accent)", fontWeight: "700" }}>{volume}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--va-accent)", cursor: "pointer" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.875rem", fontWeight: "600", display: "block", marginBottom: "0.5rem" }}>🔁 Loop Mode</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {([ ["loop-all", "🔁 Loop All"], ["loop-one", "🔂 Loop One"], ["play-once", "➡️ Play Once"] ] as const).map(([mode, label]) => (
                      <button key={mode} onClick={() => setLoopMode(mode)}
                        style={{ padding: "0.5rem 0.875rem", borderRadius: "0.5rem", border: `2px solid ${loopMode === mode ? "var(--va-accent)" : "var(--va-border)"}`, background: loopMode === mode ? "rgba(59,130,246,0.1)" : "transparent", color: loopMode === mode ? "var(--va-accent)" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.8rem", fontWeight: loopMode === mode ? "700" : "400" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {songs.length > 0 ? (
                <div style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
                    <h3 style={{ fontWeight: "bold" }}>🎶 Playlist ({songs.length} song{songs.length !== 1 ? "s" : ""})</h3>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={togglePlay} style={S.btn("var(--va-accent)")}>{isPlaying ? "⏸ Pause" : "▶ Play"}</button>
                      <button onClick={clearAll} style={{ ...S.btn("none", "var(--va-text-muted)"), border: "1px solid var(--va-border)" }}>Clear All</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: "300px", overflowY: "auto" }}>
                    {songs.map((song, i) => (
                      <div key={song.id} onClick={() => playSong(i)}
                        style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.75rem", borderRadius: "0.5rem", background: currentIndex === i ? "rgba(59,130,246,0.1)" : "var(--va-bg)", border: `1px solid ${currentIndex === i ? "var(--va-accent)" : "var(--va-border)"}`, cursor: "pointer" }}>
                        <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>{currentIndex === i && isPlaying ? "🔊" : "🎵"}</span>
                        <span style={{ flex: 1, fontSize: "0.8rem", color: currentIndex === i ? "var(--va-accent)" : "var(--va-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: currentIndex === i ? "700" : "400" }}>{i + 1}. {song.name}</span>
                        <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", flexShrink: 0 }}>{(song.size / 1024 / 1024).toFixed(1)}MB</span>
                        <button onClick={e => { e.stopPropagation(); removeSong(song.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.9rem" }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--va-text-muted)" }}>
                  <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎵</p>
                  <p>No songs yet. Upload some above to start your BGM playlist.</p>
                </div>
              )}
            </div>
          )}

          {/* ── DANGER ── */}
          {activeSection === "danger" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div><h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>🚨 Alert Zone</h2><p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Powerful and irreversible actions. Be careful.</p></div>
              <div style={S.card}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>↩️ Undo / Redo</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem", lineHeight: "1.6" }}>Undo or redo your last vault action. Keeps the last 20 states. You can also use <strong>Ctrl+Z</strong> and <strong>Ctrl+Y</strong> anywhere.</p>
                {undoStatus && <p style={{ fontSize: "0.875rem", color: "#4ade80", marginBottom: "0.75rem" }}>{undoStatus}</p>}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => { const prev = undoArchive(); if (prev) { saveArchive(prev); setUndoStatus("✓ Undone"); setTimeout(() => setUndoStatus(""), 2000); } else { setUndoStatus("Nothing to undo"); setTimeout(() => setUndoStatus(""), 2000); } }} style={S.btn("var(--va-border)", "var(--va-text)")}>↩️ Undo</button>
                  <button onClick={() => { const next = redoArchive(); if (next) { saveArchive(next); setUndoStatus("✓ Redone"); setTimeout(() => setUndoStatus(""), 2000); } else { setUndoStatus("Nothing to redo"); setTimeout(() => setUndoStatus(""), 2000); } }} style={S.btn("var(--va-border)", "var(--va-text)")}>↪️ Redo</button>
                </div>
              </div>
              {hasGeminiKey() && (
                <div style={{ ...S.card, border: "1px solid #b45309" }}>
                  <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "#fbbf24" }}>✨ AI Targeted Delete</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem", lineHeight: "1.6" }}>Describe what to delete in plain English. AI finds only matching entries and shows them before deleting anything.</p>
                  <input value={deleteQuery} onChange={e => { setDeleteQuery(e.target.value); setDeleteTargets([]); setDeleteConfirmed(false); }}
                    placeholder='e.g. "everything about Draco Malfoy" or "all quest entries from year 1"'
                    style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.75rem", boxSizing: "border-box" }} />
                  <button onClick={async () => {
                    if (!deleteQuery.trim()) return;
                    setDeletingTargets(true); setDeleteTargets([]); setDeleteConfirmed(false);
                    const archive = loadArchive();
                    const entries = archive.entries.map(e => ({ id: e.id, text: e.text, category: e.category }));
                    const targets = await geminiTargetedDelete(deleteQuery, entries);
                    // Search both subtabs
                    const allEntries = [
                      ...archive.entries.map(e => ({ id: e.id, text: e.text, category: e.category })),
                      ...((archive.playerEntries ?? []).map(e => ({ id: e.id, text: e.text, category: e.category }))),
                    ];
                    const allTargets = await geminiTargetedDelete(deleteQuery, allEntries);
                    setDeleteTargets(allTargets.map(t => ({ ...t, selected: true }))); setDeletingTargets(false);
                  }} disabled={!deleteQuery.trim() || deletingTargets}
                    style={{ ...S.btn("#b45309"), opacity: (!deleteQuery.trim() || deletingTargets) ? 0.5 : 1 }}>
                    {deletingTargets ? "✨ Scanning..." : "✨ Find Entries to Delete"}
                  </button>
                  {deleteTargets.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <p style={{ fontSize: "0.875rem", color: "#fbbf24", fontWeight: "600" }}>Found {deleteTargets.length} matching {deleteTargets.length === 1 ? "entry" : "entries"} — tick to select:</p>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button onClick={() => setDeleteTargets(prev => prev.map(t => ({ ...t, selected: true })))}
                            style={{ fontSize: "0.72rem", background: "none", border: "1px solid #b45309", color: "#fbbf24", borderRadius: "0.25rem", padding: "0.15rem 0.5rem", cursor: "pointer" }}>All</button>
                          <button onClick={() => setDeleteTargets(prev => prev.map(t => ({ ...t, selected: false })))}
                            style={{ fontSize: "0.72rem", background: "none", border: "1px solid var(--va-border)", color: "var(--va-text-muted)", borderRadius: "0.25rem", padding: "0.15rem 0.5rem", cursor: "pointer" }}>None</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.875rem", maxHeight: "250px", overflowY: "auto" }}>
                        {deleteTargets.map((t, i) => (
                          <div key={t.id} onClick={() => setDeleteTargets(prev => prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item))}
                            style={{ background: "var(--va-bg)", border: `1px solid ${(t as any).selected ? "#b91c1c" : "var(--va-border)"}`, borderRadius: "0.375rem", padding: "0.625rem 0.875rem", cursor: "pointer", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                            <div style={{ width: "16px", height: "16px", borderRadius: "3px", border: `2px solid ${(t as any).selected ? "#b91c1c" : "var(--va-text-muted)"}`, background: (t as any).selected ? "#b91c1c" : "transparent", flexShrink: 0, marginTop: "2px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {(t as any).selected && <span style={{ color: "white", fontSize: "0.6rem", fontWeight: "bold" }}>✓</span>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: "0.8rem", color: "var(--va-text)", marginBottom: "0.2rem" }}>{t.text.slice(0, 120)}{t.text.length > 120 ? "..." : ""}</p>
                              <p style={{ fontSize: "0.7rem", color: "#fbbf24" }}>[{t.category}] — {t.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => {
                        const selected = deleteTargets.filter(t => (t as any).selected);
                        if (selected.length === 0) return;
                        const archive = loadArchive(); pushHistory(archive);
                        const ids = new Set(selected.map(t => t.id));
                        // Delete from both canon and player entries
                        const updated = {
                          ...archive,
                          entries: archive.entries.filter(e => !ids.has(e.id)),
                          playerEntries: (archive.playerEntries ?? []).filter(e => !ids.has(e.id)),
                        };
                        saveArchive(regenerateMasterPrompt(updated));
                        setDeleteTargets([]); setDeleteQuery(""); setDeleteConfirmed(true);
                        setTimeout(() => setDeleteConfirmed(false), 3000);
                      }} disabled={!deleteTargets.some(t => (t as any).selected)}
                        style={{ ...S.btn("#b91c1c"), opacity: !deleteTargets.some(t => (t as any).selected) ? 0.4 : 1 }}>
                        🗑️ Delete {deleteTargets.filter(t => (t as any).selected).length} Selected {deleteTargets.filter(t => (t as any).selected).length === 1 ? "Entry" : "Entries"}
                      </button>
                      {deleteConfirmed && <p style={{ fontSize: "0.875rem", color: "#4ade80", marginTop: "0.5rem" }}>✓ Deleted. Use Undo if needed.</p>}
                    </div>
                  )}
                </div>
              )}
              <div style={S.card}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>📤 Export This Vault</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem" }}>Downloads your entire vault as a .json file.</p>
                <button onClick={() => { const id = getActiveVaultId(); if (id) exportVault(id); else alert("No active vault found."); }} style={S.btn("var(--va-accent)")}>📤 Export Vault</button>
              </div>
              {vaultCleared ? (
                <div style={{ background: "rgba(20,83,45,0.3)", border: "1px solid #15803d", borderRadius: "0.75rem", padding: "1.5rem" }}>
                  <p style={{ color: "#4ade80", fontWeight: "600" }}>✓ Vault cleared.</p>
                  <Link href="/inbox" style={{ display: "inline-block", marginTop: "1rem", background: "#15803d", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", fontSize: "0.875rem", textDecoration: "none" }}>Go to Inbox</Link>
                </div>
              ) : (
                <div style={{ background: "rgba(127,29,29,0.2)", border: "1px solid #7f1d1d", borderRadius: "0.75rem", padding: "1.5rem" }}>
                  <h3 style={{ fontWeight: "bold", color: "#fca5a5", marginBottom: "0.5rem" }}>🗑 Clear Entire Vault</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem" }}>Permanently deletes all vault entries. Cannot be undone.</p>
                  <button onClick={handleClearVault} style={S.btn("#b91c1c")}>Clear Vault</button>
                </div>
              )}
              <div style={S.card}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>🔄 Reset All Settings</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem" }}>Resets theme to defaults. Does not affect vault data.</p>
                <button onClick={handleResetTheme} style={S.btn("var(--va-border)", "var(--va-text)")}>Reset Settings</button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
