 "use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

export type SoundSlotId = "keystroke" | "buttonClick" | "pageTurn" | "quillScratch";

export const SOUND_SLOTS: Array<{ id: SoundSlotId; label: string; desc: string }> = [
  { id: "keystroke", label: "⌨️ Keystroke", desc: "Plays on every key typed anywhere on the site" },
  { id: "buttonClick", label: "🖱️ Button Click", desc: "Plays when you click any button" },
  { id: "pageTurn", label: "📖 Page Turn", desc: "Plays when navigating between pages" },
  { id: "quillScratch", label: "🪶 Quill Scratch", desc: "Plays while typing in text areas (e.g. writing entries)" },
];

interface SoundSlotMeta {
  name: string;
  size: number;
}

interface SoundEffectsContextType {
  slots: Record<SoundSlotId, SoundSlotMeta | null>;
  enabled: boolean;
  volume: number;
  uploadSound: (slot: SoundSlotId, file: File) => Promise<void>;
  removeSound: (slot: SoundSlotId) => Promise<void>;
  setEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  playSound: (slot: SoundSlotId) => void;
}

const SoundEffectsContext = createContext<SoundEffectsContextType>({
  slots: { keystroke: null, buttonClick: null, pageTurn: null, quillScratch: null },
  enabled: false, volume: 50,
  uploadSound: async () => {}, removeSound: async () => {},
  setEnabled: () => {}, setVolume: () => {}, playSound: () => {},
});

export function useSoundEffects() {
  return useContext(SoundEffectsContext);
}

// ─── IndexedDB helpers — separate store from the music player since these are
// short one-shot SFX clips, not a playlist. ───────────────────────────────────
const DB_NAME = "valArchivesSoundDB";
const DB_VERSION = 1;
const STORE_AUDIO = "sfxAudio";

function openSoundDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) db.createObjectStore(STORE_AUDIO);
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSoundToDB(slot: SoundSlotId, blob: Blob): Promise<void> {
  const db = await openSoundDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, "readwrite");
    tx.objectStore(STORE_AUDIO).put(blob, slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSoundFromDB(slot: SoundSlotId): Promise<Blob | null> {
  const db = await openSoundDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_AUDIO, "readonly");
    const req = tx.objectStore(STORE_AUDIO).get(slot);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function deleteSoundFromDB(slot: SoundSlotId): Promise<void> {
  const db = await openSoundDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, "readwrite");
    tx.objectStore(STORE_AUDIO).delete(slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const META_KEY = "valArchivesSoundMeta";
const ENABLED_KEY = "valArchivesSoundEnabled";
const VOLUME_KEY = "valArchivesSoundVolume";

export function SoundEffectsProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Record<SoundSlotId, SoundSlotMeta | null>>({
    keystroke: null, buttonClick: null, pageTurn: null, quillScratch: null,
  });
  const [enabled, setEnabledState] = useState(false);
  const [volume, setVolumeState] = useState(50);
  const audioCache = useRef<Record<string, HTMLAudioElement>>({});
  const lastPlayedAt = useRef<Record<string, number>>({});

  // Load saved metadata + settings on mount
  useEffect(() => {
    try {
      const savedMeta = localStorage.getItem(META_KEY);
      if (savedMeta) setSlots(JSON.parse(savedMeta));
      const savedEnabled = localStorage.getItem(ENABLED_KEY);
      if (savedEnabled) setEnabledState(savedEnabled === "true");
      const savedVolume = localStorage.getItem(VOLUME_KEY);
      if (savedVolume) setVolumeState(Number(savedVolume));
    } catch {}
  }, []);

  async function uploadSound(slot: SoundSlotId, file: File) {
    await saveSoundToDB(slot, file);
    const updated = { ...slots, [slot]: { name: file.name, size: file.size } };
    setSlots(updated);
    localStorage.setItem(META_KEY, JSON.stringify(updated));
    delete audioCache.current[slot]; // force reload of the cached Audio element
  }

  async function removeSound(slot: SoundSlotId) {
    await deleteSoundFromDB(slot);
    const updated = { ...slots, [slot]: null };
    setSlots(updated);
    localStorage.setItem(META_KEY, JSON.stringify(updated));
    delete audioCache.current[slot];
  }

  function setEnabled(v: boolean) {
    setEnabledState(v);
    localStorage.setItem(ENABLED_KEY, String(v));
  }

  function setVolume(v: number) {
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
    for (const audio of Object.values(audioCache.current)) audio.volume = v / 100;
  }

  // Plays a slot's sound, loading + caching the Audio element from IndexedDB on first use.
  // Debounced per-slot to ~40ms so rapid keystrokes don't pile up overlapping playback calls.
  function playSound(slot: SoundSlotId) {
    if (!enabled) return;
    const now = Date.now();
    if (now - (lastPlayedAt.current[slot] || 0) < 40) return;
    lastPlayedAt.current[slot] = now;

    const cached = audioCache.current[slot];
    if (cached) {
      cached.currentTime = 0;
      cached.volume = volume / 100;
      cached.play().catch(() => {});
      return;
    }
    if (!slots[slot]) return; // no sound uploaded for this slot
    loadSoundFromDB(slot).then(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = volume / 100;
      audioCache.current[slot] = audio;
      audio.play().catch(() => {});
    });
  }

  return (
    <SoundEffectsContext.Provider value={{ slots, enabled, volume, uploadSound, removeSound, setEnabled, setVolume, playSound }}>
      {children}
    </SoundEffectsContext.Provider>
  );
}