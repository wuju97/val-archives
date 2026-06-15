"use client";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./ThemeProvider";
import { ExtractionProvider, useDistill, DistillQueueItem } from "./ExtractionContext";
import { MusicProvider } from "./MusicPlayer";
import { useState } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Val Archives",
  description: "A Prompt Operating System for stories, RPGs, and worldbuilding.",
};


// ─── Floating Distill Queue Popup ────────────────────────────────────────────
function DistillFloatingPopup() {
  const { distillQueue, removeFromDistillQueue, isDistillRunning } = useDistill();
  const [pos, setPos] = useState({ x: 20, y: 120 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(true);

  if (distillQueue.length === 0) return null;

  const running = distillQueue.find((i: DistillQueueItem) => i.status === "distilling" || i.status === "importing");
  const done = distillQueue.filter((i: DistillQueueItem) => i.status === "done");
  const errors = distillQueue.filter((i: DistillQueueItem) => i.status === "error");
  const queued = distillQueue.filter((i: DistillQueueItem) => i.status === "queued");

  if (!visible) {
    return (
      <button onClick={() => setVisible(true)}
        style={{ position: "fixed", bottom: "5rem", right: "1.25rem", zIndex: 999, background: "#7c3aed", color: "white", border: "none", borderRadius: "9999px", padding: "0.5rem 0.875rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: "700", boxShadow: "0 4px 12px rgba(124,58,237,0.4)" }}>
        ✨ Distill Queue ({distillQueue.length})
      </button>
    );
  }

  return (
    <div
      onMouseDown={e => { setDragging(true); setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y }); }}
      onMouseMove={e => { if (dragging) setPos({ x: e.clientX - offset.x, y: e.clientY - offset.y }); }}
      onMouseUp={() => setDragging(false)}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1000, width: "320px", background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.75rem", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isDistillRunning && <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #7c3aed", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />}
          <p style={{ fontWeight: "700", fontSize: "0.8rem", color: "#c4b5fd" }}>
            ✨ Distilling... {running?.filename.replace(/\.[^/.]+$/, "")}
          </p>
        </div>
        <button onClick={() => setVisible(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem", padding: "0 0.25rem" }}>−</button>
      </div>
      <div style={{ padding: "0.75rem 1rem", maxHeight: "200px", overflowY: "auto" }}>
        {distillQueue.map((item: DistillQueueItem) => (
          <div key={item.id} style={{ marginBottom: "0.5rem", padding: "0.5rem 0.625rem", background: "var(--va-bg)", borderRadius: "0.375rem", border: `1px solid ${item.status === "done" ? "#22c55e" : item.status === "error" ? "#ef4444" : item.status === "distilling" || item.status === "importing" ? "#7c3aed" : "var(--va-border)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--va-text)" }}>
                {item.status === "done" ? "✓" : item.status === "error" ? "✗" : item.status === "queued" ? "🕐" : "⏳"} {item.filename.replace(/\.[^/.]+$/, "").slice(0, 25)}
              </span>
              {(item.status === "done" || item.status === "error") && (
                <button onClick={() => removeFromDistillQueue(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.75rem" }}>×</button>
              )}
            </div>
            <p style={{ fontSize: "0.68rem", color: item.status === "error" ? "#f87171" : item.status === "done" ? "#4ade80" : "#c4b5fd", margin: 0 }}>{item.progress}</p>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:wght@400;700;900&family=Raleway:wght@400;700;900&family=Oswald:wght@400;700&family=Lora:wght@400;700&family=Bebas+Neue&family=Uncial+Antiqua&family=Merriweather:wght@400;700;900&family=IM+Fell+English&family=Crimson+Text:wght@400;700&family=Josefin+Sans:wght@400;700&family=Exo+2:wght@400;700;900&family=Orbitron:wght@400;700;900&family=Press+Start+2P&family=Pirata+One&family=Almendra:wght@400;700&family=Caudex:wght@400;700&family=Philosopher:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Spectral:wght@400;700&family=Cormorant+Garamond:wght@400;700;900&family=Abril+Fatface&family=Righteous&family=Poiret+One&family=Permanent+Marker&family=Pacifico&family=Satisfy&family=Dancing+Script:wght@400;700&family=Caveat:wght@400;700&display=swap" rel="stylesheet" />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  // ── Theme ──────────────────────────────────────────────────────────────────
  function va(){
    try{
      var t=JSON.parse(localStorage.getItem('valArchivesTheme')||'{}');
      var b=typeof t.brightness==='number'?t.brightness:0;
      var a=t.accentColor||'#3b82f6';
      function L(a,b,t){return Math.round(a+(b-a)*t);}
      function H(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
      function I(h1,h2,t){var c1=H(h1),c2=H(h2);return'rgb('+L(c1[0],c2[0],t)+','+L(c1[1],c2[1],t)+','+L(c1[2],c2[2],t)+')';}
      var f=b/100,r=document.documentElement;
      r.style.setProperty('--va-bg',I('#080808','#e5e7eb',f));
      r.style.setProperty('--va-surface',I('#111827','#f3f4f6',f));
      r.style.setProperty('--va-border',I('#1f2937','#d1d5db',f));
      r.style.setProperty('--va-text',I('#f9fafb','#111827',f));
      r.style.setProperty('--va-text-muted',I('#6b7280','#4b5563',f));
      r.style.setProperty('--va-accent',a);
    }catch(e){}
  }
  va();

  // ── Restore ALL vault keys from IndexedDB → localStorage ──────────────────
  // This runs whenever localStorage is missing vault data (quota wipe, clear, etc.)
  // It restores every key that starts with "valArchivesData_" or matches known
  // index/dashboard keys — covering the full vault switcher system.
  (function syncFromIDB(){
    try {
      if(typeof indexedDB === 'undefined') return;

      var req = indexedDB.open('valArchivesDB', 1);
      req.onsuccess = function(e){
        var db = e.target.result;
        if(!db.objectStoreNames.contains('vaults')) return;
        var tx = db.transaction('vaults', 'readonly');
        var store = tx.objectStore('vaults');

        // Get all keys stored in IndexedDB
        var keysReq = store.getAllKeys();
        keysReq.onsuccess = function(){
          var allKeys = keysReq.result || [];
          allKeys.forEach(function(k){
            // Only restore vault data and index keys — skip unrelated keys
            if(
              typeof k === 'string' && (
                k.startsWith('valArchivesData_') ||
                k === 'valArchivesVaultIndex' ||
                k === 'valArchivesDashboardCards'
              )
            ){
              // Only restore if localStorage is missing or empty for this key
              try {
                var existing = localStorage.getItem(k);
                if(existing && existing.length > 10) return; // already there
              } catch(e){}

              var getReq = store.get(k);
              getReq.onsuccess = function(){
                if(getReq.result){
                  // Check if IDB data has more entries than what's in localStorage
                  // If localStorage has empty/stripped data, always restore from IDB
                  var idbData = null;
                  try { idbData = JSON.parse(getReq.result); } catch(e) {}
                  var localRaw = null;
                  try { localRaw = localStorage.getItem(k); } catch(e) {}
                  var localData = null;
                  try { localData = localRaw ? JSON.parse(localRaw) : null; } catch(e) {}
                  
                  var idbEntries = (idbData && idbData.entries) ? idbData.entries.length : 0;
                  var localEntries = (localData && localData.entries) ? localData.entries.length : 0;
                  
                  // Always use IDB if it has more data or localStorage is empty
                  if(idbEntries >= localEntries) {
                    try{ localStorage.setItem(k, getReq.result); }
                    catch(quota){
                      // localStorage full — remove it so app falls back to IDB
                      try { localStorage.removeItem(k); } catch(e) {}
                      console.warn('[ValArchives] localStorage full — app will load from IDB directly');
                    }
                  }
                }
              };
            }
          });
        };
      };
    } catch(e){
      console.warn('[ValArchives] IDB sync failed:', e);
    }
  })();

  // ── Migrate localStorage → IndexedDB on first run ─────────────────────────
  (function migrate(){
    try {
      if(localStorage.getItem('valArchives_idb_migrated')==='1') return;
      var db = indexedDB.open('valArchivesDB',1);
      db.onupgradeneeded = function(e){ e.target.result.createObjectStore('vaults'); };
      db.onsuccess = function(e){
        var idb = e.target.result;
        var keys = [];
        for(var i=0;i<localStorage.length;i++){
          var k=localStorage.key(i);
          if(k && (k.startsWith('valArchivesData_')||k==='valArchivesVaultIndex'||k==='valArchivesDashboardCards')){
            keys.push(k);
          }
        }
        keys.forEach(function(k){
          var v=localStorage.getItem(k);
          if(v){var tx=idb.transaction('vaults','readwrite');tx.objectStore('vaults').put(v,k);}
        });
        localStorage.setItem('valArchives_idb_migrated','1');
      };
    } catch(e){}
  })();

  document.addEventListener('DOMContentLoaded', va);
  window.addEventListener('popstate', va);
})();
`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <ThemeProvider><MusicProvider><ExtractionProvider>{children}</ExtractionProvider></MusicProvider></ThemeProvider>
      </body>
    </html>
  );
}