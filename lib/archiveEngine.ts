// ─── Category System ──────────────────────────────────────────────────────────

export type StoryCategory =
  | "world-overview"
  | "geography"
  | "history"
  | "lore-mythology"
  | "magic-supernatural"
  | "science-technology"
  | "political-systems"
  | "organizations"
  | "economy"
  | "cultures-society"
  | "species-races"
  | "characters"
  | "relationships"
  | "factions"
  | "mysteries"
  | "quests-plotlines"
  | "timeline-continuity"
  | "conflict-combat"
  | "items-equipment"
  | "creatures-wildlife"
  | "locations"
  | "themes-tone"
  | "writing-style"
  | "session-notes"
  | "meta-information"
  | "branching-canon"
  | "emotional-architecture"
  | "information-architecture"
  | "rules"
  | "player-character"
  | "romance"
  | "custom";

export const CATEGORY_LABELS: Record<StoryCategory, string> = {
  "world-overview": "World Overview",
  "geography": "Geography",
  "history": "History",
  "lore-mythology": "Lore & Mythology",
  "magic-supernatural": "Magic & Supernatural",
  "science-technology": "Science & Technology",
  "political-systems": "Political Systems",
  "organizations": "Organizations",
  "economy": "Economy",
  "cultures-society": "Cultures & Society",
  "species-races": "Species & Races",
  "characters": "Characters",
  "relationships": "Relationships",
  "factions": "Factions & Power",
  "mysteries": "Mysteries",
  "quests-plotlines": "Quests & Plotlines",
  "timeline-continuity": "Timeline & Continuity",
  "conflict-combat": "Conflict & Combat",
  "items-equipment": "Items & Equipment",
  "creatures-wildlife": "Creatures & Wildlife",
  "locations": "Locations",
  "themes-tone": "Themes & Tone",
  "writing-style": "Writing Style",
  "session-notes": "Session Notes",
  "meta-information": "Meta Information",
  "branching-canon": "Branching Canon",
  "emotional-architecture": "Emotional Architecture",
  "information-architecture": "Information Architecture",
  "rules": "Core Rules",
  "player-character": "Player Character",
  "romance": "Romance & Love",
  "custom": "Custom",
};

export const CATEGORY_ICONS: Record<StoryCategory, string> = {
  "world-overview": "🌍",
  "geography": "🗺️",
  "history": "📜",
  "lore-mythology": "🔮",
  "magic-supernatural": "✨",
  "science-technology": "⚙️",
  "political-systems": "⚖️",
  "organizations": "🏛️",
  "economy": "💰",
  "cultures-society": "🎭",
  "species-races": "👁️",
  "characters": "👤",
  "relationships": "🤝",
  "factions": "⚔️",
  "mysteries": "❓",
  "quests-plotlines": "📍",
  "timeline-continuity": "⏳",
  "conflict-combat": "🗡️",
  "items-equipment": "🎒",
  "creatures-wildlife": "🐉",
  "locations": "📍",
  "themes-tone": "🎨",
  "writing-style": "✍️",
  "session-notes": "📝",
  "meta-information": "🔧",
  "branching-canon": "🌳",
  "emotional-architecture": "💙",
  "information-architecture": "🗂️",
  "rules": "📋",
  "player-character": "⭐",
  "romance": "💕",
  "custom": "➕",
};

// Master prompt priority order
export const MASTER_PROMPT_ORDER: StoryCategory[] = [
  "rules",
  "player-character",
  "world-overview",
  "timeline-continuity",
  "characters",
  "relationships",
  "romance",
  "locations",
  "geography",
  "history",
  "lore-mythology",
  "magic-supernatural",
  "organizations",
  "factions",
  "political-systems",
  "conflict-combat",
  "quests-plotlines",
  "items-equipment",
  "creatures-wildlife",
  "cultures-society",
  "species-races",
  "economy",
  "science-technology",
  "mysteries",
  "themes-tone",
  "writing-style",
  "emotional-architecture",
  "information-architecture",
  "branching-canon",
  "session-notes",
  "meta-information",
  "custom",
];

// ─── Classifier ───────────────────────────────────────────────────────────────

const CLASSIFIER_MAP: Array<{ keywords: string[]; category: StoryCategory }> = [
  { keywords: ["rule", "must", "always", "never", "do not", "should not", "forbidden", "law of"], category: "rules" },
  { keywords: ["player", "my character", "pc:", "protagonist", "i am", "my name is"], category: "player-character" },
  { keywords: ["spell", "cast", "magic", "potion", "enchant", "curse", "ritual", "incantation", "wand", "staff", "mana", "arcane", "supernatural", "mystical"], category: "magic-supernatural" },
  { keywords: ["character", "person", "hero", "villain", "antagonist", "npc", "born", "age", "appearance", "personality", "trait", "hair", "eye", "tall", "short"], category: "characters" },
  { keywords: ["loves", "hates", "friend", "enemy", "rival", "allied", "relationship", "married", "betrothed", "trusts", "fears", "mentor", "↔", "→"], category: "relationships" },
  { keywords: ["location", "city", "town", "village", "castle", "dungeon", "temple", "forest", "mountain", "lake", "river", "sea", "ocean", "kingdom", "realm", "hogwarts", "place"], category: "locations" },
  { keywords: ["map", "continent", "region", "country", "border", "climate", "terrain", "geography", "island", "peninsula", "desert"], category: "geography" },
  { keywords: ["history", "ancient", "founded", "war", "revolution", "empire", "era", "century", "decade", "historical", "past", "origin", "colonial"], category: "history" },
  { keywords: ["myth", "legend", "god", "goddess", "deity", "pantheon", "religion", "prophecy", "folklore", "creation", "cosmology", "sacred", "afterlife"], category: "lore-mythology" },
  { keywords: ["technology", "science", "medicine", "engineering", "invention", "machine", "weapon tech", "transport", "communication"], category: "science-technology" },
  { keywords: ["government", "king", "queen", "minister", "politics", "law", "justice", "noble", "diplomacy", "succession", "ideology", "parliament"], category: "political-systems" },
  { keywords: ["guild", "order", "organization", "institution", "society", "agency", "ministry", "church", "academy"], category: "organizations" },
  { keywords: ["gold", "coin", "trade", "market", "economy", "wealth", "tax", "currency", "resource", "bank", "merchant", "import", "export"], category: "economy" },
  { keywords: ["culture", "custom", "tradition", "language", "fashion", "food", "cuisine", "festival", "art", "architecture", "class", "etiquette", "taboo"], category: "cultures-society" },
  { keywords: ["race", "species", "elf", "dwarf", "orc", "human", "creature race", "biology", "lifespan", "subspecies"], category: "species-races" },
  { keywords: ["faction", "power", "territory", "influence", "hierarchy", "syndicate", "rebel", "criminal", "mercenary"], category: "factions" },
  { keywords: ["mystery", "secret", "hidden", "unknown", "conspiracy", "disappear", "unsolved", "prophecy", "clue", "foreshadow"], category: "mysteries" },
  { keywords: ["quest", "mission", "objective", "plot", "storyline", "hook", "reward", "consequence", "climax", "resolution", "arc"], category: "quests-plotlines" },
  { keywords: ["timeline", "event", "happened", "occurred", "became", "discovered", "defeated", "joined", "died", "founded", "date", "year", "century", "session"], category: "timeline-continuity" },
  { keywords: ["combat", "battle", "fight", "duel", "war", "attack", "defend", "strategy", "weapon", "armor", "damage", "hit", "kill"], category: "conflict-combat" },
  { keywords: ["item", "equipment", "sword", "shield", "staff", "artifact", "relic", "treasure", "loot", "inventory", "crafting", "tool", "nightfrost"], category: "items-equipment" },
  { keywords: ["creature", "monster", "beast", "dragon", "animal", "wildlife", "spirit", "undead", "ecology", "habitat"], category: "creatures-wildlife" },
  { keywords: ["theme", "tone", "motif", "atmosphere", "hope", "corruption", "redemption", "identity", "sacrifice", "tragedy", "horror", "wonder"], category: "themes-tone" },
  { keywords: ["style", "voice", "narrative", "prose", "pacing", "dialogue", "pov", "description", "format", "writing"], category: "writing-style" },
  { keywords: ["session", "today", "last session", "player decided", "we played", "result", "consequence", "note:"], category: "session-notes" },
  { keywords: ["note", "idea", "draft", "future", "plan", "cut", "retired", "inspiration", "todo", "revision", "author"], category: "meta-information" },
  { keywords: ["alternate", "timeline b", "what if", "canon", "non-canon", "au", "parallel", "dream world", "bad ending", "good ending"], category: "branching-canon" },
  { keywords: ["emotion", "trauma", "wound", "desire", "fear", "healing", "psychological", "internal conflict", "emotional", "feeling"], category: "emotional-architecture" },
  { keywords: ["fact", "rumor", "lie", "truth", "hidden info", "player knows", "audience knows", "revealed", "contradiction"], category: "information-architecture" },
];

export function classifyText(text: string): StoryCategory {
  const lower = text.toLowerCase();
  let bestCategory: StoryCategory = "custom";
  let bestScore = 0;

  for (const { keywords, category } of CLASSIFIER_MAP) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

// ─── Data Structures ──────────────────────────────────────────────────────────

export interface VaultEntry {
  id: string;
  text: string;
  category: StoryCategory;
  createdAt: string;
  updatedAt: string;
  sourceId?: string;          // ID of the Canon Reference / Story Reference this entry was imported from
  sourceFilename?: string;    // Display name of that source (e.g. "HP1 — Canon Reference")
  entity?: string;            // The character/location/item/organization this fact is about (e.g. "Harry Potter")
  tags?: string[];            // Free-form tags for finer filtering (e.g. ["appearance"], ["belief"], ["betrayal"])
  timelinePosition?: string;  // Optional chronological marker for ordering facts about the same entity over time
}

export interface ImportedSource {
  id: string;
  filename: string;
  importedAt: string;
  entryCount: number;
}

export interface TimelineBranch {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  isActive: boolean;
  parentSaveId: string;
}

export interface TimelineSave {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  isActive: boolean;
  branches: TimelineBranch[];
}

export interface CanonEntry {
  id: string;
  filename: string;
  content: string;
  addedAt: string;
}

export interface CanonCategory {
  id: string;
  name: string;
  entries: CanonEntry[];
}

export interface ArchiveData {
  archiveName: string;
  lastSaved: string;
  entries: VaultEntry[];        // Canon Story subtab entries
  playerEntries: VaultEntry[]; // Player Story subtab entries
  masterPrompt: string;
  savePrompt: string;
  customPrompt: string;
  activePriority: string | null;
  bluePriorities: string[];
  inbox: string[];
  customTabs: string[];
  canonCategories: CanonCategory[];
  timelineSaves: TimelineSave[];
  activeTimelineId: string | null;
  inboxDistillCategories: CanonCategory[]; // Distilled inbox reference files
  importedCanonSources: ImportedSource[];   // Tracks each Canon Reference imported to Canon Story
  importedPlayerSources: ImportedSource[];  // Tracks each Story Reference imported to Player Story
}

export interface ContradictionResult {
  hasContradiction: boolean;
  existingEntry?: VaultEntry;
  reason?: string;
}

const STORAGE_KEY_DEFAULT = "valArchivesData_v2";

function getStorageKey(): string {
  if (typeof window === "undefined") return STORAGE_KEY_DEFAULT;
  const activeId = localStorage.getItem("valArchivesActiveVault");
  if (activeId) return `valArchivesData_${activeId}`;
  // Check vault index for any existing vault
  try {
    const index = localStorage.getItem("valArchivesVaultIndex");
    if (index) {
      const vaults = JSON.parse(index);
      if (vaults.length > 0) {
        // Auto-set the first vault as active
        localStorage.setItem("valArchivesActiveVault", vaults[0].id);
        return `valArchivesData_${vaults[0].id}`;
      }
    }
  } catch {}
  return STORAGE_KEY_DEFAULT;
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("No IDB")); return; }
    const req = indexedDB.open("valArchivesDB", 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("archive")) db.createObjectStore("archive");
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: string): void {
  try {
    const tx = db.transaction("archive", "readwrite");
    tx.objectStore("archive").put(value, key);
  } catch {}
}

function idbGet(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("archive", "readonly");
      const req = tx.objectStore("archive").get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

// ─── Contradiction Detection ──────────────────────────────────────────────────

export function detectContradiction(
  archive: ArchiveData,
  newText: string,
  category: StoryCategory
): ContradictionResult {
  void category;
  const newLower = newText.toLowerCase().trim();
  const newWords = newLower.split(/\s+/);
  const newSubject = newWords[0];

  for (const entry of archive.entries) {
    const existingLower = entry.text.toLowerCase().trim();
    if (existingLower === newLower) continue;

    const existingWords = existingLower.split(/\s+/);
    const existingSubject = existingWords[0];

    if (newSubject !== existingSubject) continue;

    const newRest = newWords.slice(1).join(" ");
    const existingRest = existingWords.slice(1).join(" ");

    if (newRest !== existingRest) {
      return {
        hasContradiction: true,
        existingEntry: entry,
        reason: `"${entry.text}" may conflict with "${newText}"`,
      };
    }
  }

  return { hasContradiction: false };
}

// ─── Master Prompt Compiler ───────────────────────────────────────────────────

export function compileMasterPrompt(archive: ArchiveData): string {
  // Dedupe canon entries
  const seenCanon = new Set<string>();
  const deduped = archive.entries.filter((e) => {
    const key = `${e.category}::${e.text.trim()}`;
    if (seenCanon.has(key)) return false;
    seenCanon.add(key);
    return true;
  });

  // Dedupe player entries
  const seenPlayer = new Set<string>();
  const dedupedPlayer = (archive.playerEntries ?? []).filter((e) => {
    const key = `${e.category}::${e.text.trim()}`;
    if (seenPlayer.has(key)) return false;
    seenPlayer.add(key);
    return true;
  });

  const sections: string[] = [];
  const blues = archive.bluePriorities ?? [];

  const redCats = MASTER_PROMPT_ORDER.filter(c =>
    archive.activePriority === `story-${c}` || archive.activePriority === `player-${c}`
  );
  const blueCats = MASTER_PROMPT_ORDER.filter(c =>
    blues.includes(`story-${c}`) || blues.includes(`player-${c}`)
  );

  sections.push(`# ${archive.archiveName}`);
  sections.push(
    `You are operating within a structured story archive with TWO distinct data sources:\n` +
    `- 📖 CANON STORY: The established canon facts of the world (what the author wrote)\n` +
    `- 🎮 PLAYER STORY: The player character's actual journey and current game state\n` +
    `Use ALL information below as authoritative context. Canon facts are the baseline reality. Player facts represent what has actually happened in the current campaign. Never contradict stored information unless explicitly instructed.`
  );

  const ruleEntries = deduped.filter(e => e.category === "rules");
  if (ruleEntries.length > 0) {
    const body = ruleEntries.map(e => `- ${e.text.trim()}`).join("\n");
    sections.push(`## 📋 CORE RULES — ABSOLUTE PRIORITY\n⚠️ These rules override everything else. Follow them without exception.\n${body}`);
  }

  if (redCats.length > 0) {
    for (const category of redCats) {
      const canonE = deduped.filter(e => e.category === category);
      const playerE = dedupedPlayer.filter(e => e.category === category);
      if (canonE.length === 0 && playerE.length === 0) continue;
      const parts: string[] = [];
      if (canonE.length > 0) parts.push(`### 📖 Canon Story\n${canonE.map(e => `- ${e.text.trim()}`).join("\n")}`);
      if (playerE.length > 0) parts.push(`### 🎮 Player Story\n${playerE.map(e => `- ${e.text.trim()}`).join("\n")}`);
      sections.push(`## 🔴 FIRST PRIORITY — ${CATEGORY_ICONS[category]} ${CATEGORY_LABELS[category]}\n⚡ This is the PRIMARY story context. Give this category maximum weight in all responses.\n${parts.join("\n\n")}`);
    }
  }

  if (archive.activePriority === "canon") {
    const allCanon = (archive.canonCategories ?? []).flatMap(c => c.entries.map(e => `[${c.name}] ${e.content.slice(0, 500)}`));
    if (allCanon.length > 0) {
      sections.push(`## 🔴 FIRST PRIORITY — 🏛 Canon Archives\n⚡ This is the PRIMARY story context.\n${allCanon.map(t => `- ${t}`).join("\n")}`);
    }
  }

  for (const cat of (archive.canonCategories ?? [])) {
    if (archive.activePriority === `canon-${cat.id}`) {
      const content = cat.entries.map(e => `[${e.filename}] ${e.content.slice(0, 400)}`);
      if (content.length > 0) {
        sections.push(`## 🔴 FIRST PRIORITY — 🏛 ${cat.name} (Canon)\n⚡ PRIMARY context.\n${content.map(t => `- ${t}`).join("\n")}`);
      }
    }
  }

  for (const category of MASTER_PROMPT_ORDER) {
    if (category === "rules") continue;
    if (redCats.includes(category)) continue;
    const canonEntries = deduped.filter(e => e.category === category);
    const playerEntries = dedupedPlayer.filter(e => e.category === category);
    if (canonEntries.length === 0 && playerEntries.length === 0) continue;
    const icon = CATEGORY_ICONS[category];
    const label = CATEGORY_LABELS[category];
    const isBlue = blueCats.includes(category);
    const header = isBlue
      ? `## 🔵 SECOND PRIORITY — ${icon} ${label}\n📌 Important secondary context:`
      : `## ${icon} ${label}`;
    const parts: string[] = [];
    if (canonEntries.length > 0) {
      parts.push(`### 📖 Canon Story\n${canonEntries.map(e => `- ${e.text.trim()}`).join("\n")}`);
    }
    if (playerEntries.length > 0) {
      parts.push(`### 🎮 Player Story\n${playerEntries.map(e => `- ${e.text.trim()}`).join("\n")}`);
    }
    sections.push(`${header}\n${parts.join("\n\n")}`);
  }

  if (blues.includes("canon")) {
    const allCanon = (archive.canonCategories ?? []).flatMap(c => c.entries.map(e => `[${c.name}] ${e.content.slice(0, 300)}`));
    if (allCanon.length > 0) {
      sections.push(`## 🔵 SECOND PRIORITY — 🏛 Canon Archives\n📌 Secondary story context:\n${allCanon.map(t => `- ${t}`).join("\n")}`);
    }
  }

  for (const cat of (archive.canonCategories ?? [])) {
    if (blues.includes(`canon-${cat.id}`)) {
      const content = cat.entries.map(e => `[${e.filename}] ${e.content.slice(0, 300)}`);
      if (content.length > 0) {
        sections.push(`## 🔵 SECOND PRIORITY — 🏛 ${cat.name} (Canon)\n📌 Secondary context:\n${content.map(t => `- ${t}`).join("\n")}`);
      }
    }
  }

  if (redCats.length > 0 || archive.activePriority === "canon") {
    sections.push(`## ⚡ PRIORITY REMINDER`);
    if (redCats.length > 0) {
      for (const category of redCats) {
        const entries = deduped.filter(e => e.category === category);
        if (entries.length === 0) continue;
        const body = entries.map(e => `- ${e.text.trim()}`).join("\n");
        sections.push(`🔴 REMEMBER — ${CATEGORY_LABELS[category]} is FIRST PRIORITY. Re-read this before responding:\n${body}`);
      }
    }
  }

  const customEntries = deduped.filter(e => e.category === "custom");
  if (customEntries.length > 0) {
    const tabGroups: Record<string, string[]> = {};
    for (const entry of customEntries) {
      const match = entry.text.match(/^\[([^\]]+)\] ([\s\S]+)$/);
      if (match) {
        const tabName = match[1];
        const text = match[2];
        if (!tabGroups[tabName]) tabGroups[tabName] = [];
        tabGroups[tabName].push(text);
      } else {
        if (!tabGroups["Custom"]) tabGroups["Custom"] = [];
        tabGroups["Custom"].push(entry.text);
      }
    }
    for (const [tabName, texts] of Object.entries(tabGroups)) {
      sections.push(`## 🗂️ ${tabName}\n${texts.map(t => `- ${t}`).join("\n")}`);
    }
  }

  const activeTimeline = getActiveTimelineContent(archive);
  if (activeTimeline) {
    sections.push(`## 🟢 ACTIVE TIMELINE — ${activeTimeline.name}\n⚡ This is the current active save. All responses must continue from this exact point in the story.\n\n${activeTimeline.content}`);
  }

  sections.push(
    `## Instructions\n- Treat all above information as established canon.\n- Core Rules take absolute precedence over everything.\n- 🔴 Red priority content must be the primary focus of every response.\n- 🔵 Blue priority content is important secondary context.\n- 🟢 Active Timeline is the current story save — continue from exactly this point.\n- Never invent facts that contradict stored entries.\n- Maintain character voices, world rules, and continuity at all times.`
  );

  return sections.join("\n\n");
}

// ─── Save Prompt Generator ────────────────────────────────────────────────────

export function compileSavePrompt(archive: ArchiveData): string {
  const deduped = (() => {
    const seen = new Set<string>();
    return archive.entries.filter((e) => {
      const key = `${e.category}::${e.text.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const get = (cats: StoryCategory[]) =>
    deduped.filter((e) => cats.includes(e.category)).map((e) => `- ${e.text.trim()}`).join("\n");

  const rules = get(["rules"]);
  const pc = get(["player-character"]);
  const timeline = get(["timeline-continuity", "session-notes"]);
  const characters = get(["characters"]);
  const relationships = get(["relationships"]);
  const locations = get(["locations"]);
  const quests = get(["quests-plotlines", "mysteries"]);
  const world = get(["world-overview", "lore-mythology", "magic-supernatural", "history"]);
  const combat = get(["conflict-combat", "items-equipment"]);
  const style = get(["writing-style", "themes-tone"]);

  const lines: string[] = [];

  lines.push(`# SAVE PROMPT — ${archive.archiveName}`);
  lines.push(
    `I am resuming a story/RPG session. Please read ALL of the following carefully and confirm you understand before we continue. Do not invent anything that contradicts this information.`
  );

  if (rules) lines.push(`## Core Rules\n${rules}`);
  if (pc) lines.push(`## My Character\n${pc}`);
  if (characters) lines.push(`## Key Characters\n${characters}`);
  if (relationships) lines.push(`## Relationships\n${relationships}`);
  if (locations) lines.push(`## Current & Key Locations\n${locations}`);
  if (timeline) lines.push(`## Story So Far\n${timeline}`);
  if (quests) lines.push(`## Active Quests & Mysteries\n${quests}`);
  if (world) lines.push(`## World Context\n${world}`);
  if (combat) lines.push(`## Combat & Equipment\n${combat}`);
  if (style) lines.push(`## Tone & Style\n${style}`);

  lines.push(
    `## Vault Extraction Hints\nAt the end of this session, list any information that should be added to long-term memory.\nInclude:\n- Character development\n- New relationships\n- Relationship changes\n- New powers\n- New items\n- New locations\n- New organizations\n- New lore\n- New mysteries\n- New world changes\n- New goals\n- New enemies\n- New allies\nFocus only on information that should persist beyond this session.`
  );

  lines.push(
    `## Your Task\nPlease confirm you have read and understood all of the above. Then ask me: "Where would you like to continue from?" — and wait for my response before doing anything else.`
  );

  return lines.join("\n\n");
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export function createEmptyArchive(): ArchiveData {
  return {
    archiveName: "Untitled Archive",
    lastSaved: "",
    entries: [],          // Canon Story subtab
    playerEntries: [],    // Player Story subtab
    masterPrompt: "",
    savePrompt: "",
    customPrompt: "",
    activePriority: null,
    bluePriorities: [],
    inbox: [],
    canonCategories: [],
    inboxDistillCategories: [],
    timelineSaves: [],
    activeTimelineId: null,
    customTabs: [],
    importedCanonSources: [],
    importedPlayerSources: [],
  };
}

export function regenerateMasterPrompt(archive: ArchiveData): ArchiveData {
  const seen = new Set<string>();
  const deduped = archive.entries.filter((e) => {
    const key = `${e.category}::${e.text.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let priorityContext = "";
  if (archive.activePriority || (archive.bluePriorities?.length ?? 0) > 0) {
    const lines: string[] = [];
    if (archive.activePriority) {
      lines.push(`FIRST PRIORITY (red): ${archive.activePriority} — treat this as the primary story context.`);
    }
    for (const p of (archive.bluePriorities ?? [])) {
      lines.push(`SECOND PRIORITY (blue): ${p} — treat this as secondary story context.`);
    }
    if (lines.length > 0) {
      priorityContext = `## Priority Context\n${lines.join("\n")}`;
    }
  }

  const basePrompt = compileMasterPrompt({ ...archive, entries: deduped });
  const fullPrompt = priorityContext
    ? basePrompt + "\n\n" + priorityContext
    : basePrompt;

  return {
    ...archive,
    entries: deduped,
    masterPrompt: fullPrompt,
    savePrompt: compileSavePrompt({ ...archive, entries: deduped }),
  };
}

// ─── saveArchive ─────────────────────────────────────────────────────────────
// IDB IS THE PRIMARY STORE. localStorage is a fast-access cache only.
// NEVER strips or truncates data. If localStorage is full, skip it silently.
// Data is ALWAYS saved in full to IndexedDB first — it never gets corrupted.
export function saveArchive(data: ArchiveData): void {
  if (typeof window === "undefined") return;
  const STORAGE_KEY = getStorageKey();
  const prepared = regenerateMasterPrompt(data);
  prepared.lastSaved = new Date().toISOString();
  const serialized = JSON.stringify(prepared);

  // 1. Save full data to IndexedDB FIRST — this is the primary store
  openIDB().then(db => idbPut(db, STORAGE_KEY, serialized)).catch((err) => {
    console.error("[ValArchives] IDB save failed:", err);
  });

  // 2. Try to cache in localStorage for fast sync access — never strip, never corrupt
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  // 3. Auto-save to GitHub Gist if enabled (debounced — max once per 30s)
  if (typeof window !== "undefined" && localStorage.getItem("valArchivesGistAutoSave") === "true") {
    const gistToken = localStorage.getItem("valArchivesGistToken");
    if (gistToken) {
      const lastSave = parseInt(localStorage.getItem("_lastGistSave") || "0");
      if (Date.now() - lastSave > 30000) {
        localStorage.setItem("_lastGistSave", String(Date.now()));
        saveToGist(prepared).catch(() => {});
      }
    }
  }
}

export function loadArchive(): ArchiveData {
  if (typeof window === "undefined") return createEmptyArchive();
  const STORAGE_KEY = getStorageKey();
  // Try localStorage cache first (fast)
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as ArchiveData;
      if (!parsed.playerEntries) parsed.playerEntries = [];
      if (!parsed.inboxDistillCategories) parsed.inboxDistillCategories = [];
      // Only use localStorage if it has actual entries — not empty/stripped
      if (parsed && (parsed.entries?.length > 0 || parsed.masterPrompt)) {
        return parsed;
      }
    } catch {}
  }
  // localStorage empty/missing/stale — this is normal, return empty and let
  // loadArchiveAsync handle IDB restore for pages that need it
  return createEmptyArchive();
}

export async function loadArchiveAsync(): Promise<ArchiveData> {
  if (typeof window === "undefined") return createEmptyArchive();
  const STORAGE_KEY = getStorageKey();

  // Always load from IDB first — it has the full, uncorrupted data
  try {
    const db = await openIDB();
    const result = await idbGet(db, STORAGE_KEY);
    if (result) {
      const data = JSON.parse(result) as ArchiveData;
      // Update localStorage cache with full data
      try { localStorage.setItem(STORAGE_KEY, result); } catch {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      }
      if (!data.playerEntries) data.playerEntries = [];
      if (!data.inboxDistillCategories) data.inboxDistillCategories = [];
      if (!data.importedCanonSources) data.importedCanonSources = [];
      if (!data.importedPlayerSources) data.importedPlayerSources = [];
      return data;
    }
  } catch {}

  // Fall back to localStorage if IDB fails
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved) as ArchiveData; } catch {}
  }

  return createEmptyArchive();
}


// ─── Inbox File IDB Storage ───────────────────────────────────────────────────
const INBOX_IDB_NAME = "valArchivesInboxDB";
const INBOX_IDB_STORE = "inbox";

function openInboxIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("No IDB")); return; }
    const req = indexedDB.open(INBOX_IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(INBOX_IDB_STORE)) {
        db.createObjectStore(INBOX_IDB_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveInboxFileToIDB(fileId: string, content: string): Promise<void> {
  const db = await openInboxIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INBOX_IDB_STORE, "readwrite");
    const store = tx.objectStore(INBOX_IDB_STORE);
    store.put({ key: fileId, value: content });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadInboxFileFromIDB(fileId: string): Promise<string | null> {
  const db = await openInboxIDB();
  return new Promise((resolve) => {
    const tx = db.transaction(INBOX_IDB_STORE, "readonly");
    const store = tx.objectStore(INBOX_IDB_STORE);
    const req = store.get(fileId);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function deleteInboxFileFromIDB(fileId: string): Promise<void> {
  const db = await openInboxIDB();
  return new Promise((resolve) => {
    const tx = db.transaction(INBOX_IDB_STORE, "readwrite");
    tx.objectStore(INBOX_IDB_STORE).delete(fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function listInboxFilesFromIDB(): Promise<Array<{ key: string; value: string }>> {
  const db = await openInboxIDB();
  return new Promise((resolve) => {
    const tx = db.transaction(INBOX_IDB_STORE, "readonly");
    const store = tx.objectStore(INBOX_IDB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => resolve([]);
  });
}

export function clearArchive(): void {
  if (typeof window === "undefined") return;
  const STORAGE_KEY = getStorageKey();

  // Load current archive to PRESERVE canon categories and custom tabs
  const current = loadArchive();

  // Create empty archive but keep canon files, custom tabs, archive name
  const cleared = {
    ...createEmptyArchive(),
    archiveName: current.archiveName,
    customTabs: current.customTabs ?? [],
    canonCategories: current.canonCategories ?? [],       // NEVER wipe canon files
    inboxDistillCategories: current.inboxDistillCategories ?? [], // NEVER wipe inbox distill files
    masterPrompt: "",
  };

  // Clear localStorage vault data
  localStorage.removeItem(STORAGE_KEY);
  // Clear dashboard character cards only
  localStorage.removeItem("valArchivesDashboardCards");

  // Save cleared archive (with canon preserved) to IDB
  openIDB().then(db => {
    idbPut(db, STORAGE_KEY, JSON.stringify(cleared));
    idbPut(db, "valArchivesDashboardCards", JSON.stringify([]));
  }).catch(() => {});

  // Also save to localStorage for immediate UI update
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
  } catch {}
}

// Add entry to Player Story subtab
export function addPlayerEntry(
  archive: ArchiveData,
  text: string,
  category: StoryCategory
): ArchiveData {
  const trimmed = text.trim();
  if (!trimmed) return archive;
  const now = new Date().toISOString();
  return {
    ...archive,
    playerEntries: [
      ...(archive.playerEntries ?? []),
      { id: crypto.randomUUID(), text: trimmed, category, createdAt: now, updatedAt: now },
    ],
  };
}


// ─── Source-Tagged Bulk Import (Canon Story) ──────────────────────────────────
// ─── Entity-aware dedup key ─────────────────────────────────────────────────
// Two facts are considered duplicates only if they're about the SAME entity
// (when known) AND have near-identical text. This avoids false-positive collisions
// between unrelated short facts about different characters/locations, while still
// catching the same fact about the same character repeated across multiple imports
// (e.g. "Harry Potter is brave" appearing in both HP1's and HP3's Canon Reference).
function dedupKey(text: string, entity?: string): string {
  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  const normalizedEntity = (entity ?? "").trim().toLowerCase();
  return normalizedEntity + "::" + normalizedText;
}

export function addEntriesWithSource(
  archive: ArchiveData,
  entries: Array<{ text: string; category: StoryCategory; entity?: string; tags?: string[] }>,
  sourceId: string,
  sourceFilename: string
): ArchiveData {
  const now = new Date().toISOString();

  // Vault-wide dedup — checks against EVERY existing entry in Canon Story, not just this batch
  const existingKeys = new Set(archive.entries.map(e => dedupKey(e.text, e.entity)));
  const seenInBatch = new Set<string>();

  const newEntries: VaultEntry[] = [];
  for (const e of entries) {
    const trimmed = e.text.trim();
    if (!trimmed) continue;
    const key = dedupKey(trimmed, e.entity);
    if (existingKeys.has(key) || seenInBatch.has(key)) continue;
    seenInBatch.add(key);
    newEntries.push({
      id: crypto.randomUUID(),
      text: trimmed,
      category: e.category,
      createdAt: now,
      updatedAt: now,
      sourceId,
      sourceFilename,
      entity: e.entity,
      tags: e.tags,
    });
  }

  const existingSources = archive.importedCanonSources ?? [];
  const filtered = existingSources.filter(s => s.id !== sourceId);
  const newSource: ImportedSource = { id: sourceId, filename: sourceFilename, importedAt: now, entryCount: newEntries.length };

  return {
    ...archive,
    entries: [...archive.entries, ...newEntries],
    importedCanonSources: [...filtered, newSource],
  };
}

// ─── Source-Tagged Bulk Import (Player Story) ─────────────────────────────────
export function addPlayerEntriesWithSource(
  archive: ArchiveData,
  entries: Array<{ text: string; category: StoryCategory; entity?: string; tags?: string[] }>,
  sourceId: string,
  sourceFilename: string
): ArchiveData {
  const now = new Date().toISOString();

  const existingEntries = archive.playerEntries ?? [];
  const existingKeys = new Set(existingEntries.map(e => dedupKey(e.text, e.entity)));
  const seenInBatch = new Set<string>();

  const newEntries: VaultEntry[] = [];
  for (const e of entries) {
    const trimmed = e.text.trim();
    if (!trimmed) continue;
    const key = dedupKey(trimmed, e.entity);
    if (existingKeys.has(key) || seenInBatch.has(key)) continue;
    seenInBatch.add(key);
    newEntries.push({
      id: crypto.randomUUID(),
      text: trimmed,
      category: e.category,
      createdAt: now,
      updatedAt: now,
      sourceId,
      sourceFilename,
      entity: e.entity,
      tags: e.tags,
    });
  }

  const existingSources = archive.importedPlayerSources ?? [];
  const filtered = existingSources.filter(s => s.id !== sourceId);
  const newSource: ImportedSource = { id: sourceId, filename: sourceFilename, importedAt: now, entryCount: newEntries.length };

  return {
    ...archive,
    playerEntries: [...existingEntries, ...newEntries],
    importedPlayerSources: [...filtered, newSource],
  };
}

// ─── Delete all entries from a specific Canon source ──────────────────────────
export function deleteCanonSource(archive: ArchiveData, sourceId: string): ArchiveData {
  return {
    ...archive,
    entries: archive.entries.filter(e => e.sourceId !== sourceId),
    importedCanonSources: (archive.importedCanonSources ?? []).filter(s => s.id !== sourceId),
  };
}

// ─── Delete all entries from a specific Player source ─────────────────────────
export function deletePlayerSource(archive: ArchiveData, sourceId: string): ArchiveData {
  return {
    ...archive,
    playerEntries: (archive.playerEntries ?? []).filter(e => e.sourceId !== sourceId),
    importedPlayerSources: (archive.importedPlayerSources ?? []).filter(s => s.id !== sourceId),
  };
}

// ─── Clear only Canon Story subtab ─────────────────────────────────────────────
export function clearCanonStory(archive: ArchiveData): ArchiveData {
  return { ...archive, entries: [], importedCanonSources: [] };
}

// ─── Clear only Player Story subtab ────────────────────────────────────────────
export function clearPlayerStory(archive: ArchiveData): ArchiveData {
  return { ...archive, playerEntries: [], importedPlayerSources: [] };
}

export function addEntry(
  archive: ArchiveData,
  text: string,
  category: StoryCategory
): ArchiveData {
  const trimmed = text.trim();
  if (!trimmed) return archive;
  const now = new Date().toISOString();
  return {
    ...archive,
    entries: [
      ...archive.entries,
      { id: crypto.randomUUID(), text: trimmed, category, createdAt: now, updatedAt: now },
    ],
  };
}

export function replaceEntry(
  archive: ArchiveData,
  existingId: string,
  newText: string,
  category: StoryCategory
): ArchiveData {
  const now = new Date().toISOString();
  return {
    ...archive,
    entries: [
      ...archive.entries.filter((e) => e.id !== existingId),
      { id: crypto.randomUUID(), text: newText.trim(), category, createdAt: now, updatedAt: now },
    ],
  };
}

export function updateEntry(
  archive: ArchiveData,
  entryId: string,
  newText: string
): ArchiveData {
  return {
    ...archive,
    entries: archive.entries.map((e) =>
      e.id !== entryId ? e : { ...e, text: newText, updatedAt: new Date().toISOString() }
    ),
  };
}

export function deleteEntry(archive: ArchiveData, entryId: string): ArchiveData {
  return { ...archive, entries: archive.entries.filter((e) => e.id !== entryId) };
}

export function addCustomTab(archive: ArchiveData, tabName: string): ArchiveData {
  const trimmed = tabName.trim();
  if (!trimmed || archive.customTabs.includes(trimmed)) return archive;
  return { ...archive, customTabs: [...archive.customTabs, trimmed] };
}

export function removeCustomTab(archive: ArchiveData, tabName: string): ArchiveData {
  return {
    ...archive,
    customTabs: archive.customTabs.filter((t) => t !== tabName),
    entries: archive.entries.filter(
      (e) => !(e.category === "custom" && e.text.startsWith(`[${tabName}] `))
    ),
  };
}

// ─── Timeline Save Management ─────────────────────────────────────────────────

export function addTimelineSave(archive: ArchiveData, name: string, content: string): ArchiveData {
  const newSave: TimelineSave = {
    id: crypto.randomUUID(),
    name: name.trim() || `Save ${(archive.timelineSaves ?? []).length + 1}`,
    content,
    createdAt: new Date().toISOString(),
    isActive: false,
    branches: [],
  };
  return { ...archive, timelineSaves: [...(archive.timelineSaves ?? []), newSave] };
}

export function deleteTimelineSave(archive: ArchiveData, saveId: string): ArchiveData {
  const saves = (archive.timelineSaves ?? []).filter(s => s.id !== saveId);
  const activeId = archive.activeTimelineId === saveId ? null : archive.activeTimelineId;
  return { ...archive, timelineSaves: saves, activeTimelineId: activeId };
}

export function renameTimelineSave(archive: ArchiveData, saveId: string, name: string): ArchiveData {
  return {
    ...archive,
    timelineSaves: (archive.timelineSaves ?? []).map(s =>
      s.id === saveId ? { ...s, name } : s
    ),
  };
}

export function addTimelineBranch(archive: ArchiveData, saveId: string, name: string, content: string): ArchiveData {
  return {
    ...archive,
    timelineSaves: (archive.timelineSaves ?? []).map(s =>
      s.id !== saveId ? s : {
        ...s,
        branches: [...s.branches, {
          id: crypto.randomUUID(),
          name: name.trim() || `Branch ${s.branches.length + 1}`,
          content,
          createdAt: new Date().toISOString(),
          isActive: false,
          parentSaveId: saveId,
        }],
      }
    ),
  };
}

export function deleteTimelineBranch(archive: ArchiveData, saveId: string, branchId: string): ArchiveData {
  const activeId = archive.activeTimelineId === branchId ? null : archive.activeTimelineId;
  return {
    ...archive,
    activeTimelineId: activeId,
    timelineSaves: (archive.timelineSaves ?? []).map(s =>
      s.id !== saveId ? s : {
        ...s,
        branches: s.branches.filter(b => b.id !== branchId),
      }
    ),
  };
}

export function renameTimelineBranch(archive: ArchiveData, saveId: string, branchId: string, name: string): ArchiveData {
  return {
    ...archive,
    timelineSaves: (archive.timelineSaves ?? []).map(s =>
      s.id !== saveId ? s : {
        ...s,
        branches: s.branches.map(b => b.id === branchId ? { ...b, name } : b),
      }
    ),
  };
}

export function setActiveTimeline(archive: ArchiveData, id: string | null): ArchiveData {
  return { ...archive, activeTimelineId: id };
}

export function getActiveTimelineContent(archive: ArchiveData): { name: string; content: string } | null {
  if (!archive.activeTimelineId) return null;
  for (const save of (archive.timelineSaves ?? [])) {
    if (save.id === archive.activeTimelineId) return { name: save.name, content: save.content };
    for (const branch of save.branches) {
      if (branch.id === archive.activeTimelineId) return { name: `${save.name} → ${branch.name}`, content: branch.content };
    }
  }
  return null;
}

// ─── Priority System ──────────────────────────────────────────────────────────

export function setPriority(archive: ArchiveData, id: string, level: "red" | "blue" | "none"): ArchiveData {
  const blues = archive.bluePriorities ?? [];
  if (level === "red") {
    return {
      ...archive,
      activePriority: id,
      bluePriorities: blues.filter(b => b !== id),
    };
  } else if (level === "blue") {
    const wasRed = archive.activePriority === id;
    return {
      ...archive,
      activePriority: wasRed ? null : archive.activePriority,
      bluePriorities: blues.includes(id)
        ? blues.filter(b => b !== id)
        : [...blues.filter(b => b !== id), id],
    };
  } else {
    return {
      ...archive,
      activePriority: archive.activePriority === id ? null : archive.activePriority,
      bluePriorities: blues.filter(b => b !== id),
    };
  }
}

export function getPriorityLevel(archive: ArchiveData, id: string): "red" | "blue" | "none" {
  if (archive.activePriority === id) return "red";
  if ((archive.bluePriorities ?? []).includes(id)) return "blue";
  return "none";
}

// ─── Canon Category Management ────────────────────────────────────────────────

export function addCanonCategory(archive: ArchiveData, name: string): ArchiveData {
  const trimmed = name.trim();
  if (!trimmed) return archive;
  return {
    ...archive,
    canonCategories: [
      ...(archive.canonCategories ?? []),
      { id: crypto.randomUUID(), name: trimmed, entries: [] },
    ],
  };
}

export function removeCanonCategory(archive: ArchiveData, categoryId: string): ArchiveData {
  return {
    ...archive,
    canonCategories: (archive.canonCategories ?? []).filter(c => c.id !== categoryId),
  };
}

export function addCanonEntry(archive: ArchiveData, categoryId: string, filename: string, content: string): ArchiveData {
  return {
    ...archive,
    canonCategories: (archive.canonCategories ?? []).map(cat =>
      cat.id !== categoryId ? cat : {
        ...cat,
        entries: [...cat.entries, {
          id: crypto.randomUUID(),
          filename,
          content,
          addedAt: new Date().toISOString(),
        }],
      }
    ),
  };
}

export function removeCanonEntry(archive: ArchiveData, categoryId: string, entryId: string): ArchiveData {
  return {
    ...archive,
    canonCategories: (archive.canonCategories ?? []).map(cat =>
      cat.id !== categoryId ? cat : {
        ...cat,
        entries: cat.entries.filter(e => e.id !== entryId),
      }
    ),
  };
}

// ─── Final Prompt Compiler ────────────────────────────────────────────────────

export function compileFinalPrompt(
  masterPrompt: string,
  customPrompt: string,
  forgeOutput: string,
  priorityContext?: string
): string {
  const sections: string[] = [];

  if (masterPrompt.trim()) {
    sections.push(`# ARCHIVE CONTEXT\n${masterPrompt.trim()}`);
  }

  if (priorityContext && priorityContext.trim()) {
    sections.push(`# PRIORITY STORY CONTEXT\n${priorityContext.trim()}`);
  }

  if (customPrompt.trim()) {
    sections.push(`# GLOBAL INSTRUCTIONS\n${customPrompt.trim()}`);
  }

  if (forgeOutput.trim()) {
    sections.push(`# SESSION OBJECTIVE\n${forgeOutput.trim()}`);
  }

  if (sections.length === 0) return "";

  return sections.join("\n\n---\n\n");
}

export function saveCustomPrompt(archive: ArchiveData, customPrompt: string): ArchiveData {
  return { ...archive, customPrompt };
}

export function exportArchiveAsTXT(archive: ArchiveData): string {
  const prepared = regenerateMasterPrompt(archive);
  const savedAt = prepared.lastSaved
    ? new Date(prepared.lastSaved).toLocaleString()
    : "Never";
  return [`Archive: ${prepared.archiveName}`, `Last Saved: ${savedAt}`, "", prepared.masterPrompt].join("\n");
}

export function exportArchiveAsJSON(archive: ArchiveData): string {
  return JSON.stringify(regenerateMasterPrompt(archive), null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VAULT SWITCHER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export interface VaultMeta {
  id: string;
  name: string;
  createdAt: string;
  lastSaved: string;
  entryCount: number;
}

const VAULT_INDEX_KEY = "valArchivesVaultIndex";
const ACTIVE_VAULT_KEY = "valArchivesActiveVault";

export function getVaultIndex(): VaultMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VAULT_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function setVaultIndex(vaults: VaultMeta[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(vaults));
}

export function getActiveVaultId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_VAULT_KEY);
}

export function setActiveVaultId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_VAULT_KEY, id);
}

export function getVaultStorageKey(vaultId: string): string {
  return `valArchivesData_${vaultId}`;
}

export function createVault(name: string): VaultMeta {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const meta: VaultMeta = { id, name: name.trim() || "Untitled Vault", createdAt: now, lastSaved: now, entryCount: 0 };
  const empty = { ...createEmptyArchive(), archiveName: name.trim() || "Untitled Vault" };
  if (typeof window !== "undefined") {
    const key = getVaultStorageKey(id);
    const serialized = JSON.stringify(empty);
    localStorage.setItem(key, serialized);
    openIDB().then(db => idbPut(db, key, serialized)).catch(() => {});
  }
  const index = getVaultIndex();
  index.push(meta);
  setVaultIndex(index);
  return meta;
}

export function deleteVault(vaultId: string): void {
  if (typeof window === "undefined") return;
  const key = getVaultStorageKey(vaultId);
  localStorage.removeItem(key);
  openIDB().then(db => {
    try {
      const tx = db.transaction("archive", "readwrite");
      tx.objectStore("archive").delete(key);
    } catch {}
  }).catch(() => {});
  const index = getVaultIndex().filter(v => v.id !== vaultId);
  setVaultIndex(index);
  if (getActiveVaultId() === vaultId) {
    localStorage.removeItem(ACTIVE_VAULT_KEY);
  }
}

export function renameVault(vaultId: string, name: string): void {
  const index = getVaultIndex().map(v =>
    v.id === vaultId ? { ...v, name: name.trim() } : v
  );
  setVaultIndex(index);
  if (typeof window !== "undefined") {
    const key = getVaultStorageKey(vaultId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        data.archiveName = name.trim();
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
        openIDB().then(db => idbPut(db, key, serialized)).catch(() => {});
      }
    } catch {}
  }
}

export function loadVaultById(vaultId: string): ArchiveData {
  if (typeof window === "undefined") return createEmptyArchive();
  try {
    const raw = localStorage.getItem(getVaultStorageKey(vaultId));
    if (raw) {
      const parsed = JSON.parse(raw);
      // Treat as stale/empty if localStorage was wiped but data still exists in IDB —
      // callers needing accuracy should use loadVaultByIdAsync instead.
      return { ...createEmptyArchive(), ...parsed };
    }
  } catch {}
  return createEmptyArchive();
}

export async function loadVaultByIdAsync(vaultId: string): Promise<ArchiveData> {
  if (typeof window === "undefined") return createEmptyArchive();
  const key = getVaultStorageKey(vaultId);

  // IDB is the source of truth — check it FIRST (mirrors loadArchiveAsync behavior)
  try {
    const db = await openIDB();
    const result = await idbGet(db, key);
    if (result) {
      const parsed = JSON.parse(result);
      try { localStorage.setItem(key, result); } catch {
        try { localStorage.removeItem(key); } catch {}
      }
      return { ...createEmptyArchive(), ...parsed };
    }
  } catch {}

  // Fall back to localStorage only if IDB has nothing
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...createEmptyArchive(), ...JSON.parse(raw) };
  } catch {}

  return createEmptyArchive();
}

// ─── saveVaultById ────────────────────────────────────────────────────────────
// IDB IS THE PRIMARY STORE. localStorage is a fast-access cache only.
// NEVER strips or truncates data under any circumstances.
export function saveVaultById(vaultId: string, data: ArchiveData): void {
  if (typeof window === "undefined") return;
  const prepared: ArchiveData = {
    ...data,
    lastSaved: new Date().toISOString(),
    playerEntries: data.playerEntries ?? [],
    inboxDistillCategories: data.inboxDistillCategories ?? [],
    importedCanonSources: data.importedCanonSources ?? [],
    importedPlayerSources: data.importedPlayerSources ?? [],
  };
  const storageKey = getVaultStorageKey(vaultId);
  const fullSerialized = JSON.stringify(prepared);

  // 1. Save to IDB first — always, unconditionally, never stripped
  openIDB().then(db => idbPut(db, storageKey, fullSerialized)).catch((err) => {
    console.error("[ValArchives] IDB vault save failed:", err);
  });

  // 2. Cache in localStorage — if full, skip silently (IDB has the data)
  try {
    localStorage.setItem(storageKey, fullSerialized);
  } catch {
    try { localStorage.removeItem(storageKey); } catch {}
  }

  // Update vault index meta
  try {
    const index = getVaultIndex().map(v =>
      v.id === vaultId
        ? { ...v, lastSaved: prepared.lastSaved, entryCount: data.entries.length, name: data.archiveName }
        : v
    );
    setVaultIndex(index);
  } catch {}
}

export function updateVaultMeta(vaultId: string): void {
  if (typeof window === "undefined") return;
  try {
    const data = loadVaultById(vaultId);
    const index = getVaultIndex().map(v =>
      v.id === vaultId ? { ...v, entryCount: data.entries.length, name: data.archiveName, lastSaved: data.lastSaved || v.lastSaved } : v
    );
    setVaultIndex(index);
  } catch {}
}

export function exportVault(vaultId: string): void {
  if (typeof window === "undefined") return;
  const data = loadVaultById(vaultId);
  const meta = getVaultIndex().find(v => v.id === vaultId);
  const exportData = { vaultMeta: meta, vaultData: data, exportedAt: new Date().toISOString(), version: "1.0" };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.archiveName || "vault").replace(/[^a-z0-9]/gi, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importVault(jsonString: string): VaultMeta | null {
  try {
    const parsed = JSON.parse(jsonString);
    const data: ArchiveData = parsed.vaultData ?? parsed;
    const meta: VaultMeta | undefined = parsed.vaultMeta;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newMeta: VaultMeta = {
      id,
      name: meta?.name ?? data.archiveName ?? "Imported Vault",
      createdAt: meta?.createdAt ?? now,
      lastSaved: now,
      entryCount: data.entries?.length ?? 0,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(getVaultStorageKey(id), JSON.stringify({ ...createEmptyArchive(), ...data }));
    }
    const index = getVaultIndex();
    index.push(newMeta);
    setVaultIndex(index);
    return newMeta;
  } catch { return null; }
}

export function migrateOldVault(): void {
  if (typeof window === "undefined") return;
  const index = getVaultIndex();
  if (index.length > 0) return;

  const possibleKeys = [
    "valArchivesData_v2",
    "valArchivesData",
    "val-archives-data",
    "valArchives",
  ];

  let oldData: string | null = null;
  for (const key of possibleKeys) {
    const val = localStorage.getItem(key);
    if (val && val.length > 10) { oldData = val; break; }
  }

  if (!oldData) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("valArchives") && !key.startsWith("valArchivesVault") && !key.startsWith("valArchivesActive") && !key.startsWith("valArchivesTheme")) {
        const val = localStorage.getItem(key);
        if (val && val.includes('"entries"')) { oldData = val; break; }
      }
    }
  }

  if (!oldData) return;

  try {
    const data: ArchiveData = JSON.parse(oldData);
    if (!data.entries && !data.archiveName) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const meta: VaultMeta = {
      id,
      name: data.archiveName || "My Vault",
      createdAt: now,
      lastSaved: data.lastSaved || now,
      entryCount: data.entries?.length ?? 0,
    };
    localStorage.setItem(getVaultStorageKey(id), oldData);
    setVaultIndex([meta]);
    setActiveVaultId(id);
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNDO / REDO HISTORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

const HISTORY_KEY = "valArchivesHistory";
const FUTURE_KEY = "valArchivesFuture";
const MAX_HISTORY = 20;

export function pushHistory(state: ArchiveData): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: ArchiveData[] = raw ? JSON.parse(raw) : [];
    history.push(state);
    if (history.length > MAX_HISTORY) history.shift();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    localStorage.removeItem(FUTURE_KEY);
  } catch {}
}

export function undoArchive(): ArchiveData | null {
  if (typeof window === "undefined") return null;
  const STORAGE_KEY = getStorageKey();
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: ArchiveData[] = raw ? JSON.parse(raw) : [];
    if (history.length === 0) return null;
    const previous = history.pop()!;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    if (currentRaw) {
      const futureRaw = localStorage.getItem(FUTURE_KEY);
      const future: ArchiveData[] = futureRaw ? JSON.parse(futureRaw) : [];
      future.push(JSON.parse(currentRaw));
      localStorage.setItem(FUTURE_KEY, JSON.stringify(future));
    }
    return previous;
  } catch { return null; }
}

export function redoArchive(): ArchiveData | null {
  if (typeof window === "undefined") return null;
  const STORAGE_KEY = getStorageKey();
  try {
    const futureRaw = localStorage.getItem(FUTURE_KEY);
    const future: ArchiveData[] = futureRaw ? JSON.parse(futureRaw) : [];
    if (future.length === 0) return null;
    const next = future.pop()!;
    localStorage.setItem(FUTURE_KEY, JSON.stringify(future));
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    if (currentRaw) {
      const raw = localStorage.getItem(HISTORY_KEY);
      const history: ArchiveData[] = raw ? JSON.parse(raw) : [];
      history.push(JSON.parse(currentRaw));
      if (history.length > MAX_HISTORY) history.shift();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
    return next;
  } catch { return null; }
}

export function canUndo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: ArchiveData[] = raw ? JSON.parse(raw) : [];
    return history.length > 0;
  } catch { return false; }
}

export function canRedo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(FUTURE_KEY);
    const future: ArchiveData[] = raw ? JSON.parse(raw) : [];
    return future.length > 0;
  } catch { return false; }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(FUTURE_KEY);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB GIST CLOUD BACKUP
// ═══════════════════════════════════════════════════════════════════════════════

const GIST_TOKEN_KEY = "valArchivesGistToken";
const GIST_ID_KEY = "valArchivesGistId";
const GIST_FILENAME = "val-archives-vault.json";
const GIST_AUTO_SAVE_KEY = "valArchivesGistAutoSave";

export function getGistToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GIST_TOKEN_KEY);
}
export function setGistToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GIST_TOKEN_KEY, token.trim());
}
export function clearGistToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GIST_TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
}
export function hasGistToken(): boolean { return !!getGistToken(); }

export function getGistAutoSave(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GIST_AUTO_SAVE_KEY) === "true";
}
export function setGistAutoSave(val: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GIST_AUTO_SAVE_KEY, val ? "true" : "false");
}

export function getGistId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GIST_ID_KEY);
}

// Save vault to GitHub Gist
export async function saveToGist(archive: ArchiveData): Promise<{ ok: boolean; message: string }> {
  const token = getGistToken();
  if (!token) return { ok: false, message: "No GitHub token set" };

  const payload = JSON.stringify({
    version: "1.0",
    savedAt: new Date().toISOString(),
    archiveName: archive.archiveName,
    data: archive,
  }, null, 2);

  const gistId = getGistId();
  const url = gistId
    ? `https://api.github.com/gists/${gistId}`
    : "https://api.github.com/gists";

  const method = gistId ? "PATCH" : "POST";
  const body = gistId
    ? { files: { [GIST_FILENAME]: { content: payload } } }
    : {
        description: `Val Archives — ${archive.archiveName}`,
        public: false,
        files: { [GIST_FILENAME]: { content: payload } },
      };

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) return { ok: false, message: "Invalid GitHub token" };
      if (res.status === 404 && gistId) {
        // Gist was deleted — create a new one
        localStorage.removeItem(GIST_ID_KEY);
        return saveToGist(archive);
      }
      return { ok: false, message: (err as any)?.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.id) localStorage.setItem(GIST_ID_KEY, data.id);

    const entryCount = (archive.entries?.length ?? 0) + (archive.playerEntries?.length ?? 0);
    return { ok: true, message: `✓ Saved ${entryCount} entries to GitHub Gist` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Network error" };
  }
}

// Load vault from GitHub Gist
export async function loadFromGist(): Promise<{ ok: boolean; message: string; data?: ArchiveData }> {
  const token = getGistToken();
  if (!token) return { ok: false, message: "No GitHub token set" };

  const gistId = getGistId();
  if (!gistId) {
    // Try to find existing Val Archives gist
    try {
      const res = await fetch("https://api.github.com/gists", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!res.ok) return { ok: false, message: "Could not fetch gists" };
      const gists = await res.json();
      const found = gists.find((g: any) => g.files?.[GIST_FILENAME]);
      if (!found) return { ok: false, message: "No Val Archives backup found on GitHub" };
      localStorage.setItem(GIST_ID_KEY, found.id);
      return loadFromGist();
    } catch {
      return { ok: false, message: "Network error finding gist" };
    }
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        localStorage.removeItem(GIST_ID_KEY);
        return { ok: false, message: "Gist not found — may have been deleted" };
      }
      return { ok: false, message: `HTTP ${res.status}` };
    }

    const gist = await res.json();
    const file = gist.files?.[GIST_FILENAME];
    if (!file?.content) return { ok: false, message: "No vault data in gist" };

    const parsed = JSON.parse(file.content);
    const archive: ArchiveData = parsed.data ?? parsed;
    if (!archive.entries) archive.entries = [];
    if (!archive.playerEntries) archive.playerEntries = [];
    if (!archive.inboxDistillCategories) archive.inboxDistillCategories = [];

    const entryCount = (archive.entries?.length ?? 0) + (archive.playerEntries?.length ?? 0);
    const savedAt = parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : "unknown";

    return {
      ok: true,
      message: `✓ Loaded ${entryCount} entries (saved ${savedAt})`,
      data: archive,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Parse error" };
  }
}

// Test gist connection
export async function testGistConnection(): Promise<{ ok: boolean; message: string }> {
  const token = getGistToken();
  if (!token) return { ok: false, message: "No token set" };
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
      },
    });
    if (!res.ok) return { ok: false, message: res.status === 401 ? "Invalid token" : `HTTP ${res.status}` };
    const user = await res.json();
    return { ok: true, message: `Connected as ${user.login}` };
  } catch {
    return { ok: false, message: "Network error" };
  }
}