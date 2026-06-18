"use client";

import { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";

export interface Song {
  id: string;
  name: string;
  size: number;
  type: string;
}

type LoopMode = "loop-all" | "loop-one" | "play-once";

interface MusicContextType {
  songs: Song[];
  currentIndex: number | null;
  isPlaying: boolean;
  volume: number;
  loopMode: LoopMode;
  currentTime: number;
  duration: number;
  addSongs: (files: FileList) => void;
  removeSong: (id: string) => void;
  playSong: (index: number) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  setLoopMode: (m: LoopMode) => void;
  seek: (time: number) => void;
  clearAll: () => void;
}

const MusicContext = createContext<MusicContextType>({
  songs: [], currentIndex: null, isPlaying: false, volume: 70,
  loopMode: "loop-all", currentTime: 0, duration: 0,
  addSongs: () => {}, removeSong: () => {},
  playSong: () => {}, togglePlay: () => {}, next: () => {}, prev: () => {},
  setVolume: () => {}, setLoopMode: () => {}, seek: () => {}, clearAll: () => {},
});

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME = "valArchivesMusicDB";
const DB_VERSION = 1;
const STORE_AUDIO = "audioFiles";
const STORE_META = "songMeta";

function openMusicDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) db.createObjectStore(STORE_AUDIO);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function saveAudioToDB(id: string, blob: Blob): Promise<void> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, "readwrite");
    tx.objectStore(STORE_AUDIO).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadAudioFromDB(id: string): Promise<Blob | null> {
  const db = await openMusicDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_AUDIO, "readonly");
    const req = tx.objectStore(STORE_AUDIO).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function deleteAudioFromDB(id: string): Promise<void> {
  const db = await openMusicDB();
  const tx = db.transaction(STORE_AUDIO, "readwrite");
  tx.objectStore(STORE_AUDIO).delete(id);
}

async function saveMetaToDB(songs: Song[]): Promise<void> {
  const db = await openMusicDB();
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put(JSON.stringify(songs), "playlist");
}

async function loadMetaFromDB(): Promise<Song[]> {
  try {
    const db = await openMusicDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, "readonly");
      const req = tx.objectStore(STORE_META).get("playlist");
      req.onsuccess = () => {
        try { resolve(JSON.parse(req.result ?? "[]")); }
        catch { resolve([]); }
      };
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function MusicProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(70);
  const [loopMode, setLoopModeState] = useState<LoopMode>("loop-all");
  const [loaded, setLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const songsRef = useRef<Song[]>([]);
  const loopModeRef = useRef<LoopMode>("loop-all");
  const currentIndexRef = useRef<number | null>(null);

  // Keep refs in sync
  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { loopModeRef.current = loopMode; }, [loopMode]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Load persisted playlist on mount
  useEffect(() => {
    async function init() {
      const meta = await loadMetaFromDB();
      setSongs(meta);
      songsRef.current = meta;
      setLoaded(true);

      // Restore volume and loop mode from localStorage
      const savedVol = localStorage.getItem("vaMusicVolume");
      const savedLoop = localStorage.getItem("vaMusicLoop") as LoopMode | null;
      if (savedVol) { setVolumeState(Number(savedVol)); }
      if (savedLoop) { setLoopModeState(savedLoop); loopModeRef.current = savedLoop; }
    }
    init();
  }, []);

  // Init audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume / 100;
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration || 0));

    audio.addEventListener("ended", async () => {
      const mode = loopModeRef.current;
      const idx = currentIndexRef.current;
      const currentSongs = songsRef.current;

      if (mode === "loop-one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      if (mode === "play-once") {
        setIsPlaying(false);
        setCurrentIndex(null);
        return;
      }
      // loop-all
      if (idx === null || currentSongs.length === 0) return;
      const nextIdx = (idx + 1) % currentSongs.length;
      await playByIndex(nextIdx, currentSongs);
    });

    return () => { audio.pause(); };
  }, []);

  async function playByIndex(index: number, songList?: Song[]) {
    const audio = audioRef.current;
    const list = songList ?? songsRef.current;
    if (!audio || !list[index]) return;

    const blob = await loadAudioFromDB(list[index].id);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    // Revoke previous url if any
    if (audio.src && audio.src.startsWith("blob:")) {
      URL.revokeObjectURL(audio.src);
    }
    audio.src = url;
    setCurrentTime(0);
    setDuration(0);
    await audio.play().catch(() => {});
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setIsPlaying(true);
  }

  async function addSongs(files: FileList) {
    const newSongs: Song[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("audio/")) continue;
      const id = crypto.randomUUID();
      await saveAudioToDB(id, file);
      newSongs.push({ id, name: file.name.replace(/\.[^/.]+$/, ""), size: file.size, type: file.type });
    }
    const updated = [...songsRef.current, ...newSongs];
    setSongs(updated);
    await saveMetaToDB(updated);
  }

  async function removeSong(id: string) {
    await deleteAudioFromDB(id);
    const idx = songsRef.current.findIndex(s => s.id === id);
    const updated = songsRef.current.filter(s => s.id !== id);
    setSongs(updated);
    await saveMetaToDB(updated);

    if (currentIndexRef.current !== null) {
      if (idx === currentIndexRef.current) {
        audioRef.current?.pause();
        setIsPlaying(false);
        setCurrentIndex(null);
      } else if (idx < currentIndexRef.current) {
        const newIdx = currentIndexRef.current - 1;
        setCurrentIndex(newIdx);
        currentIndexRef.current = newIdx;
      }
    }
  }

  function playSong(index: number) { playByIndex(index); }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (currentIndexRef.current === null && songsRef.current.length > 0) {
        playByIndex(0);
      } else {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }

  function next() {
    if (songsRef.current.length === 0) return;
    const idx = currentIndexRef.current === null ? 0 : (currentIndexRef.current + 1) % songsRef.current.length;
    playByIndex(idx);
  }

  function prev() {
    if (songsRef.current.length === 0) return;
    const idx = currentIndexRef.current === null ? 0 : (currentIndexRef.current - 1 + songsRef.current.length) % songsRef.current.length;
    playByIndex(idx);
  }

  function setVolume(v: number) {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v / 100;
    localStorage.setItem("vaMusicVolume", String(v));
  }

  function setLoopMode(m: LoopMode) {
    setLoopModeState(m);
    loopModeRef.current = m;
    localStorage.setItem("vaMusicLoop", m);
  }

  function seek(time: number) {
    const audio = audioRef.current;
    if (!audio || !isFinite(time)) return;
    const clamped = Math.max(0, Math.min(time, audio.duration || time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }

  async function clearAll() {
    for (const s of songsRef.current) await deleteAudioFromDB(s.id);
    audioRef.current?.pause();
    if (audioRef.current?.src?.startsWith("blob:")) URL.revokeObjectURL(audioRef.current.src);
    setSongs([]);
    setCurrentIndex(null);
    setIsPlaying(false);
    await saveMetaToDB([]);
  }

  return (
    <MusicContext.Provider value={{ songs, currentIndex, isPlaying, volume, loopMode, currentTime, duration, addSongs, removeSong, playSong, togglePlay, next, prev, setVolume, setLoopMode, seek, clearAll }}>
      {children}
      {loaded && <MiniPlayer />}
    </MusicContext.Provider>
  );
}

export function useMusic() { return useContext(MusicContext); }

// ─── Mini Player ──────────────────────────────────────────────────────────────
function MiniPlayer() {
  const { songs, currentIndex, isPlaying, volume, loopMode, currentTime, duration, togglePlay, next, prev, setVolume, setLoopMode, seek } = useMusic();
  const [collapsed, setCollapsed] = useState(false);

  if (songs.length === 0) return null;

  const current = currentIndex !== null ? songs[currentIndex] : null;
  const loopIcon = loopMode === "loop-all" ? "🔁" : loopMode === "loop-one" ? "🔂" : "➡️";

  function cycleLoop() {
    if (loopMode === "loop-all") setLoopMode("loop-one");
    else if (loopMode === "loop-one") setLoopMode("play-once");
    else setLoopMode("loop-all");
  }

  function formatTime(t: number): string {
    if (!isFinite(t) || t < 0) return "0:00";
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function handleSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ position: "fixed", bottom: "1.5rem", left: "1.5rem", zIndex: 8888, background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", boxShadow: "0 4px 20px rgba(0,0,0,0.4)", width: collapsed ? "auto" : "260px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 0.875rem", cursor: "pointer" }} onClick={() => setCollapsed(c => !c)}>
        <span style={{ fontSize: "0.9rem" }}>{isPlaying ? "🎵" : "🎵"}</span>
        {!collapsed && (
          <span style={{ fontSize: "0.75rem", color: "var(--va-text)", fontWeight: "600", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current ? current.name : "Click to play"}
          </span>
        )}
        <span style={{ fontSize: "0.65rem", color: "var(--va-text-muted)" }}>{collapsed ? "▲" : "▼"}</span>
      </div>

      {!collapsed && (
        <div style={{ padding: "0 0.875rem 0.875rem", borderTop: "1px solid var(--va-border)" }}>
          <p style={{ fontSize: "0.72rem", color: "var(--va-text-muted)", margin: "0.5rem 0 0.625rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current ? `${(currentIndex ?? 0) + 1} / ${songs.length} — ${current.name}` : `${songs.length} song${songs.length !== 1 ? "s" : ""} in playlist`}
          </p>
          {/* Seekable progress bar */}
          {current && (
            <div style={{ marginBottom: "0.625rem" }}>
              <div onClick={handleSeekClick}
                style={{ position: "relative", width: "100%", height: "8px", borderRadius: "9999px", background: "var(--va-border)", cursor: "pointer" }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${progress}%`, borderRadius: "9999px", background: "var(--va-accent)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: "50%", left: `${progress}%`, transform: "translate(-50%, -50%)", width: "12px", height: "12px", borderRadius: "50%", background: "var(--va-accent)", boxShadow: "0 0 0 2px var(--va-surface)", pointerEvents: "none" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--va-text-muted)" }}>{formatTime(currentTime)}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--va-text-muted)" }}>{formatTime(duration)}</span>
              </div>
            </div>
          )}
          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "0.625rem" }}>
            <button onClick={prev} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--va-text-muted)", padding: "0.25rem" }}>⏮</button>
            <button onClick={togglePlay} style={{ background: "var(--va-accent)", border: "none", cursor: "pointer", borderRadius: "50%", width: "32px", height: "32px", fontSize: "0.9rem", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={next} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--va-text-muted)", padding: "0.25rem" }}>⏭</button>
            <button onClick={cycleLoop} title={loopMode} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", padding: "0.25rem", opacity: loopMode === "play-once" ? 0.4 : 1 }}>{loopIcon}</button>
          </div>
          {/* Volume */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem" }}>🔈</span>
            <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--va-accent)", height: "4px", cursor: "pointer" }} />
            <span style={{ fontSize: "0.65rem", color: "var(--va-text-muted)", width: "28px", textAlign: "right" }}>{volume}%</span>
          </div>
        </div>
      )}
    </div>
  );
}