 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearArchive, exportVault, getActiveVaultId, loadArchive, regenerateMasterPrompt } from "@/lib/archiveEngine";
import {
  getGeminiKey, setGeminiKey, clearGeminiKey, testGeminiConnection,
  geminiChat, geminiErrorMessage,
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

// Full website background presets
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

  // If brightness is non-zero, use brightness interpolation
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
  {
    title: "📥 Inbox",
    description: "Main entry point. Paste anything — characters, lore, rules, session notes, relationships. Val Archives scores every category simultaneously and routes each sentence to its best-fit category. After clicking Analyze, use ✨ AI Smart Review (purple button) for Gemini to review and suggest better categories as a second pass — accept or reject each suggestion individually. The 💾 Save Prompt button generates a session extraction prompt; click ✨ AI Personalize to generate a version tailored to your specific characters and story.",
  },
  {
    title: "👑 Master Prompt",
    description: "Automatically compiled from your vault in priority order. Rules first, then red priority (top + bottom), then blue priority, then everything else. Click ✨ AI Refine to have Gemini improve clarity and coherence while keeping all your facts intact. Copy and paste into any AI to give it complete knowledge of your world.",
  },
  {
    title: "🕰 Custom Prompt",
    description: "Write global instructions applied to every prompt — tone, style, things the AI should always or never do. Click ✨ AI Enhance to have Gemini improve your instructions based on your archive context. Combined with Master Prompt and Forge output to create the Final Prompt.",
  },
  {
    title: "⚒ Prompt Forge",
    description: "Build specialized prompts for specific goals. Describe what you want, click Analyze Goal to auto-select categories, then Forge Prompt. Click ✨ AI Refine to improve the output. Send to Final Prompt to combine with Custom Prompt and Master Prompt.",
  },
  {
    title: "📋 Rule Book",
    description: "All rules live here — world laws, game mechanics, GM rules. Rules feed into Master Prompt first before any other content. Any rule detected in the Inbox is auto-routed here. Type a rule and click ✨ to have Gemini make it clearer and more precise before adding.",
  },
  {
    title: "📖 Story",
    description: "All 27+ world-building categories in a tile grid. Each category has a subcategory sidebar. Priority dots on every tile — click once for blue (2nd priority), again for red (1st priority), again to remove. Click any tile to open that category and add entries with optional subcategory tagging.",
  },
  {
    title: "🏛 Canon Archives",
    description: "Source library with 4 built-in categories: PDF Files, Text Files, Copy & Paste, and Timeline Events. Create custom categories too. Timeline Events are stored whole and appear verbatim in the Master Prompt — never split. Each category has a priority dot. All canon content is tagged as a source in the Master Prompt.",
  },
  {
    title: "⏳ Timeline Save",
    description: "Store complete session saves intact — no splitting. Paste the AI response to your Save Prompt here and name it. Click + Branch to create an alternate timeline from any save point. The green button on any save or branch makes it the active timeline — only one active at a time. The active timeline feeds into Master Prompt word-for-word.",
  },
  {
    title: "🌀 Pensieve",
    description: "Searchable vault of all entries. Filter by category (shows all categories with entry counts), search by keyword, sort by newest or oldest. Edit or delete any entry inline. Every change updates the Master Prompt automatically.",
  },
  {
    title: "👤 Character Dashboard",
    description: "Add up to 5 character panels on the dashboard. Click + Add Character and type any name — Val Archives automatically searches all vault entries mentioning that name and extracts traits, goals, achievements, allies, and rivals. Each character gets their own color. Click ✨ AI to have Gemini analyze all matching entries and produce a refined character summary. Click any character name to rename it. Panels persist across sessions.",
  },
  {
    title: "🔴🔵 Priority System",
    description: "Click the dot next to Story, Canon, or any category tile. Once = blue (2nd priority, multiple allowed). Twice = red (1st priority, only one at a time). Three times = off. Red content appears at the TOP of the Master Prompt with a strong instruction, repeated at the bottom. Blue is emphasized in the middle. Rules always come first.",
  },
  {
    title: "✨ AI — Gemini",
    description: "Connect Google Gemini in Settings → AI tab. Your key stays in your browser only — never shared. Each person uses their own free key and quota. Once connected: Inbox gets smart category review, Master Prompt gets refinement, Rule Book enhances rules, Prompt Forge refines output, Custom Prompt gets enhancement, Save Prompt gets personalized to your archive, and each character panel gets AI-powered data extraction. Chat with your full archive in the AI tab.",
  },
  {
    title: "🗄️ Vault Switcher",
    description: "Create multiple isolated vaults — one per game or project. Switch at the /vaults page. Export any vault as a .json file to back up or move to another browser. Import to restore exactly. The vault name shown in the switcher syncs with whatever you name your archive on the dashboard when you save.",
  },
  {
    title: "🌐 Website & PC App",
    description: "Val Archives is live at val-archives.vercel.app — share this link with anyone. No login needed, no VS Code, works in any browser on any device. Each person's data stays in their own browser. For a desktop experience, download the PC app from the Download button at the bottom of the dashboard — it opens Val Archives in a standalone window. The PC app requires an internet connection since it loads the live website.",
  },
  {
    title: "➕ Add Tab",
    description: "Create custom navigation tabs. Each tab gets its own page and feeds into the Master Prompt under its tab name as a section header. Pick a name and emoji. Hover a tab in the sidebar to reveal the × button to remove it.",
  },
  {
    title: "⚙ Settings",
    description: "Display: brightness slider from deep charcoal to light grey. Personalisation: 8 website theme presets changing background and text, custom accent color, sidebar color, tab emoji, icon upload. AI: Gemini API key, test connection, full chat with archive context. Danger Zone: Export Vault (full .json backup), Clear Vault, Reset Settings.",
  },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [activeSection, setActiveSection] = useState<"display" | "personalisation" | "instructions" | "ai" | "danger">("display");
  const [saved, setSaved] = useState(false);
  const [vaultCleared, setVaultCleared] = useState(false);
  const [customColorInput, setCustomColorInput] = useState("#3b82f6");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    const loaded = loadTheme();
    setTheme(loaded);
    setCustomColorInput(loaded.accentColor);
    applyTheme(loaded);
    const savedKey = getGeminiKey();
    if (savedKey) setApiKey(savedKey);
  }, []);

  function updateTheme(updates: Partial<ThemeSettings>) {
    const updated = { ...theme, ...updates };
    setTheme(updated);
    applyTheme(updated);
  }

  function applyBgPreset(preset: typeof BG_PRESETS[0]) {
    updateTheme({
      bgPreset: preset.name,
      bgColor: preset.bg,
      surfaceColor: preset.surface,
      borderColor: preset.border,
      textColor: preset.text,
      mutedColor: preset.muted,
      brightness: 0,
    });
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
    { id: "ai",              label: "✨ AI (Gemini)" },
    { id: "danger",          label: "⚠️ Danger Zone" },
  ] as const;

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

        {/* Left nav — uses CSS variables, no hardcoded colors */}
        <aside style={{ width: "13rem", borderRight: "1px solid var(--va-border)", padding: "1rem", minHeight: "100vh", background: "var(--va-surface)" }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  background: activeSection === s.id ? "var(--va-border)" : "transparent",
                  color: activeSection === s.id ? "var(--va-text)" : "var(--va-text-muted)",
                  transition: "background 0.15s",
                }}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, padding: "2rem", maxWidth: activeSection === "instructions" ? "100%" : "42rem" }}>

          {/* ── Display ── */}
          {activeSection === "display" ? (
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
                  <input type="range" min="0" max="100" value={theme.brightness}
                    onChange={(e) => updateTheme({ brightness: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: "var(--va-accent)" }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Light</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.5rem" }}>
                  Adjusts brightness on top of the selected theme.
                </p>
              </div>

              <button onClick={handleResetTheme} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem", textAlign: "left" }}>
                Reset to defaults
              </button>
            </div>
          ) : null}


          {/* ── Personalisation ── */}
          {activeSection === "personalisation" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Personalisation</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Customize the entire website appearance.</p>
              </div>

              {/* Website Theme (full bg color) */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>Website Theme</label>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.75rem" }}>Changes the entire website background, surfaces, and text colors.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginBottom: "1rem" }}>
                  {BG_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyBgPreset(preset)}
                      style={{
                        background: preset.bg,
                        border: theme.bgPreset === preset.name ? `2px solid ${theme.accentColor}` : `1px solid ${preset.border}`,
                        borderRadius: "0.5rem",
                        padding: "0.75rem 0.5rem",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <div style={{ width: "100%", height: "0.5rem", borderRadius: "9999px", background: preset.surface }} />
                      <span style={{ fontSize: "0.625rem", color: preset.text, whiteSpace: "nowrap" }}>{preset.name}</span>
                    </button>
                  ))}
                </div>

                {/* Custom bg color */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Custom bg:</label>
                  <input type="color" value={theme.bgColor}
                    onChange={(e) => updateTheme({ bgColor: e.target.value, bgPreset: "Custom" })}
                    style={{ width: "2.5rem", height: "2rem", borderRadius: "0.25rem", border: "1px solid var(--va-border)", background: "transparent", cursor: "pointer" }} />
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--va-text-muted)" }}>{theme.bgColor}</span>
                </div>
              </div>

              {/* Live preview */}
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

              {/* Accent color */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.75rem" }}>Accent Color</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  {ACCENT_COLORS.map((color) => (
                    <button key={color.value} onClick={() => updateTheme({ accentColor: color.value })} title={color.name}
                      style={{ width: "2.25rem", height: "2.25rem", borderRadius: "9999px", background: color.value, border: "none", cursor: "pointer",
                        outline: theme.accentColor === color.value ? "3px solid white" : "none", outlineOffset: "2px",
                        transform: theme.accentColor === color.value ? "scale(1.15)" : "scale(1)", transition: "transform 0.15s" }} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>Custom:</label>
                  <input type="color" value={theme.accentColor}
                    onChange={(e) => updateTheme({ accentColor: e.target.value })}
                    style={{ width: "2.5rem", height: "2rem", borderRadius: "0.25rem", border: "1px solid var(--va-border)", background: "transparent", cursor: "pointer" }} />
                  <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--va-text-muted)" }}>{theme.accentColor}</span>
                </div>
              </div>

              {/* Tab emoji */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.25rem" }}>Default Tab Emoji</label>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.75rem" }}>Used when creating custom tabs</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {TAB_EMOJIS.map((emoji) => (
                    <button key={emoji} onClick={() => updateTheme({ tabEmoji: emoji })}
                      style={{ width: "2.5rem", height: "2.5rem", fontSize: "1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer",
                        background: theme.tabEmoji === emoji ? "var(--va-border)" : "var(--va-surface)",
                        outline: theme.tabEmoji === emoji ? "1px solid var(--va-accent)" : "none" }}>
                      {emoji}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "0.875rem", marginTop: "0.75rem", color: "var(--va-text-muted)" }}>Selected: <span style={{ fontSize: "1.5rem" }}>{theme.tabEmoji}</span></p>
              </div>

              {/* Custom icon upload */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.5rem" }}>Import Custom Icon</label>
                <label style={{ cursor: "pointer", display: "block" }}>
                  <div style={{ border: "1px dashed var(--va-border)", borderRadius: "0.5rem", padding: "1.5rem", textAlign: "center" }}>
                    <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Click to upload PNG, JPG, or SVG</p>
                  </div>
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => updateTheme({ tabEmoji: ev.target?.result as string });
                      reader.readAsDataURL(file);
                    }} />
                </label>
              </div>
            </div>
          ) : null}


          {/* ── Instructions ── */}
          {activeSection === "instructions" ? (
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
              <>{INSTRUCTIONS.map((item) => (
                <div key={item.title} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem", width: "100%" }}>
                  <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "var(--va-text)" }}>{item.title}</h3>
                  <p style={{ fontSize: "0.875rem", lineHeight: "1.6", color: "var(--va-text-muted)", whiteSpace: "pre-line" }}>{item.description}</p>
                </div>
              ))}</>
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.75rem", color: "var(--va-text)" }}>💡 Tips</h3>
                <ul style={{ fontSize: "0.875rem", lineHeight: "1.8", color: "var(--va-text-muted)", listStyle: "none", padding: 0 }}>
                  {["Paste entire paragraphs into Inbox — it handles splitting and categorizing.",
                    "Always check category suggestions before importing. Use the dropdown to correct mistakes.",
                    "Master Prompt updates automatically every time you import.",
                    "Use Save Prompt before ending a session to resume with any AI.",
                    "Pensieve lets you search, edit, and clean up all entries.",
                    "Refresh consolidates everything if entries feel out of sync.",
                    "Your data is stored only on your device — no cloud, no accounts."].map((tip) => (
                    <li key={tip}>• {tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {/* ── AI (Gemini) ── */}
          {activeSection === "ai" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>✨ AI — Gemini</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Connect Google Gemini to enhance every feature. Your API key stays in your browser only — never shared.</p>
              </div>

              {/* API Key */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>🔑 API Key</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", marginBottom: "0.875rem" }}>
                  Get your free key at <strong>aistudio.google.com</strong> → Get API key → Create API key
                </p>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.625rem" }}>
                  <input
                    type={apiKeyVisible ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", fontFamily: "monospace" }}
                  />
                  <button onClick={() => setApiKeyVisible(!apiKeyVisible)}
                    style={{ background: "var(--va-border)", border: "none", borderRadius: "0.375rem", padding: "0 0.875rem", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.8rem" }}>
                    {apiKeyVisible ? "Hide" : "Show"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    onClick={() => { if (apiKey.trim()) { setGeminiKey(apiKey.trim()); setApiStatus({ ok: true, message: "Key saved" }); setTimeout(() => setApiStatus(null), 2000); } }}
                    disabled={!apiKey.trim()}
                    style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !apiKey.trim() ? 0.4 : 1 }}>
                    Save Key
                  </button>
                  <button
                    onClick={async () => { setTestingApi(true); setApiStatus(null); if (apiKey.trim()) setGeminiKey(apiKey.trim()); const result = await testGeminiConnection(); setApiStatus(result); setTestingApi(false); }}
                    disabled={!apiKey.trim() || testingApi}
                    style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem", opacity: (!apiKey.trim() || testingApi) ? 0.4 : 1 }}>
                    {testingApi ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    onClick={() => { clearGeminiKey(); setApiKey(""); setApiStatus({ ok: false, message: "Key removed" }); setTimeout(() => setApiStatus(null), 2000); }}
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

              {/* What Gemini does */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.75rem" }}>⚡ What Gemini Does</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8rem", color: "var(--va-text-muted)" }}>
                  {[
                    ["📥 Inbox", "Reviews auto-classification and corrects wrong categories"],
                    ["👑 Master Prompt", "Refines the compiled prompt for clarity and coherence"],
                    ["📖 Story entries", "✨ button to enhance any entry with more detail"],
                    ["📋 Rule Book", "✨ button to make rules clearer and more precise"],
                    ["🏛 Canon Archives", "✨ button to summarize uploaded files into key facts"],
                    ["⏳ Timeline Save", "✨ button to suggest interesting branch ideas"],
                    ["⚒ Prompt Forge", "✨ button to refine the forged output"],
                    ["💬 Chat below", "Talk to Gemini with your full archive as context"],
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
                  Gemini has full context of your archive. Ask anything — continue the story, analyze characters, plan quests, brainstorm ideas.
                </p>

                {/* Message history */}
                <div style={{ height: "320px", overflowY: "auto", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.875rem", marginBottom: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {chatMessages.length === 0 ? (
                    <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "4rem" }}>
                      {getGeminiKey() ? "Ask anything about your archive..." : "Add your API key above to start chatting."}
                    </p>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "80%", padding: "0.625rem 0.875rem", borderRadius: msg.role === "user" ? "0.75rem 0.75rem 0.125rem 0.75rem" : "0.75rem 0.75rem 0.75rem 0.125rem",
                          background: msg.role === "user" ? "var(--va-accent)" : "var(--va-border)",
                          color: "var(--va-text)", fontSize: "0.875rem", lineHeight: "1.5", whiteSpace: "pre-wrap",
                        }}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ background: "var(--va-border)", padding: "0.625rem 0.875rem", borderRadius: "0.75rem", color: "var(--va-text-muted)", fontSize: "0.875rem" }}>
                        ✨ Thinking...
                      </div>
                    </div>
                  )}
                </div>

                {chatError && <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{chatError}</p>}

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && !e.shiftKey && chatInput.trim() && !chatLoading) {
                        e.preventDefault();
                        const msg = chatInput.trim();
                        setChatInput("");
                        setChatError("");
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
                    }}
                    placeholder="Ask Gemini anything... (Enter to send)"
                    disabled={chatLoading}
                    style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem", opacity: chatLoading ? 0.6 : 1 }}
                  />
                  <button
                    onClick={async () => {
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
                    }}
                    disabled={!chatInput.trim() || chatLoading}
                    style={{ background: "var(--va-accent)", color: "white", padding: "0.625rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: (!chatInput.trim() || chatLoading) ? 0.4 : 1 }}>
                    Send
                  </button>
                  <button
                    onClick={() => setChatMessages([])}
                    style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.625rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                    Clear
                  </button>
                </div>
              </div>
            </div>
          ) : null}


          {/* ── Danger Zone ── */}
          {activeSection === "danger" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Danger Zone</h2>
                <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Irreversible actions. Be careful.</p>
              </div>

              {/* Export Vault */}
              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>📤 Export This Vault</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem", lineHeight: "1.6" }}>
                  Downloads your entire vault as a .json file — all entries, saves, canon files, rules, prompts, everything intact. Use this to back up your vault or move it to another browser.
                </p>
                <button
                  onClick={() => { const id = getActiveVaultId(); if (id) exportVault(id); else alert("No active vault found."); }}
                  style={{ background: "var(--va-accent)", color: "white", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
                  📤 Export Vault
                </button>
              </div>

              {vaultCleared ? (
                <div style={{ background: "rgba(20,83,45,0.3)", border: "1px solid #15803d", borderRadius: "0.75rem", padding: "1.5rem" }}>
                  <p style={{ color: "#4ade80", fontWeight: "600" }}>✓ Vault cleared.</p>
                  <p style={{ color: "#16a34a", fontSize: "0.875rem", marginTop: "0.25rem" }}>Your archive is now empty.</p>
                  <Link href="/inbox" style={{ display: "inline-block", marginTop: "1rem", background: "#15803d", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", fontSize: "0.875rem", textDecoration: "none" }}>Go to Inbox</Link>
                </div>
              ) : (
                <div style={{ background: "rgba(127,29,29,0.2)", border: "1px solid #7f1d1d", borderRadius: "0.75rem", padding: "1.5rem" }}>
                  <h3 style={{ fontWeight: "bold", color: "#fca5a5", marginBottom: "0.5rem" }}>🗑 Clear Entire Vault</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem", lineHeight: "1.6" }}>
                    Permanently deletes all vault entries, the Master Prompt, Save Prompt, and all archive data. Cannot be undone. Settings are preserved.
                  </p>
                  <button onClick={handleClearVault} style={{ background: "#b91c1c", color: "white", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
                    Clear Vault
                  </button>
                </div>
              )}

              <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
                <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>🔄 Reset All Settings</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", marginBottom: "1rem" }}>Resets theme and display settings to defaults. Does not affect vault data.</p>
                <button onClick={handleResetTheme} style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
                  Reset Settings
                </button>
              </div>
            </div>
          ) : null}

        </main>
      </div>
    </div>
  );
}