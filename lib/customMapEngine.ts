 // lib/customMapEngine.ts
//
// Stage 1 of the Custom Marauder's Map feature: storage layer only.
// Handles saving/loading a user-uploaded map image plus the path/location
// data that Stage 2 (the click-to-draw path editor) will populate, and
// Stage 3 (AI obstacle validation) will refine.
//
// Follows the same IDB-first storage pattern as the rest of Val Archives
// (canon files, inbox files): the image and path data live in IndexedDB,
// never localStorage, since a map image can be large enough to blow
// localStorage's quota. localStorage is never used here at all — IDB only.

const DB_NAME = "valArchivesCustomMapDB";
const DB_VERSION = 1;
const STORE_NAME = "customMap";
const RECORD_KEY = "active"; // single active custom map per user, for now

export interface CustomMapLocation {
  id: string;
  name: string;
  x: number; // pixel coordinate on the ORIGINAL uploaded image
  y: number;
}

export interface CustomMapPath {
  id: string;
  // Raw clicked points in image pixel space, in click order. Stage 2 writes
  // these; Stage 3 (AI validation) may adjust them to avoid obstacles.
  points: Array<{ x: number; y: number }>;
  fromLocationId?: string; // optional, set once Stage 2 lets you snap path ends to named locations
  toLocationId?: string;
}

export interface CustomMapData {
  imageDataUrl: string; // base64 data URL of the uploaded image, untouched
  imageWidth: number;   // natural pixel dimensions, needed to scale clicks correctly
  imageHeight: number;
  locations: CustomMapLocation[];
  paths: CustomMapPath[];
  // Stage 3 will populate this: AI-detected obstacle regions (e.g. building
  // outlines) that the deterministic guardrail checks paths against.
  obstacleZones: Array<{ points: Array<{ x: number; y: number }> }>;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomMap(data: CustomMapData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCustomMap(): Promise<CustomMapData | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearCustomMap(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function hasCustomMap(): Promise<boolean> {
  const data = await loadCustomMap();
  return data !== null;
}

// Helper: reads a File (from an <input type="file">) into a base64 data URL
// plus its natural pixel dimensions. Used by the Settings upload control.
export function readImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not read image dimensions"));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}