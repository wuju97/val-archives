"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadArchive, CATEGORY_LABELS, MASTER_PROMPT_ORDER } from "@/lib/archiveEngine";

export default function HomePage() {
  const [archive, setArchive] = useState(loadArchive());
  useEffect(() => { setArchive(loadArchive()); }, []);

  const topCategories = MASTER_PROMPT_ORDER
    .map((cat) => ({ cat, count: archive.entries.filter((e) => e.category === cat).length }))
    .filter((x) => x.count > 0).slice(0, 6);

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>
      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Dashboard</Link>
      <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>🏠 Home</h1>
      <p style={{ color: "var(--va-text-muted)", marginBottom: "2rem" }}>Overview of your archive.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Total Entries", value: archive.entries.length },
          { label: "Last Saved", value: archive.lastSaved ? new Date(archive.lastSaved).toLocaleString() : "Never" },
          { label: "Archive Name", value: archive.archiveName },
        ].map((item) => (
          <div key={item.label} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem" }}>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>{item.label}</p>
            <p style={{ fontWeight: "bold", fontSize: item.label === "Total Entries" ? "1.875rem" : "0.875rem" }}>{item.value}</p>
          </div>
        ))}
      </div>

      {topCategories.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontWeight: "bold", marginBottom: "1rem", color: "var(--va-text-muted)" }}>Top Categories</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {topCategories.map(({ cat, count }) => (
              <Link key={cat} href={`/story-studio/${cat}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", textDecoration: "none", color: "var(--va-text)", fontSize: "0.875rem" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--va-accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--va-border)")}
              >
                <span>{CATEGORY_LABELS[cat]}</span>
                <span style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>{count} entries</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginBottom: "3rem" }}>
        {[
          { href: "/inbox", icon: "📥", title: "Add Information", desc: "Paste anything into Inbox" },
          { href: "/master-prompt", icon: "👑", title: "Master Prompt", desc: "View & copy your prompt" },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem", textDecoration: "none", display: "block" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--va-accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--va-border)")}
          >
            <p style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>{item.icon}</p>
            <p style={{ fontWeight: "600", color: "var(--va-text)", fontSize: "0.875rem" }}>{item.title}</p>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem" }}>{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Gemini AI Setup Guide */}
      <div style={{ borderTop: "1px solid var(--va-border)", paddingTop: "2.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✨</p>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Enable AI Features</h2>
        <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", marginBottom: "2rem", maxWidth: "480px", margin: "0 auto 2rem" }}>
          Val Archives connects to Google Gemini AI to intelligently classify your entries, refine prompts, personalize your save extractions, and let you chat with your archive. It's free and takes 2 minutes to set up. Your key stays only in your browser — never shared.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "520px", margin: "0 auto", textAlign: "left" }}>
          {[
            {
              step: "1",
              title: "Go to Google AI Studio",
              desc: "Open aistudio.google.com in your browser and sign in with your Google account.",
              highlight: "aistudio.google.com",
            },
            {
              step: "2",
              title: "Create an API Key",
              desc: "In the left sidebar, click Get API key → then click Create API key → select any project or create a new one → click Create.",
              highlight: null,
            },
            {
              step: "3",
              title: "Copy the Key",
              desc: "Your key looks like AIzaSy... — click the copy button next to it.",
              highlight: "AIzaSy...",
            },
            {
              step: "4",
              title: "Open Val Archives Settings",
              desc: "In Val Archives, click Settings in the bottom right of the dashboard → go to the ✨ AI (Gemini) tab.",
              highlight: null,
            },
            {
              step: "5",
              title: "Paste and Save",
              desc: "Paste your key into the API Key field → click Save Key → then click Test Connection.",
              highlight: null,
            },
            {
              step: "6",
              title: "You're Connected",
              desc: "If it says ✓ Connected — you're done. All ✨ AI buttons across the site are now active and using your own free quota.",
              highlight: "✓ Connected",
            },
          ].map((item) => (
            <div key={item.step} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem" }}>
              <div style={{ width: "2rem", height: "2rem", borderRadius: "50%", background: "var(--va-accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.875rem", flexShrink: 0 }}>
                {item.step}
              </div>
              <div>
                <p style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.25rem", color: "var(--va-text)" }}>{item.title}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", lineHeight: "1.5" }}>{item.desc}</p>
                {item.highlight && (
                  <p style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--va-accent)", marginTop: "0.25rem", background: "var(--va-bg)", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", display: "inline-block" }}>{item.highlight}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", maxWidth: "520px", margin: "1.5rem auto 0" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--va-text-muted)", lineHeight: "1.6" }}>
            <strong style={{ color: "var(--va-text)" }}>Free tier limits:</strong> ~15 requests/minute · 1,500 requests/day · No credit card needed.<br />
            <strong style={{ color: "var(--va-text)" }}>Privacy:</strong> Your API key is stored only in your browser. Val Archives never sees or stores it. Each person uses their own key and their own quota.
          </p>
        </div>
      </div>
    </div>
  );
}