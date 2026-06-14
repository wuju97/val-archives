"use client";

import Link from "next/link";
import { useMusic } from "../MusicPlayer";
import { useEffect, useState } from "react";
import { clearArchive, exportVault, getActiveVaultId, loadArchive, regenerateMasterPrompt, saveArchive, pushHistory, undoArchive, redoArchive } from "@/lib/archiveEngine";
import {
  getGeminiKey, setGeminiKey, clearGeminiKey, testGeminiConnection, hasGeminiKey,
  getGeminiQualityKey, setGeminiQualityKey, clearGeminiQualityKey, testGeminiQualityConnection, hasGeminiQualityKey,
  getDeepSeekKey, setDeepSeekKey, clearDeepSeekKey, testDeepSeekConnection, hasDeepSeekKey,
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
  brightness: number;
  accentColor: string;
  bgPreset: string;
  bgColor: string;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  tabColor: string;
  tabEmoji: string;
};

const DEFAULT_THEME: ThemeSettings = {
  brightness: 0,
  accentColor: "#3b82f6",
  bgPreset: "Void Black",
  bgColor: "#080808",
  surfaceColor: "#111827",
  borderColor: "#1f2937",
  textColor: "#f9fafb",
  mutedColor: "#6b7280",
  tabColor: "#1f2937",
  tabEmoji: "📖",
};

function loadTheme(): ThemeSettings {
  try {
    const saved = localStorage.getItem("valArchivesTheme");
    if (saved) return { ...DEFAULT_THEME, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_THEME };
}

function applyTheme(theme: ThemeSettings) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("va-theme-update"));
  const root = document.documentElement;
  if (theme.brightness > 0) {
    const t = theme.brightness / 100;
    function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }
    function hexToRgb(hex: string): [number, number, number] {
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
    }
    function interp(h1: string, h2: string, t: number) {
      const c1 = hexToRgb(h1), c2 = hexToRgb(h2);
      return `rgb(${lerp(c1[0],c2[0],t)},${lerp(c1[1],c2[1],t)},${lerp(c1[2],c2[2],t)})`;
    }
    root.style.setProperty("--va-bg",         interp(theme.bgColor,      "#e5e7eb", t));
    root.style.setProperty("--va-surface",    interp(theme.surfaceColor,  "#f3f4f6", t));
    root.style.setProperty("--va-border",     interp(theme.borderColor,   "#d1d5db", t));
    root.style.setProperty("--va-text",       interp(theme.textColor,     "#111827", t));
    root.style.setProperty("--va-text-muted", interp(theme.mutedColor,    "#4b5563", t));
  } else {
    root.style.setProperty("--va-bg",         theme.bgColor);
    root.style.setProperty("--va-surface",    theme.surfaceColor);
    root.style.setProperty("--va-border",     theme.borderColor);
    root.style.setProperty("--va-text",       theme.textColor);
    root.style.setProperty("--va-text-muted", theme.mutedColor);
  }
  root.style.setProperty("--va-accent", theme.accentColor);
}

const INSTRUCTIONS = [
  { title: "📥 Inbox", description: "Main entry point. Paste anything — characters, lore, rules, session notes, relationships. Val Archives scores every category simultaneously and routes each sentence to its best-fit category. After clicking Analyze, use ✨ AI Smart Review (purple button) for AI to review and suggest better categories as a second pass — accept or reject each suggestion individually. The 💾 Save Prompt button generates a session extraction prompt; click ✨ AI Personalize to generate a version tailored to your specific characters and story." },
  { title: "👑 Master Prompt", description: "Automatically compiled from your vault in priority order. Rules first, then red priority (top + bottom), then blue priority, then everything else. Click ✨ AI Refine to improve clarity and coherence while keeping all your facts intact. Copy and paste into any AI to give it complete knowledge of your world." },
  { title: "🕰 Custom Prompt", description: "Write global instructions applied to every prompt — tone, style, things the AI should always or never do. Click ✨ AI Enhance to improve your instructions based on your archive context. Combined with Master Prompt and Forge output to create the Final Prompt." },
  { title: "⚒ Prompt Forge", description: "Build specialized prompts for specific goals. Describe what you want, click Analyze Goal to auto-select categories, then Forge Prompt. Click ✨ AI Refine to improve the output. Send to Final Prompt to combine with Custom Prompt and Master Prompt." },
  { title: "📋 Rule Book", description: "All rules live here — world laws, game mechanics, GM rules. Rules feed into Master Prompt first before any other content. Any rule detected in the Inbox is auto-routed here. Type a rule and click ✨ to have AI make it clearer and more precise before adding." },
  { title: "📖 Story", description: "All 27+ world-building categories in a tile grid. Each category has a subcategory sidebar. Priority dots on every tile — click once for blue (2nd priority), again for red (1st priority), again to remove. Click any tile to open that category and add entries with optional subcategory tagging." },
  { title: "🏛 Canon Archives", description: "Source library with 4 built-in categories: PDF Files, Text Files, Copy & Paste, and Timeline Events. Create custom categories too. Timeline Events are stored whole and appear verbatim in the Master Prompt — never split. Click ✨ Extract to Vault to have AI read any canon file and extract characters, locations, relationships and more directly into Story Studio." },
  { title: "⏳ Timeline Save", description: "Store complete session saves intact — no splitting. Paste the AI response to your Save Prompt here and name it. Click + Branch to create an alternate timeline from any save point. The green button on any save or branch makes it the active timeline — only one active at a time. The active timeline feeds into Master Prompt word-for-word." },
  { title: "🌀 Pensieve", description: "Searchable vault of all entries. Filter by category (shows all categories with entry counts), search by keyword, sort by newest or oldest. Edit or delete any entry inline. Every change updates the Master Prompt automatically." },
  { title: "👤 Character Dashboard", description: "Add up to 5 character panels on the dashboard. Click + Add Character and type any name — Val Archives automatically searches all vault entries mentioning that name and extracts traits, goals, achievements, allies, and rivals. Each character gets their own color. Click ✨ AI to have AI analyze all matching entries and produce a refined character summary." },
  { title: "🔴🔵 Priority System", description: "Click the dot next to Story, Canon, or any category tile. Once = blue (2nd priority, multiple allowed). Twice = red (1st priority, only one at a time). Three times = off. Red content appears at the TOP of the Master Prompt with a strong instruction, repeated at the bottom. Blue is emphasized in the middle. Rules always come first." },
  { title: "✨ AI — Groq", description: "Connect Groq AI in Settings → AI tab. Your key stays in your browser only — never shared. Get a free key at console.groq.com — no daily limits, just per-minute rate limiting. Once connected: Inbox gets smart category review, Master Prompt gets refinement, Rule Book enhances rules, Prompt Forge refines output, Canon Archives extracts facts to vault, and you can chat with your full archive." },
  { title: "🗄️ Vault Switcher", description: "Create multiple isolated vaults — one per game or project. Switch at the /vaults page. Export any vault as a .json file to back up or move to another browser. Import to restore exactly." },
  { title: "🌐 Website & PC App", description: "Val Archives is live at val-archives.vercel.app — share this link with anyone. No login needed, no VS Code, works in any browser on any device. Each person's data stays in their own browser. For a desktop experience, download the PC app from the Download button at the bottom of the dashboard." },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [activeSection, setActiveSection] = useState<"display" | "personalisation" | "instructions" | "ai" | "danger" | "music">("display");
  const { songs, currentIndex, isPlaying, volume, loopMode, addSongs, removeSong, playSong, togglePlay, setVolume, setLoopMode, clearAll } = useMusic();
  const [saved, setSaved] = useState(false);
  const [vaultCleared, setVaultCleared] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [qualityApiKey, setQualityApiKey] = useState("");
  const [testingQualityApi, setTestingQualityApi] = useState(false);
  const [qualityApiStatus, setQualityApiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [deepSeekKey, setDeepSeekKeyState] = useState("");
  const [testingDeepSeek, setTestingDeepSeek] = useState(false);
  const [deepSeekStatus, setDeepSeekStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [aiMode, setAiMode] = useState<"simple" | "advanced">("simple");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [deleteQuery, setDeleteQuery] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<Array<{ id: string; text: string; category: string; reason: string }>>([]);
  const [deletingTargets, setDeletingTargets] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [undoStatus, setUndoStatus] = useState("");

  useEffect(() => {
    const loaded = loadTheme();
    setTheme(loaded);
    applyTheme(loaded);
    const savedKey = getGeminiKey();
    if (savedKey) setApiKey(savedKey);
    const savedQualityKey = getGeminiQualityKey();
    if (savedQualityKey) setQualityApiKey(savedQualityKey);
    const savedDSKey = getDeepSeekKey();
    if (savedDSKey) setDeepSeekKeyState(savedDSKey);
  }, []);

  function updateTheme(updates: Partial<ThemeSettings>) {
    const updated = { ...theme, ...updates };
    setTheme(updated);
    applyTheme(updated);
    localStorage.setItem("valArchivesTheme", JSON.stringify(updated));
  }

  function applyBgPreset(preset: typeof BG_PRESETS[0]) {
    updateTheme({ bgPreset: preset.name, bgColor: preset.bg, surfaceColor: preset.surface, borderColor: preset.border, textColor: preset.text, mutedColor: preset.muted, brightness: 0 });
  }

  function handleSave() {
    localStorage.setItem("valArchivesTheme", JSON.stringify(theme));
    applyTheme(theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleResetTheme() {
    setTheme(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    localStorage.setItem("valArchivesTheme", JSON.stringify(DEFAULT_THEME));
  }

  function handleClearVault() {
    if (!confirm("⚠️ Permanently delete your entire vault? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Everything will be deleted.")) return;
    clearArchive();
    setVaultCleared(true);
  }

  const sections = [
    { id: "display",         label: "🌙 Display" },
    { id: "personalisation", label: "🎨 Personalisation" },
    { id: "instructions",    label: "📖 Instructions" },
    { id: "ai",              label: "✨ AI" },
    { id: "music",           label: "🎵 Music / BGM" },
    { id: "danger",          label: "🚨 Alert Zone" },
  ] as const;

  async function handleSendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput(""); setChatError("");
    const userMsg = { role: "user" as const, text: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const archive = loadArchive();
      const withPrompt = regenerateMasterPrompt(archive);
      const history = chatMessages.map(m => ({ role: m.role, text: m.text }));
      const response = await geminiChat(msg, withPrompt.masterPrompt, history);
      setChatMessages(prev => [...prev, { role: "model", text: response }]);
    } catch (err) {
      setChatError(geminiErrorMessage(err));
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)" }}>

      {/* Header */}
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

        {/* Left nav */}
        <aside style={{ width: "13rem", borderRight: "1px solid var(--va-border)", padding: "1rem", minHeight: "100vh", background: "var(--va-surface)" }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {sections.map((s) => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                style={{ width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontSize: "0.875rem", background: activeSection === s.id ? "var(--va-border)" : "transparent", color: activeSection === s.id ? "var(--va-text)" : "var(--va-text-muted)", transition: "background 0.15s" }}>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <main style={{ flex: 1, padding: "2rem", maxWidth: (activeSection === "instructions" || activeSection === "danger") ? "100%" : "42rem" }}>

          {/* ── Display ── */}
          {activeSection === "display" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Display</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Fine-tune brightness. Changes apply instantly — save to keep.</p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>
                  Brightness <span style={{ color: "var(--va-text-muted)", fontWeight: "normal" }}>{theme.brightness}%</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Dark</span>
                  <input type="range" min="0" max="100" value={theme.brightness} onChange={(e) => updateTheme({ brightness: Number(e.target.value) })} style={{ flex: 1, accentColor: "var(--va-accent)" }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Light</span>
                </div>
              </div>
              <button onClick={handleResetTheme} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", textAlign: "left" }}>Reset to defaults</button>
            </div>
          )}

          {/* ── Personalisation ── */}
          {activeSection === "personalisation" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Personalisation</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Customize the entire website appearance.</p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>Website Theme</label>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.75rem" }}>Changes the entire website background, surfaces, and text colors.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginBottom: "1rem" }}>
                  {BG_PRESETS.map((preset) => (
                    <button key={preset.name} onClick={() => applyBgPreset(preset)}
                      style={{ background: preset.bg, border: theme.bgPreset === preset.name ? `2px solid ${theme.accentColor}` : `1px solid ${preset.border}`, borderRadius: "0.5rem", padding: "0.75rem 0.5rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                      <div style={{ width: "100%", height: "0.5rem", borderRadius: "9999px", background: preset.surface }} />
                      <span style={{ fontSize: "0.625rem", color: preset.text, whiteSpace: "nowrap" }}>{preset.name}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Custom bg:</label>
                  <input type="color" value={theme.bgColor} onChange={(e) => updateTheme({ bgColor: e.target.value, bgPreset: "Custom" })} style={{ width: "2.5rem", height: "2rem", borderRadius: "0.25rem", border: "1px solid var(--va-border)", background: "transparent", cursor: "pointer" }} />
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--va-text-muted)" }}>{theme.bgColor}</span>
                </div>
              </div>
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Live Preview</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                  <div style={{ height: "0.75rem", borderRadius: "9999px", width: "75%", background: "var(--va-border)" }} />
                  <div style={{ height: "0.75rem", borderRadius: "9999px", width: "50%", background: "var(--va-border)" }} />
                  <div style={{ height: "0.75rem", borderRadius: "9999px", width: "33%", background: "var(--va-accent)" }} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ padding: "0.375rem 0.75rem", borderRadius: "0.375rem", background: "var(--va-accent)", color: "white", fontSize: "0.75rem", fontWeight: "600" }}>Button</div>
                  <div style={{ padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--va-border)", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>Secondary</div>
                  <div style={{ padding: "0.375rem 0.75rem", borderRadius: "0.375rem", background: "var(--va-bg)", border: "1px solid var(--va-border)", color: "var(--va-text)", fontSize: "0.75rem" }}>Surface</div>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Accent Color</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  {ACCENT_COLORS.map((color) => (
                    <button key={color.value} onClick={() => updateTheme({ accentColor: color.value })} title={color.name}
                      style={{ width: "2.25rem", height: "2.25rem", borderRadius: "9999px", background: color.value, border: "none", cursor: "pointer", outline: theme.accentColor === color.value ? "3px solid white" : "none", outlineOffset: "2px", transform: theme.accentColor === color.value ? "scale(1.15)" : "scale(1)", transition: "transform 0.15s" }} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Custom:</label>
                  <input type="color" value={theme.accentColor} onChange={(e) => updateTheme({ accentColor: e.target.value })} style={{ width: "2.5rem", height: "2rem", borderRadius: "0.25rem", border: "1px solid var(--va-border)", background: "transparent", cursor: "pointer" }} />
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--va-text-muted)" }}>{theme.accentColor}</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>Default Tab Emoji</label>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.75rem" }}>Used when creating custom tabs</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {TAB_EMOJIS.map((emoji) => (
                    <button key={emoji} onClick={() => updateTheme({ tabEmoji: emoji })}
                      style={{ width: "2.5rem", height: "2.5rem", fontSize: "1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", background: theme.tabEmoji === emoji ? "var(--va-border)" : "var(--va-surface)", outline: theme.tabEmoji === emoji ? "1px solid var(--va-accent)" : "none" }}>
                      {emoji}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "0.875rem", marginTop: "0.75rem", color: "var(--va-text-muted)" }}>Selected: <span style={{ fontSize: "1.5rem" }}>{theme.tabEmoji}</span></p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.5rem" }}>Import Custom Icon</label>
                <label style={{ cursor: "pointer", display: "block" }}>
                  <div style={{ border: "1px dashed var(--va-border)", borderRadius: "0.5rem", padding: "1.5rem", textAlign: "center" }}>
                    <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Click to upload PNG, JPG, or SVG</p>
                  </div>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => updateTheme({ tabEmoji: ev.target?.result as string }); reader.readAsDataURL(file); }} />
                </label>
              </div>
            </div>
          )}

          {/* ── Instructions ── */}
          {activeSection === "instructions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: "100%" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Instructions</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Everything Val Archives can do, explained.</p>
              </div>
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <p style={{ fontSize: "0.875rem", lineHeight: "1.6", color: "var(--va-text)" }}>
                  <strong>Val Archives</strong> is a Prompt Operating System. Feed it information about your world, story, or RPG campaign. It organizes everything automatically, maintains continuity, and generates powerful prompts you can use with any AI.
                </p>
              </div>
              {INSTRUCTIONS.map((item) => (
                <div key={item.title} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem", width: "100%" }}>
                  <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "var(--va-text)" }}>{item.title}</h3>
                  <p style={{ fontSize: "0.875rem", lineHeight: "1.6", color: "var(--va-text-muted)", whiteSpace: "pre-line" }}>{item.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── AI (Groq) ── */}
          {activeSection === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>✨ AI Setup</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Two AI engines — Cerebras for speed, Gemini for quality. Both free. Both stay in your browser only.</p>
              </div>

              {/* Cerebras Key */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>⚡ Cerebras API Key</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", marginBottom: "0.875rem" }}>
                  For: Inbox, Extract to Vault, Search, Classification, and all fast tasks.<br />
                  Get free key at <strong>cloud.cerebras.ai</strong> → API Keys → Create API key.<br />
                  <span style={{ color: "#4ade80" }}>✓ 1M tokens/day free — no daily request cap.</span>
                </p>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.625rem" }}>
                  <input type={apiKeyVisible ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="csk_..."
                    style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", fontFamily: "monospace" }} />
                  <button onClick={() => setApiKeyVisible(!apiKeyVisible)}
                    style={{ background: "var(--va-border)", border: "none", borderRadius: "0.375rem", padding: "0 0.875rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.8rem" }}>
                    {apiKeyVisible ? "Hide" : "Show"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button onClick={() => { if (apiKey.trim()) { setGeminiKey(apiKey.trim()); setApiStatus({ ok: true, message: "Cerebras key saved" }); setTimeout(() => setApiStatus(null), 2000); } }} disabled={!apiKey.trim()}
                    style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !apiKey.trim() ? 0.4 : 1 }}>
                    Save Key
                  </button>
                  <button onClick={async () => { setTestingApi(true); setApiStatus(null); if (apiKey.trim()) setGeminiKey(apiKey.trim()); const result = await testGeminiConnection(); setApiStatus(result); setTestingApi(false); }} disabled={!apiKey.trim() || testingApi}
                    style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem", opacity: (!apiKey.trim() || testingApi) ? 0.4 : 1 }}>
                    {testingApi ? "Testing..." : "Test Connection"}
                  </button>
                  <button onClick={() => { clearGeminiKey(); setApiKey(""); setApiStatus({ ok: false, message: "Key removed" }); setTimeout(() => setApiStatus(null), 2000); }}
                    style={{ background: "none", border: "1px solid var(--va-border)", color: "var(--va-text-muted)", padding: "0.5rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem" }}>
                    Remove Key
                  </button>
                </div>
                {apiStatus && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: apiStatus.ok ? "#4ade80" : "#f87171" }}>
                    {apiStatus.ok ? "✓" : "✗"} {apiStatus.message}
                  </p>
                )}
              </div>

              {/* Gemini Quality Key */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>✨ Gemini API Key <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", fontWeight: "normal" }}>optional</span></h3>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", marginBottom: "0.875rem" }}>
                  For: Master Prompt refine, Custom Prompt enhance, Prompt Forge refine, Chat.<br />
                  Get free key at <strong>aistudio.google.com</strong> → Get API key → Create API key.<br />
                  <span style={{ color: "#fbbf24" }}>If not set, Cerebras handles these tasks instead.</span>
                </p>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.625rem" }}>
                  <input type="password" value={qualityApiKey} onChange={(e) => setQualityApiKey(e.target.value)} placeholder="AIzaSy..."
                    style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", fontFamily: "monospace" }} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button onClick={() => { if (qualityApiKey.trim()) { setGeminiQualityKey(qualityApiKey.trim()); setQualityApiStatus({ ok: true, message: "Gemini key saved" }); setTimeout(() => setQualityApiStatus(null), 2000); } }} disabled={!qualityApiKey.trim()}
                    style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !qualityApiKey.trim() ? 0.4 : 1 }}>
                    Save Key
                  </button>
                  <button onClick={async () => { setTestingQualityApi(true); setQualityApiStatus(null); if (qualityApiKey.trim()) setGeminiQualityKey(qualityApiKey.trim()); const result = await testGeminiQualityConnection(); setQualityApiStatus(result); setTestingQualityApi(false); }} disabled={!qualityApiKey.trim() || testingQualityApi}
                    style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem", opacity: (!qualityApiKey.trim() || testingQualityApi) ? 0.4 : 1 }}>
                    {testingQualityApi ? "Testing..." : "Test Connection"}
                  </button>
                  <button onClick={() => { clearGeminiQualityKey(); setQualityApiKey(""); setQualityApiStatus({ ok: false, message: "Key removed" }); setTimeout(() => setQualityApiStatus(null), 2000); }}
                    style={{ background: "none", border: "1px solid var(--va-border)", color: "var(--va-text-muted)", padding: "0.5rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem" }}>
                    Remove Key
                  </button>
                </div>
                {qualityApiStatus && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: qualityApiStatus.ok ? "#4ade80" : "#f87171" }}>
                    {qualityApiStatus.ok ? "✓" : "✗"} {qualityApiStatus.message}
                  </p>
                )}
              </div>

              {/* What Groq does */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.75rem" }}>⚡ What Each AI Does</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--va-accent)", marginBottom: "0.5rem" }}>⚡ Cerebras (fast)</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8rem", color: "var(--va-text-muted)", marginBottom: "0.75rem" }}>
                  {[
                    ["📥 Inbox", "AI classification and Smart Review"],
                    ["🏛 Canon Archives", "✨ Extract to Vault — reads files and fills Story Studio"],
                    ["🌀 Pensieve", "AI semantic search across your vault"],
                    ["📋 Rule Book", "✨ Organize and enhance rules"],
                    ["🗑️ Alert Zone", "AI Targeted Delete"],
                  ].map(([feature, desc]) => (
                    <div key={feature} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0, width: "120px", color: "var(--va-text)", fontWeight: "600" }}>{feature}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "0.75rem", color: "#c4b5fd", marginBottom: "0.5rem" }}>✨ Gemini (quality)</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8rem", color: "var(--va-text-muted)" }}>
                  {[
                    ["👑 Master Prompt", "✨ Refine for clarity and coherence"],
                    ["🕰 Custom Prompt", "✨ Enhance global instructions"],
                    ["⚒ Prompt Forge", "✨ Refine the forged output"],
                    ["📖 Story entries", "✨ Enhance any entry with more detail"],
                    ["💬 Chat below", "Talk to AI with your full archive as context"],
                  ].map(([feature, desc]) => (
                    <div key={feature} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0, width: "120px", color: "var(--va-text)", fontWeight: "600" }}>{feature}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>💬 Chat with Your Archive</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", marginBottom: "0.875rem" }}>
                  AI has full context of your archive. Ask anything — continue the story, analyze characters, plan quests, brainstorm ideas.
                </p>
                <div style={{ height: "320px", overflowY: "auto", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.875rem", marginBottom: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {chatMessages.length === 0 ? (
                    <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "4rem" }}>
                      {getGeminiKey() ? "Ask anything about your archive..." : "Add your Cerebras key above to start chatting. Add Gemini key for smarter responses."}
                    </p>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "80%", padding: "0.625rem 0.875rem", borderRadius: msg.role === "user" ? "0.75rem 0.75rem 0.125rem 0.75rem" : "0.75rem 0.75rem 0.75rem 0.125rem", background: msg.role === "user" ? "var(--va-accent)" : "var(--va-border)", color: "var(--va-text)", fontSize: "0.875rem", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ background: "var(--va-border)", padding: "0.625rem 0.875rem", borderRadius: "0.75rem", color: "var(--va-text-muted)", fontSize: "0.875rem" }}>✨ Thinking...</div>
                    </div>
                  )}
                </div>
                {chatError && <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{chatError}</p>}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                    placeholder="Ask anything... (Enter to send)" disabled={chatLoading}
                    style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", opacity: chatLoading ? 0.6 : 1 }} />
                  <button onClick={handleSendChat} disabled={!chatInput.trim() || chatLoading}
                    style={{ background: "var(--va-accent)", color: "white", padding: "0.625rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: (!chatInput.trim() || chatLoading) ? 0.4 : 1 }}>
                    Send
                  </button>
                  <button onClick={() => setChatMessages([])}
                    style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.625rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Alert Zone ── */}
          {activeSection === "danger" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>🚨 Alert Zone</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Powerful and irreversible actions. Be careful.</p>
              </div>

              {/* Undo / Redo */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem", width: "100%" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>↩️ Undo / Redo</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem", lineHeight: "1.6" }}>
                  Undo or redo your last vault action. Keeps the last 20 states. You can also use <strong>Ctrl+Z</strong> and <strong>Ctrl+Y</strong> anywhere on the site.
                </p>
                {undoStatus && <p style={{ fontSize: "0.875rem", color: "#4ade80", marginBottom: "0.75rem" }}>{undoStatus}</p>}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => { const prev = undoArchive(); if (prev) { saveArchive(prev); setUndoStatus("✓ Undone"); setTimeout(() => setUndoStatus(""), 2000); } else { setUndoStatus("Nothing to undo"); setTimeout(() => setUndoStatus(""), 2000); } }}
                    style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>↩️ Undo</button>
                  <button onClick={() => { const next = redoArchive(); if (next) { saveArchive(next); setUndoStatus("✓ Redone"); setTimeout(() => setUndoStatus(""), 2000); } else { setUndoStatus("Nothing to redo"); setTimeout(() => setUndoStatus(""), 2000); } }}
                    style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>↪️ Redo</button>
                </div>
              </div>

              {/* AI Targeted Delete */}
              {hasGeminiKey() && (
                <div style={{ background: "var(--va-surface)", border: "1px solid #b45309", borderRadius: "0.75rem", padding: "1.25rem", width: "100%" }}>
                  <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "#fbbf24" }}>✨ AI Targeted Delete</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem", lineHeight: "1.6" }}>
                    Describe what you want to delete in plain English. AI will find only the relevant entries and show them to you before deleting anything.
                  </p>
                  <input value={deleteQuery} onChange={e => { setDeleteQuery(e.target.value); setDeleteTargets([]); setDeleteConfirmed(false); }}
                    placeholder='e.g. "everything about Draco Malfoy" or "all quest entries"'
                    style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", marginBottom: "0.75rem", boxSizing: "border-box" }} />
                  <button onClick={async () => {
                    if (!deleteQuery.trim()) return;
                    setDeletingTargets(true); setDeleteTargets([]); setDeleteConfirmed(false);
                    const archive = loadArchive();
                    const entries = archive.entries.map(e => ({ id: e.id, text: e.text, category: e.category }));
                    const targets = await geminiTargetedDelete(deleteQuery, entries);
                    setDeleteTargets(targets); setDeletingTargets(false);
                  }} disabled={!deleteQuery.trim() || deletingTargets}
                    style={{ background: "#b45309", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: (!deleteQuery.trim() || deletingTargets) ? 0.5 : 1 }}>
                    {deletingTargets ? "✨ Scanning..." : "✨ Find Entries to Delete"}
                  </button>
                  {deleteTargets.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                      <p style={{ fontSize: "0.875rem", color: "#fbbf24", marginBottom: "0.5rem", fontWeight: "600" }}>Found {deleteTargets.length} matching {deleteTargets.length === 1 ? "entry" : "entries"}:</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.875rem", maxHeight: "200px", overflowY: "auto" }}>
                        {deleteTargets.map(t => (
                          <div key={t.id} style={{ background: "var(--va-bg)", border: "1px solid #b45309", borderRadius: "0.375rem", padding: "0.625rem 0.875rem" }}>
                            <p style={{ fontSize: "0.8rem", color: "var(--va-text)", marginBottom: "0.25rem" }}>{t.text.slice(0, 100)}{t.text.length > 100 ? "..." : ""}</p>
                            <p style={{ fontSize: "0.7rem", color: "#fbbf24" }}>[{t.category}] — {t.reason}</p>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => {
                        const archive = loadArchive();
                        pushHistory(archive);
                        const ids = new Set(deleteTargets.map(t => t.id));
                        const updated = { ...archive, entries: archive.entries.filter(e => !ids.has(e.id)) };
                        const refreshed = regenerateMasterPrompt(updated);
                        saveArchive(refreshed);
                        setDeleteTargets([]); setDeleteQuery(""); setDeleteConfirmed(true);
                        setTimeout(() => setDeleteConfirmed(false), 3000);
                      }} style={{ background: "#b91c1c", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.875rem" }}>
                        🗑️ Delete These {deleteTargets.length} {deleteTargets.length === 1 ? "Entry" : "Entries"}
                      </button>
                      {deleteConfirmed && <p style={{ fontSize: "0.875rem", color: "#4ade80", marginTop: "0.5rem" }}>✓ Deleted. Use Undo if needed.</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Export Vault */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>📤 Export This Vault</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem", lineHeight: "1.6" }}>Downloads your entire vault as a .json file — all entries, saves, canon files, rules, prompts, everything intact.</p>
                <button onClick={() => { const id = getActiveVaultId(); if (id) exportVault(id); else alert("No active vault found."); }}
                  style={{ background: "var(--va-accent)", color: "white", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
                  📤 Export Vault
                </button>
              </div>

              {vaultCleared ? (
                <div style={{ background: "rgba(20,83,45,0.3)", border: "1px solid #15803d", borderRadius: "0.75rem", padding: "1.5rem" }}>
                  <p style={{ color: "#4ade80", fontWeight: "600" }}>✓ Vault cleared.</p>
                  <Link href="/inbox" style={{ display: "inline-block", marginTop: "1rem", background: "#15803d", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", fontSize: "0.875rem", textDecoration: "none" }}>Go to Inbox</Link>
                </div>
              ) : (
                <div style={{ background: "rgba(127,29,29,0.2)", border: "1px solid #7f1d1d", borderRadius: "0.75rem", padding: "1.5rem" }}>
                  <h3 style={{ fontWeight: "bold", color: "#fca5a5", marginBottom: "0.5rem" }}>🗑 Clear Entire Vault</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem", lineHeight: "1.6" }}>Permanently deletes all vault entries. Cannot be undone. Settings are preserved.</p>
                  <button onClick={handleClearVault} style={{ background: "#b91c1c", color: "white", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Clear Vault</button>
                </div>
              )}

              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>🔄 Reset All Settings</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem" }}>Resets theme and display settings to defaults. Does not affect vault data.</p>
                <button onClick={handleResetTheme} style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Reset Settings</button>
              </div>
            </div>
          )}


              {/* ── MUSIC / BGM ──────────────────────────────────────────────── */}
              {activeSection === "music" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>🎵 Background Music</h2>
                    <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Upload songs from your device. They play while you use the site. A mini player appears at the bottom-left of every page.</p>
                  </div>

                  <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                    <h3 style={{ fontWeight: "bold", marginBottom: "0.75rem" }}>📁 Upload Songs</h3>
                    <label style={{ display: "block", border: "2px dashed var(--va-border)", borderRadius: "0.5rem", padding: "1.5rem", textAlign: "center", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--va-accent)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--va-border)")}>
                      <p style={{ fontSize: "1.5rem", marginBottom: "0.375rem" }}>🎵</p>
                      <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", marginBottom: "0.25rem" }}>Click to upload audio files</p>
                      <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>MP3, WAV, OGG, FLAC, M4A supported</p>
                      <input type="file" accept="audio/*" multiple onChange={e => e.target.files && addSongs(e.target.files)} style={{ display: "none" }} />
                    </label>
                  </div>

                  <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                    <h3 style={{ fontWeight: "bold", marginBottom: "0.875rem" }}>⚙️ Playback Settings</h3>
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                        <label style={{ fontSize: "0.875rem", fontWeight: "600" }}>🔈 Volume</label>
                        <span style={{ fontSize: "0.875rem", color: "var(--va-accent)", fontWeight: "700" }}>{volume}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--va-accent)", cursor: "pointer" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.875rem", fontWeight: "600", display: "block", marginBottom: "0.5rem" }}>🔁 Loop Mode</label>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                    <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
                        <h3 style={{ fontWeight: "bold" }}>🎶 Playlist ({songs.length} song{songs.length !== 1 ? "s" : ""})</h3>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button onClick={togglePlay} style={{ background: "var(--va-accent)", color: "white", border: "none", borderRadius: "0.375rem", padding: "0.375rem 0.875rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600" }}>
                            {isPlaying ? "⏸ Pause" : "▶ Play"}
                          </button>
                          <button onClick={clearAll} style={{ background: "none", border: "1px solid var(--va-border)", color: "var(--va-text-muted)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer", fontSize: "0.8rem" }}>
                            Clear All
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: "300px", overflowY: "auto" }}>
                        {songs.map((song, i) => (
                          <div key={song.id} onClick={() => playSong(i)}
                            style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.75rem", borderRadius: "0.5rem", background: currentIndex === i ? "rgba(59,130,246,0.1)" : "var(--va-bg)", border: `1px solid ${currentIndex === i ? "var(--va-accent)" : "var(--va-border)"}`, cursor: "pointer" }}>
                            <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>{currentIndex === i && isPlaying ? "🔊" : "🎵"}</span>
                            <span style={{ flex: 1, fontSize: "0.8rem", color: currentIndex === i ? "var(--va-accent)" : "var(--va-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: currentIndex === i ? "700" : "400" }}>
                              {i + 1}. {song.name}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", flexShrink: 0 }}>{(song.size / 1024 / 1024).toFixed(1)}MB</span>
                            <button onClick={e => { e.stopPropagation(); removeSong(song.id); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.9rem", flexShrink: 0 }}>×</button>
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
        </main>
      </div>
    </div>
  );
}