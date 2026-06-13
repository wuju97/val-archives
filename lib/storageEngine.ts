// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE ENGINE — IndexedDB with localStorage fallback
// Replaces direct localStorage calls for vault data
// No setup needed — works in all modern browsers automatically
// ═══════════════════════════════════════════════════════════════════════════════

const DB_NAME = "valArchivesDB";
const DB_VERSION = 1;
const STORE_NAME = "vaults";

// ─── IndexedDB Setup ──────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Core read/write ──────────────────────────────────────────────────────────

export async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    // Fallback to localStorage
    return localStorage.getItem(key);
  }
}

export async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    // Also keep a lightweight copy in localStorage for fast metadata access
    // but only for small values (index, active vault key)
    if (value.length < 10000) {
      try { localStorage.setItem(key, value); } catch {}
    }
  } catch {
    // Fallback to localStorage
    try { localStorage.setItem(key, value); } catch (e) {
      console.error("Storage full:", e);
    }
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
    });
    localStorage.removeItem(key);
  } catch {
    localStorage.removeItem(key);
  }
}

export async function idbList(prefix?: string): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as string[]).filter(k =>
          typeof k === "string" && (!prefix || k.startsWith(prefix))
        );
        resolve(keys);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    // Fallback: scan localStorage
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (!prefix || k.startsWith(prefix))) keys.push(k);
    }
    return keys;
  }
}

// ─── Migration from localStorage to IndexedDB ─────────────────────────────────

export async function migrateToIndexedDB(): Promise<void> {
  if (typeof window === "undefined") return;

  // Check if already migrated
  const migrated = localStorage.getItem("valArchives_idb_migrated");
  if (migrated === "1") return;

  try {
    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith("valArchivesData_") ||
        key.startsWith("valArchivesHistory") ||
        key.startsWith("valArchivesFuture") ||
        key === "valArchivesVaultIndex" ||
        key === "valArchivesActiveVault" ||
        key === "valArchivesDashboardCards"
      )) {
        keysToMigrate.push(key);
      }
    }

    for (const key of keysToMigrate) {
      const value = localStorage.getItem(key);
      if (value) {
        await idbSet(key, value);
      }
    }

    localStorage.setItem("valArchives_idb_migrated", "1");
    console.log(`Migrated ${keysToMigrate.length} keys to IndexedDB`);
  } catch (e) {
    console.error("Migration error:", e);
  }
}

// ─── Sync wrappers (for code that can't be async) ────────────────────────────
// These read from localStorage cache for speed, write to both

export function syncGet(key: string): string | null {
  return localStorage.getItem(key);
}

export function syncSet(key: string, value: string): void {
  // Write to localStorage for immediate access
  try { localStorage.setItem(key, value); } catch {}
  // Write to IndexedDB async (fire and forget for large data)
  idbSet(key, value).catch(console.error);
}

export function syncDelete(key: string): void {
  localStorage.removeItem(key);
  idbDelete(key).catch(console.error);
}