import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./ThemeProvider";
import MaraudersMap from "./components/harrypotter/MaraudersMap";
import { ExtractionProvider } from "./ExtractionContext";
import { MusicProvider } from "./MusicPlayer";
import { SoundEffectsProvider } from "./SoundEffects";

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
        <ThemeProvider><SoundEffectsProvider><MusicProvider><ExtractionProvider>{children}</ExtractionProvider></MusicProvider></SoundEffectsProvider></ThemeProvider>
        <MaraudersMap />
      </body>
    </html>
  );
}