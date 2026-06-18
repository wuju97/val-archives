// ═══════════════════════════════════════════════════════════════════════════════
// THE ARCHIVIST ENGINE — Val Archives AI Layer
// Three specialized models, one unified interface
//
// Gemini  → The Librarian  (quality, creativity, chat, refine)
// DeepSeek → The Analyst   (extraction, verification, reasoning)
// Cerebras → The Clerk     (speed, inbox, search, fast tasks)
//
// User sees: ✨ The Archivist
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Cerebras (The Clerk — fast tasks) ───────────────────────────────────────
const CEREBRAS_KEY_STORAGE = "valArchivesGeminiKey";
const CEREBRAS_MODEL = "gpt-oss-120b";
const CEREBRAS_API_BASE = "https://api.cerebras.ai/v1/chat/completions";

// ─── Gemini (The Librarian — quality tasks) ───────────────────────────────────
const GEMINI_KEY_STORAGE = "valArchivesGeminiKeyQuality";
const GEMINI_KEY_STORAGE_2 = "valArchivesGeminiKeyQuality2";
const GEMINI_KEY_STORAGE_3 = "valArchivesGeminiKeyQuality3";
// Key routing: Key1=Canon, Key2=Inbox, Key3=Everything else
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ─── DeepSeek (unused — replaced by Groq) ────────────────────────────────────
const DEEPSEEK_KEY_STORAGE = "valArchivesDeepSeekKey";
const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_API_BASE = "https://api.deepseek.com/v1/chat/completions";

// ─── Groq (The Deep Historian — low-freq, high-stakes) ───────────────────────
const GROQ_KEY_STORAGE = "valArchivesGroqKey";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // Deep reasoning tasks
const GROQ_EXTRACT_MODEL = "llama-3.1-8b-instant"; // High-volume extraction (14.4K req/day)
const GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions";

// ─── OpenRouter (Gemma 4 + Nemotron 3 Ultra) ─────────────────────────────────
const OPENROUTER_KEY_STORAGE = "valArchivesOpenRouterKey";
const OWL_ALPHA_MODEL = "qwen/qwen3-30b-a3b:free"; // Qwen3 30B - free, strong reasoning
const NEMOTRON_MODEL = "nvidia/llama-3.1-nemotron-ultra-253b-v1:free";
const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1/chat/completions";


// ─── Key Management ───────────────────────────────────────────────────────────

// Cerebras key (primary — used for most features)
export function getGeminiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CEREBRAS_KEY_STORAGE) || null;
}

export function setGeminiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CEREBRAS_KEY_STORAGE, key.trim());
}

export function clearGeminiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CEREBRAS_KEY_STORAGE);
}

export function hasGeminiKey(): boolean {
  return !!getGeminiKey();
}

// Gemini key (quality tasks — refine, enhance, chat)
export function getGeminiQualityKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GEMINI_KEY_STORAGE) || null;
}

export function setGeminiQualityKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
}

export function clearGeminiQualityKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GEMINI_KEY_STORAGE);
}

export function hasGeminiQualityKey(): boolean {
  return !!getGeminiQualityKey();
}
// Gemini quality key 2
export function getGeminiQualityKey2(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GEMINI_KEY_STORAGE_2) || null;
}
export function setGeminiQualityKey2(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GEMINI_KEY_STORAGE_2, key.trim());
}
export function clearGeminiQualityKey2(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GEMINI_KEY_STORAGE_2);
}
export function hasGeminiQualityKey2(): boolean { return !!getGeminiQualityKey2(); }

// Gemini quality key 3
export function getGeminiQualityKey3(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GEMINI_KEY_STORAGE_3) || null;
}
export function setGeminiQualityKey3(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GEMINI_KEY_STORAGE_3, key.trim());
}
export function clearGeminiQualityKey3(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GEMINI_KEY_STORAGE_3);
}
export function hasGeminiQualityKey3(): boolean { return !!getGeminiQualityKey3(); }

// Get all available Gemini quality keys in order
export function getGeminiQualityKeys(): string[] {
  const keys: string[] = [];
  const k1 = getGeminiQualityKey(); if (k1) keys.push(k1);
  const k2 = getGeminiQualityKey2(); if (k2) keys.push(k2);
  const k3 = getGeminiQualityKey3(); if (k3) keys.push(k3);
  return keys;
}

// Track which key is currently active and rate-limited
const _keyRateLimitedUntil: Record<number, number> = {}; // key index → timestamp when limit resets


// ─── Dedicated key routing ────────────────────────────────────────────────────
// Canon tasks:      Key1 → Key3 → pause
// Inbox tasks:      Key2 → Key3 → pause
// Everything else:  Key3 → Key1 → Key2 → pause

type KeyPurpose = "canon" | "inbox" | "general";

function getKeysForPurpose(purpose: KeyPurpose): string[] {
  const k1 = getGeminiQualityKey();
  const k2 = getGeminiQualityKey2();
  const k3 = getGeminiQualityKey3();

  if (purpose === "canon") {
    return [k1, k3, k2].filter(Boolean) as string[];
  } else if (purpose === "inbox") {
    return [k2, k3, k1].filter(Boolean) as string[];
  } else {
    return [k3, k1, k2].filter(Boolean) as string[];
  }
}

// Per-key rate limit tracking (shared across all purposes)
const _keyRateLimitMap: Record<string, number> = {}; // key value → reset timestamp

function getAvailableKeyForPurpose(purpose: KeyPurpose): string | null {
  const keys = getKeysForPurpose(purpose);
  const now = Date.now();
  for (const key of keys) {
    const limitedUntil = _keyRateLimitMap[key] ?? 0;
    if (now >= limitedUntil) return key;
  }
  return null;
}

function markKeyRateLimitedByValue(key: string, waitMs: number): void {
  _keyRateLimitMap[key] = Date.now() + waitMs;
}

function getEarliestResetForPurpose(purpose: KeyPurpose): number {
  const keys = getKeysForPurpose(purpose);
  const times = keys.map(k => _keyRateLimitMap[k] ?? 0).filter(t => t > Date.now());
  return times.length > 0 ? Math.min(...times) : 0;
}

function getAvailableGeminiKey(): { key: string; index: number } | null {
  if (typeof window === "undefined") return null;
  const keys = getGeminiQualityKeys();
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const limitedUntil = _keyRateLimitedUntil[i] ?? 0;
    if (now >= limitedUntil) return { key: keys[i], index: i };
  }
  return null; // all keys rate limited
}

function markKeyRateLimited(index: number, waitMs: number): void {
  _keyRateLimitedUntil[index] = Date.now() + waitMs;
}

function getEarliestKeyReset(): number {
  const values = Object.values(_keyRateLimitedUntil);
  if (values.length === 0) return 0;
  return Math.min(...values);
}


// ─── DeepSeek Key Management ─────────────────────────────────────────────────
export function getDeepSeekKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEEPSEEK_KEY_STORAGE) || null;
}
export function setDeepSeekKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEEPSEEK_KEY_STORAGE, key.trim());
}
export function clearDeepSeekKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEEPSEEK_KEY_STORAGE);
}
export function hasDeepSeekKey(): boolean {
  return !!getDeepSeekKey();
}

// ─── Groq Key Management (Deep Historian) ────────────────────────────────────
export function getGroqKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GROQ_KEY_STORAGE) || null;
}
export function setGroqKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GROQ_KEY_STORAGE, key.trim());
}
export function clearGroqKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GROQ_KEY_STORAGE);
}
export function hasGroqKey(): boolean {
  return !!getGroqKey();
}

// ─── OpenRouter Key Management ───────────────────────────────────────────────
export function getOpenRouterKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(OPENROUTER_KEY_STORAGE) || null;
}
export function setOpenRouterKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPENROUTER_KEY_STORAGE, key.trim());
}
export function clearOpenRouterKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OPENROUTER_KEY_STORAGE);
}
export function hasOpenRouterKey(): boolean {
  return !!getOpenRouterKey();
}

// ─── OpenRouter API Call (Owl Alpha) ─────────────────────────────────────────
async function owlAlphaCall(
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  const key = getOpenRouterKey();
  if (!key) {
    return geminiQualityCall(prompt, systemInstruction, history);
  }

  const messages: Array<{ role: string; content: string }> = [];
  // Nemotron Ultra requires "detailed thinking on" to enable reasoning
  const sysContent = ((systemInstruction || "") + "\n\ndetailed thinking on").trim();
  messages.push({ role: "system", content: sysContent });
  if (history) {
    for (const msg of history) {
      messages.push({ role: msg.role === "model" ? "assistant" : "user", content: msg.text });
    }
  }
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "HTTP-Referer": "https://val-archives.vercel.app",
        "X-Title": "Val Archives",
      },
      body: JSON.stringify({
        model: OWL_ALPHA_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if ((err as Error)?.name === "AbortError") throw new Error("RATE_LIMIT");
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) throw new Error("INVALID_KEY");
    if (response.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.trim();
}

// ─── OpenRouter API Call (Nemotron 3 Ultra) ───────────────────────────────────
async function nemotronCall(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const key = getOpenRouterKey();
  if (!key) return geminiQualityCall(prompt, systemInstruction);

  const messages: Array<{ role: string; content: string }> = [];
  // Nemotron Ultra requires "detailed thinking on" to enable reasoning
  const sysPrompt = (systemInstruction || "") + "\n\ndetailed thinking on";
  messages.push({ role: "system", content: sysPrompt.trim() });
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 min for large synthesis

  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "HTTP-Referer": "https://val-archives.vercel.app",
        "X-Title": "Val Archives",
      },
      body: JSON.stringify({
        model: NEMOTRON_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 16384,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if ((err as Error)?.name === "AbortError") throw new Error("RATE_LIMIT");
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `HTTP ${response.status}`;
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.trim();
}

export async function testOpenRouterConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await owlAlphaCall("Reply with exactly: CONNECTED", "detailed thinking on");
    return { ok: true, message: result.includes("CONNECTED") ? "Connected (OpenRouter ready)" : "Connected" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "INVALID_KEY") return { ok: false, message: "Invalid OpenRouter API key" };
    if (msg === "RATE_LIMIT") return { ok: false, message: "Rate limit — try again shortly" };
    return { ok: false, message: msg };
  }
}


// ─── Groq API Call ────────────────────────────────────────────────────────────
async function groqCall(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string
): Promise<string> {
  const key = getGroqKey();
  if (!key) {
    // Fall back to Cerebras if no Groq key
    return geminiCall(prompt, systemInstruction);
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let response: Response;
  try {
    response = await fetch(GROQ_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelOverride || GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if ((err as Error)?.name === "AbortError") throw new Error("RATE_LIMIT");
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) throw new Error("INVALID_KEY");
    if (response.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.trim();
}

export async function testGroqConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await groqCall("Reply with exactly: CONNECTED");
    return { ok: true, message: result.includes("CONNECTED") ? "Connected successfully" : "Connected" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "NO_KEY") return { ok: false, message: "No Groq API key set" };
    if (msg === "INVALID_KEY") return { ok: false, message: "Invalid Groq API key" };
    if (msg === "RATE_LIMIT") return { ok: false, message: "Rate limit — try again shortly" };
    return { ok: false, message: msg };
  }
}






// ─── Core API Call ────────────────────────────────────────────────────────────

export async function geminiCall(
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error("NO_KEY");

  const messages: Array<{ role: string; content: string }> = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  if (history) {
    for (const msg of history) {
      messages.push({
        role: msg.role === "model" ? "assistant" : "user",
        content: msg.text,
      });
    }
  }

  messages.push({ role: "user", content: prompt });

  // Timeout after 45 seconds to prevent stalling
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  
  let response: Response;
  try {
    response = await fetch(CEREBRAS_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") throw new Error("RATE_LIMIT"); // treat timeout as rate limit — will retry
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) throw new Error("INVALID_KEY");
    if (response.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.trim();
}

// ─── Test Connection ──────────────────────────────────────────────────────────

export async function testGeminiConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await geminiCall("Reply with exactly: CONNECTED");
    return { ok: true, message: result.includes("CONNECTED") ? "Connected successfully" : "Connected" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "NO_KEY") return { ok: false, message: "No API key set" };
    if (msg === "INVALID_KEY") return { ok: false, message: "Invalid API key" };
    if (msg === "RATE_LIMIT") return { ok: false, message: "Rate limit hit — try again in a minute" };
    return { ok: false, message: msg };
  }
}
// ─── Gemini Quality API Call ──────────────────────────────────────────────────
// Used for quality tasks: refine prompts, enhance, chat

// ─── Single Gemini call with a specific key ──────────────────────────────────
async function geminiQualityCallWithKey(
  key: string,
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (history) {
    for (const msg of history) {
      contents.push({ role: msg.role, parts: [{ text: msg.text }] });
    }
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });
  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
  body.generationConfig = { temperature: 0.7, maxOutputTokens: 65536 };

  const response = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `HTTP ${response.status}`;
    if (response.status === 403) throw new Error("INVALID_KEY");
    if (response.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.trim();
}

// ─── Gemini Quality Call with automatic key rotation ─────────────────────────
// Tries Key 1 → Key 2 → Key 3 on rate limit.
// If ALL keys are rate limited, waits for the earliest reset and retries.
export async function geminiQualityCall(
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  // General tasks use Key3 → Key1 → Key2 routing
  return geminiQualityCallFor("general", prompt, systemInstruction, history);
}

// Test Gemini quality connection
export async function testGeminiQualityConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await geminiQualityCall("Reply with exactly: CONNECTED");
    return { ok: true, message: result.includes("CONNECTED") ? "Connected successfully" : "Connected" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "NO_KEY") return { ok: false, message: "No Gemini API key set" };
    if (msg === "INVALID_KEY") return { ok: false, message: "Invalid Gemini API key" };
    if (msg === "RATE_LIMIT") return { ok: false, message: "Rate limit hit — try again in a minute" };
    return { ok: false, message: msg };
  }
}



// ─── FEATURE: Refine Inbox Classification ─────────────────────────────────────

// ─── DeepSeek API Call ────────────────────────────────────────────────────────
async function deepSeekCall(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const key = getDeepSeekKey();
  if (!key) {
    return geminiCall(prompt, systemInstruction);
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if ((err as Error)?.name === "AbortError") throw new Error("RATE_LIMIT");
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) throw new Error("INVALID_KEY");
    if (response.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.trim();
}


// [HISTORIAN] DeepSeek handles entry suggestions
export async function geminiRefineClassification(
  suggestions: Array<{ text: string; category: string }>,
  allCategories: string[]
): Promise<Array<{ text: string; category: string }>> {
  if (!hasGeminiKey() || suggestions.length === 0) return suggestions;

  const prompt = `You are a story/RPG archive classifier. Review these auto-classified entries and correct any that are in the wrong category.

Available categories: ${allCategories.join(", ")}

Entries to review:
${suggestions.map((s, i) => `${i + 1}. [${s.category}] ${s.text}`).join("\n")}

Return ONLY a JSON array in this exact format, no other text:
[{"text": "entry text", "category": "correct_category"}, ...]

Keep the same text exactly. Only change categories that are clearly wrong.`;

  try {
    const result = await geminiCall(prompt);
    const clean = result.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    return suggestions;
  } catch {
    return suggestions;
  }
}

// ─── FEATURE: Refine Master Prompt ───────────────────────────────────────────

export async function geminiRefineMasterPrompt(masterPrompt: string): Promise<string> {
  if (!hasGeminiKey() || !masterPrompt.trim()) return masterPrompt;

  const prompt = `You are an expert at crafting AI system prompts for RPG/story campaigns.

Your job is to REFINE and IMPROVE this Master Prompt — NOT summarize or shorten it.

STRICT RULES:
- PRESERVE every single fact, rule, character detail, lore entry, and relationship — nothing gets removed
- PRESERVE all section headers and structure exactly
- Fix grammar, clarity, and phrasing ONLY
- Fix contradictions by keeping BOTH pieces of info and noting the contradiction
- If a section is already clear, leave it completely unchanged
- The output MUST be at least as long as the input — longer is fine, shorter is NOT acceptable
- Do NOT add commentary, do NOT summarize, do NOT condense
- Think of yourself as a careful editor, not a rewriter

Original Master Prompt:
${masterPrompt}

Return ONLY the refined prompt with ALL original content preserved:`;

  try {
    return await geminiQualityCall(prompt);
  } catch {
    return masterPrompt;
  }
}

// ─── FEATURE: Enhance Entry ───────────────────────────────────────────────────

export async function geminiEnhanceEntry(
  text: string,
  category: string,
  existingContext: string
): Promise<string> {
  if (!hasGeminiKey() || !text.trim()) return text;

  const prompt = `You are a story/RPG world-building assistant.

Enhance this ${category} entry to be more detailed and useful for storytelling. 
- Keep the core facts exactly the same
- Add relevant details, implications, or connections
- Keep it concise — 2-4 sentences max
- Write in the same style as the original

Existing archive context (for reference):
${existingContext.slice(0, 1000)}

Entry to enhance:
"${text}"

Return ONLY the enhanced entry text, no commentary:`;

  try {
    return await geminiQualityCall(prompt);
  } catch {
    return text;
  }
}

// ─── FEATURE: Detect Contradictions ──────────────────────────────────────────

export async function geminiCheckContradictions(
  newEntry: string,
  existingEntries: string[],
  category: string
): Promise<{ hasContradiction: boolean; explanation: string }> {
  if (!hasGeminiKey() || existingEntries.length === 0) {
    return { hasContradiction: false, explanation: "" };
  }

  const prompt = `Check if this new entry contradicts any existing entries in the archive.

Category: ${category}
New entry: "${newEntry}"

Existing entries:
${existingEntries.slice(0, 20).map((e, i) => `${i + 1}. ${e}`).join("\n")}

Reply with JSON only:
{"hasContradiction": true/false, "explanation": "brief explanation or empty string"}`;

  try {
    const result = await groqCall(prompt);
    const clean = result.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { hasContradiction: false, explanation: "" };
  }
}

// ─── FEATURE: Refine Forge Output ────────────────────────────────────────────

export async function geminiRefineForgeOutput(
  forgePrompt: string,
  goal: string
): Promise<string> {
  if (!hasGeminiKey() || !forgePrompt.trim()) return forgePrompt;

  const prompt = `You are an expert prompt engineer for AI roleplay and story systems.

Refine this prompt to better achieve the stated goal. Make it more precise, more evocative, and more likely to produce excellent AI responses.
- Preserve all factual content
- Strengthen the role definition and instructions
- Make output expectations clearer

Goal: ${goal}

Original prompt:
${forgePrompt}

Return ONLY the refined prompt:`;

  try {
    return await geminiQualityCall(prompt);
  } catch {
    return forgePrompt;
  }
}

// ─── FEATURE: Summarize Canon File ───────────────────────────────────────────

export async function geminiSummarizeCanon(
  content: string,
  filename: string
): Promise<string> {
  if (!hasGeminiKey() || !content.trim()) return "";

  const prompt = `Summarize the key story/world-building facts from this file in bullet points.
Focus on: characters, locations, events, rules, relationships, lore.
Keep each bullet concise. Max 10 bullets.

File: ${filename}
Content:
${content.slice(0, 3000)}

Return ONLY the bullet point summary:`;

  try {
    return await geminiCall(prompt);
  } catch {
    return "";
  }
}

// ─── FEATURE: Suggest Timeline Branch ────────────────────────────────────────

export async function geminiSuggestBranch(
  saveContent: string,
  archiveContext: string
): Promise<string> {
  if (!hasGeminiKey()) return "";

  const prompt = `Based on this story save, suggest 3 interesting "what if" alternate timeline branches.
Each branch should be a compelling divergence point that creates a different story.

Archive context:
${archiveContext.slice(0, 500)}

Current save:
${saveContent.slice(0, 1000)}

Return 3 branch suggestions, one per line, starting with "What if":`;

  try {
    return await geminiQualityCall(prompt);
  } catch {
    return "";
  }
}

// ─── FEATURE: Chat with Archive Context ──────────────────────────────────────

const VAL_ARCHIVES_KNOWLEDGE = `
VAL ARCHIVES — COMPLETE FEATURE GUIDE:

TABS & FEATURES:
- 📥 Inbox: Player content entry. Copy & Paste tab or Upload Files tab (TXT/MD/PDF, stored in IDB permanently). ✨ Distill Story button → opens panel → Gemini reads content in 4 passes → creates Story Reference → ⚡ Import to 🎮 Player Story. Quick import: ✨ Analyze → classify → Import to Player Story. 💾 Save Prompt generates session extraction prompt.
- 🏛 Canon Archives: Canon source files. Upload TXT/PDF (stored in IDB). ✨ Distill Canon → Gemini reads entire file → Canon Reference document → View & Save → ⚡ Import to Vault → Canon Story subtab. Separate from Inbox — never mixes.
- 📖 Story Studio: Two subtabs — 📖 Canon Story (from Canon Archives) and 🎮 Player Story (from Inbox). 30+ categories including 💕 Romance & Love. Priority dots: once=blue, twice=red. Canon Story and Player Story are COMPLETELY SEPARATE — never mix.
- 🌀 Pensieve: AI search across both subtabs. Filter: All / Canon Story / Player Story. 3-stage: Cerebras keyword scan → Cerebras investigation → Gemini answer. Results labeled 📖 or 🎮.
- 👑 Master Prompt: Auto-compiled from both subtabs. Priority order: red (top+bottom) → blue (middle) → interleaved by category. Canon then Player per section. Click ✨ AI Refine.
- 🕰 Custom Prompt: Global AI instructions. Click ✨ AI Enhance.
- ⚒ Prompt Forge: Build specialized prompts. Describe goal → Analyze → Forge → ✨ AI Refine → Send to Final Prompt.
- 📋 Rule Book: World rules and game mechanics. Feed into Master Prompt first. Click ✨ to AI-enhance each rule.
- ⏳ Timeline Save: Store session saves intact. + Branch for alternate timelines. Active timeline feeds into Master Prompt verbatim.
- 👤 Character Dashboard: Up to 5 character panels. Auto-searches both subtabs. Click ✨ AI for refined character summary.

AI SYSTEM:
- Gemini Key 1 (Canon): Distill Canon + Import to Vault → fallback Key 3
- Gemini Key 2 (Inbox): Distill Story + Import to Player Story → fallback Key 3  
- Gemini Key 3 (General): Pensieve, Chat, Refine, Master Prompt → fallback Key 1 → Key 2
- Groq: Extract to Vault (raw txt), Timeline checks, Contradiction detection
- Cerebras: Pensieve keyword search, Inbox classify, fast tasks
- All 3 keys rate limited → process pauses automatically → resumes when any key resets

SETTINGS:
- Display: theme, colors, fonts
- AI: Add Gemini Key 1/2/3, Groq, Cerebras keys. Test each. Show/Hide toggle.
- Alert Zone: Clear Vault (wipes story entries only, never files), Undo, AI Targeted Delete (checkboxes), Export Vault

STORAGE:
- Vault entries: localStorage + IDB (IDB is primary, never truncates)
- Canon files: valArchivesCanonDB IDB (permanent)
- Inbox files: valArchivesInboxDB IDB (permanent)
- Clear Vault: only wipes story entries, NEVER files or Canon References
`;

export async function geminiChat(
  message: string,
  masterPrompt: string,
  history: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  if (!hasGeminiKey() && !hasGeminiQualityKey() && !hasGeminiQualityKey2() && !hasGeminiQualityKey3()) throw new Error("NO_KEY");

  const systemInstruction = `You are The Archivist — the built-in AI assistant for Val Archives, a story/RPG archive system.

You have two roles:
1. WEBSITE ASSISTANT: You know everything about how Val Archives works. Answer any questions about features, tabs, how to use the system, workflows, AI keys, storage, etc. Use the knowledge below.
2. STORY/RPG ASSISTANT: You know this user's complete archive — both Canon Story facts and their Player's current journey. Help with storytelling, character analysis, world-building, quest planning, theories, continuity questions.

VAL ARCHIVES KNOWLEDGE:
${VAL_ARCHIVES_KNOWLEDGE}

ARCHIVE CONTEXT (this user's actual story data):
${masterPrompt.slice(0, 7000)}

Be helpful, specific, and friendly. If asked about the website, explain clearly. If asked about the story, stay consistent with the archive data above.`;

  return geminiQualityCall(message, systemInstruction, history);
}

// ─── FEATURE: Auto-enhance Rule ──────────────────────────────────────────────

export async function geminiEnhanceRule(rule: string): Promise<string> {
  if (!hasGeminiKey() || !rule.trim()) return rule;

  const prompt = `Improve this RPG/story rule to be clearer and more specific for an AI game master.
Keep the same intent. Make it unambiguous and actionable.
Original: "${rule}"
Return ONLY the improved rule:`;

  try {
    return await geminiQualityCall(prompt);
  } catch {
    return rule;
  }
}

// ─── Error message helper ─────────────────────────────────────────────────────

export function geminiErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : "Unknown error";
  if (msg === "NO_KEY") return "Add your Groq API key in Settings → AI to enable this feature.";
  if (msg === "INVALID_KEY") return "Invalid API key. Check Settings → AI.";
  if (msg === "RATE_LIMIT") return "Rate limit reached. Wait a moment and try again.";
  if (msg.startsWith("BAD_REQUEST")) return `Request error: ${msg.replace("BAD_REQUEST: ", "")}`;
  return `AI error: ${msg}`;
}

// ─── FEATURE: Generate Dynamic Save Prompt ────────────────────────────────────

export async function geminiGenerateSavePrompt(masterPrompt: string): Promise<string> {
  if (!hasGeminiKey()) return "";

  const prompt = `You are an expert RPG/story session archivist. Based on the archive context below, generate a highly specific session save extraction prompt.

The prompt should ask the AI to extract information that is specifically relevant to THIS archive — naming actual characters, locations, quests, and relationships from the archive rather than using generic placeholders.

Archive context:
${masterPrompt.slice(0, 4000)}

Generate a complete session save extraction prompt. It should:
1. Reference specific characters from the archive by name
2. Ask about specific active quests/plotlines if any exist
3. Ask about specific relationships that matter in this archive
4. Include all the standard sections (current scene, character status, events, decisions, what happens next)
5. Be written as instructions to send to an AI that just ran a session

Return ONLY the prompt text, ready to copy and send:`;

  try {
    return await geminiQualityCall(prompt);
  } catch {
    return "";
  }
}

// ─── FEATURE: Enhance Custom Prompt Instructions ──────────────────────────────

export async function geminiEnhanceCustomPrompt(
  customPrompt: string,
  masterPrompt: string
): Promise<string> {
  if (!hasGeminiKey() || !customPrompt.trim()) return customPrompt;

  const prompt = `You are an expert at writing AI system instructions for RPG and story campaigns.

Review and enhance these global instructions to make them more precise, effective, and consistent with the archive context.
- Keep all the user's original intent and rules
- Make vague instructions more specific and actionable
- Remove redundancy
- Add any obvious missing instructions based on the archive context
- Keep it concise

Archive context (for reference):
${masterPrompt.slice(0, 1000)}

Current global instructions:
${customPrompt}

Return ONLY the enhanced instructions, no commentary:`;

  try {
    return await geminiQualityCall(prompt);
  } catch {
    return customPrompt;
  }
}

// ─── FEATURE: Smart Category Review ──────────────────────────────────────────

// [HISTORIAN] DeepSeek handles smart category review
export async function geminiSmartCategoryReview(
  suggestions: Array<{ text: string; category: string }>,
  allCategories: string[],
  archiveContext: string
): Promise<Array<{ text: string; originalCategory: string; suggestedCategory: string; reason: string; changed: boolean }>> {
  if (!hasGeminiKey() || suggestions.length === 0) {
    return suggestions.map(s => ({
      text: s.text, originalCategory: s.category,
      suggestedCategory: s.category, reason: "", changed: false
    }));
  }

  const entriesList = suggestions.map((s, i) => (i + 1) + ". [" + s.category + "] " + s.text).join("\n");
  const prompt = "You are an expert story/RPG archivist. Review these auto-classified entries and suggest better categories where needed.\n\n"
    + "Available categories: " + allCategories.join(", ") + "\n\n"
    + "Archive context:\n" + archiveContext.slice(0, 800) + "\n\n"
    + "Entries to review:\n" + entriesList + "\n\n"
    + "Return ONLY a JSON array:\n"
    + '[{"text": "exact entry text", "originalCategory": "current", "suggestedCategory": "better or same", "reason": "brief reason if changed, empty string if same", "changed": true}]';

  try {
    const result = await geminiCall(prompt);
    const clean = result.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    return suggestions.map(s => ({ text: s.text, originalCategory: s.category, suggestedCategory: s.category, reason: "", changed: false }));
  } catch {
    return suggestions.map(s => ({ text: s.text, originalCategory: s.category, suggestedCategory: s.category, reason: "", changed: false }));
  }
}

// ─── FEATURE: AI Targeted Delete ─────────────────────────────────────────────

// [ANALYST] DeepSeek handles targeted delete
export async function geminiTargetedDelete(
  query: string,
  entries: Array<{ id: string; text: string; category: string }>
): Promise<Array<{ id: string; text: string; category: string; reason: string }>> {
  if (entries.length === 0) return [];
  const hasAnyKey = hasGeminiKey() || hasGeminiQualityKey() || hasGeminiQualityKey2() || hasGeminiQualityKey3();
  if (!hasAnyKey) return [];

  // Batch entries to avoid overly long prompts — process in chunks of 200
  const BATCH_SIZE = 200;
  const allMatches: Array<{ id: string; text: string; category: string; reason: string }> = [];

  for (let batchStart = 0; batchStart < entries.length; batchStart += BATCH_SIZE) {
    const batch = entries.slice(batchStart, batchStart + BATCH_SIZE);
    const entriesList = batch.map((e, i) => i + ". [" + e.category + "] " + e.text.slice(0, 150)).join("\n");
    const prompt = "A user wants to delete vault entries related to this request: \"" + query + "\"\n\n"
      + "Here are the entries (numbered):\n" + entriesList + "\n\n"
      + "Return ONLY a JSON array of indices that match the request, with a brief reason for each. "
      + "Be reasonably inclusive — if an entry is plausibly related to the request, include it.\n"
      + 'Format: [{"index": 0, "reason": "brief reason"}]\n'
      + "If nothing matches in this batch, return exactly: []\n"
      + "Return ONLY the JSON array, no other text.";

    try {
      const result = await geminiQualityCallFor("general", prompt);
      const clean = result.replace(/```json|```/g, "").trim();
      const jsonMatch = clean.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;
      const parsed: Array<{ index: number; reason: string }> = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) continue;
      const matches = parsed
        .filter(p => typeof p.index === "number" && p.index >= 0 && p.index < batch.length)
        .map(p => ({ ...batch[p.index], reason: p.reason || "Matches search query" }));
      allMatches.push(...matches);
    } catch (e) {
      // If this batch fails (rate limit etc), skip it and continue with other batches
      console.error("[TargetedDelete] Batch failed:", e);
      continue;
    }
  }

  return allMatches;
}

// ─── FEATURE: Semantic Search ─────────────────────────────────────────────────



// ─── Purpose-aware Gemini Quality Call ───────────────────────────────────────
export async function geminiQualityCallFor(
  purpose: KeyPurpose,
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  const keys = getKeysForPurpose(purpose);
  if (keys.length === 0) {
    return geminiCall(prompt, systemInstruction, history);
  }

  while (true) {
    const key = getAvailableKeyForPurpose(purpose);

    if (!key) {
      const resetAt = getEarliestResetForPurpose(purpose);
      const waitSec = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 5);
      throw new Error(`ALL_KEYS_LIMITED:${waitSec}`);
    }

    try {
      return await geminiQualityCallWithKey(key, prompt, systemInstruction, history);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      if (msg === "RATE_LIMIT" || msg.includes("429")) {
        markKeyRateLimitedByValue(key, 60000);
        continue;
      }
      if (msg === "INVALID_KEY") {
        markKeyRateLimitedByValue(key, 24 * 60 * 60 * 1000);
        continue;
      }
      throw e;
    }
  }
}

// ─── Pause helper for ALL_KEYS_LIMITED ───────────────────────────────────────
async function waitForKeyReset(
  msg: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const match = msg.match(/ALL_KEYS_LIMITED:(\d+)/);
  const waitSec = match ? parseInt(match[1]) : 65;
  for (let remaining = waitSec; remaining > 0; remaining -= 5) {
    if (onProgress) onProgress("⏸ All Gemini keys rate limited — resuming in " + remaining + "s...");
    await new Promise(r => setTimeout(r, Math.min(5000, remaining * 1000)));
  }
  if (onProgress) onProgress("▶ Resuming...");
}

// ─── Canon Distill ────────────────────────────────────────────────────────────
// Uses Gemini to read an entire source file and produce a structured canon
// reference document. Much better than direct extraction because Gemini reads
// the full text at once with complete context.
// ═══════════════════════════════════════════════════════════════════════════════
// CHUNKED DISTILL CANON — chapter-aware chunking + per-chunk distillation + Key 3 merge
// ═══════════════════════════════════════════════════════════════════════════════
// Books are 400k-1,500k+ characters — far too large for one Gemini call to handle
// thoroughly (single large calls compress/summarize rather than capturing everything).
// Strategy: split by chapter markers (form-feed + "CHAPTER <WORD>"), sub-split any
// chapter over 100k chars, distill each chunk separately with the full canon prompt
// (Key 1 — canon routing), then merge all chunk outputs into one document via a
// separate Key 3 (general) pass that combines identical entries and keeps differing
// ones separate, exactly as instructed.

interface CanonChunk {
  index: number;
  label: string; // e.g. "Chapter 3" or "Chapter 3 (part 2)"
  text: string;
}

function splitBookIntoChunks(sourceText: string, maxChunkSize: number = 100000): CanonChunk[] {
  // Detect chapter markers: form-feed character followed by "CHAPTER <WORD>"
  const chapterPattern = /\x0c?CHAPTER\s+[A-Z]+/gi;
  const matches: Array<{ index: number; text: string }> = [];
  let match;
  while ((match = chapterPattern.exec(sourceText)) !== null) {
    matches.push({ index: match.index, text: match[0] });
  }

  let rawChapters: Array<{ label: string; text: string }> = [];

  if (matches.length >= 2) {
    // Chapter markers found — split on them.
    // Content before the first marker is Chapter 1 (since the marker for ch.1 is often missing).
    if (matches[0].index > 200) {
      rawChapters.push({ label: "Chapter 1", text: sourceText.slice(0, matches[0].index) });
    }
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : sourceText.length;
      const chunkText = sourceText.slice(start, end);
      // Skip suspiciously short "chapters" near the very end (often back-matter, not real chapters)
      if (chunkText.length < 500 && i === matches.length - 1) continue;
      rawChapters.push({ label: "Chapter " + (i + 2), text: chunkText });
    }
  } else {
    // No reliable chapter markers — fall back to flat splitting
    rawChapters.push({ label: "Full text", text: sourceText });
  }

  // Sub-split any chapter that exceeds maxChunkSize
  const finalChunks: CanonChunk[] = [];
  let idx = 0;
  for (const chapter of rawChapters) {
    if (chapter.text.length <= maxChunkSize) {
      finalChunks.push({ index: idx++, label: chapter.label, text: chapter.text });
    } else {
      const numParts = Math.ceil(chapter.text.length / maxChunkSize);
      for (let p = 0; p < numParts; p++) {
        const partText = chapter.text.slice(p * maxChunkSize, (p + 1) * maxChunkSize);
        finalChunks.push({ index: idx++, label: chapter.label + " (part " + (p + 1) + " of " + numParts + ")", text: partText });
      }
    }
  }

  return finalChunks;
}

const CANON_EXTRACTION_PROMPT_HEADER = `You are an expert Canon Archivist, Lore Analyst, Continuity Editor, and RPG Game Master Assistant.

Your task is to transform the provided source material into a complete canon reference document.

## CRITICAL RULES

1. Treat the source material as absolute canon.
2. Do not invent, infer, speculate, simplify, or fill gaps.
3. Record information exactly as supported by the text.
4. Missing information is worse than excessive information.
5. Preserve chronology, context, motivations, consequences, and relationships.
6. Include both major and minor details whenever they could matter to a Game Master.
7. Assume future story decisions may depend on seemingly insignificant details.
8. If a fact appears only once, include it.
9. If a character appears only briefly, include them.
10. If an event causes later consequences, note both the event and the consequence.
11. Never compress multiple events into one event if they occur separately.
12. Preserve story logic and cause-and-effect chains.
13. Do not replace multiple events with a summary if the original text presents them separately.
14. When in doubt, record more detail rather than less.
15. Preserve important conversations, explanations, revelations, motivations, and consequences, not just outcomes.
16. Track both what happened and why it happened.
17. Track both what characters believe and what is actually true.
18. Record information even if it appears unimportant; it may become relevant later.

---

## EXTRACTION PRIORITY

Extract everything that could matter for:

* Story continuity
* Character behavior
* Worldbuilding
* Future plot developments
* Relationships
* Rules of the setting
* Mysteries
* Secrets
* Organizations
* Political structures
* Historical events
* Magical systems
* Technology systems
* Combat systems
* Social structures

---

## CHARACTERS

For EVERY named character:

* Full name
* Aliases
* Titles
* Physical description
* Personality traits
* Abilities
* Occupation/role
* Goals
* Motivations
* Fears
* Relationships
* History
* Secrets
* Important possessions
* Notable dialogue patterns
* Important actions
* Character development
* Current status

Include:

* Major characters
* Minor characters
* One-scene characters
* Mentioned characters
* Historical characters
* Deceased characters

---

## CHARACTER ARCS

For every major character:

* Starting state
* Initial beliefs
* Major experiences
* Important decisions
* Internal changes
* Relationship changes
* Key successes
* Key failures
* Ending state

Preserve how each character evolves throughout the story.

---

## LOCATIONS

For EVERY location:

* Description
* Physical appearance
* Purpose
* Significance
* Residents
* Factions present
* Events occurring there
* Secrets
* History
* Important objects found there

---

## RELATIONSHIPS

For EVERY meaningful relationship:

* Participants
* Relationship type
* History
* Dynamic
* Conflicts
* Trust level
* Loyalty level
* Evolution over time

---

## POWERS / MAGIC / RULES

Extract:

* Spells
* Powers
* Techniques
* Systems
* Rules
* Limitations
* Costs
* Weaknesses
* Training methods
* Supernatural mechanics

Include exact limitations whenever known.

---

## ITEMS / ARTIFACTS

For EVERY important item:

* Description
* Function
* Owner
* History
* Powers
* Restrictions
* Current status

---

## ORGANIZATIONS

For EVERY group:

* Purpose
* Membership
* Hierarchy
* Goals
* Influence
* Resources
* Rivals
* History

---

## WORLD LORE

Extract:

* History
* Myths
* Legends
* Religions
* Politics
* Geography
* Culture
* Economics
* Laws
* Education
* Social customs

---

## SECRETS AND REVEALS

Track separately:

* Hidden identities
* Mysteries
* Revelations
* Plot twists
* Foreshadowing
* Deceptions
* False assumptions

For each entry include:

* What characters believe
* What is actually true
* Evidence supporting the belief
* When the truth is revealed
* Consequences of the reveal

---

## TIMELINE

Create a chronological timeline.

Do NOT summarize entire arcs into one entry.

Record events individually.

For each event include:

* Approximate date/time
* Participants
* What happened
* Why it happened
* Immediate consequences
* Long-term consequences

Preserve chronology and narrative causality.

---

## CAUSE AND EFFECT CHAINS

For every major event:

* What happened?
* Who caused it?
* Why did they do it?
* How was it accomplished?
* Immediate consequences
* Long-term consequences
* Which future events depended on this event?

Show how events connect rather than treating them as isolated facts.

Preserve narrative causality.

---

## CONVERSATIONS AND EXPLANATIONS

Extract all major explanatory scenes.

For each include:

* Participants
* Information revealed
* Why the information matters
* Consequences of learning it

Examples:

* Mentor explanations
* Villain monologues
* Mystery solutions
* Historical revelations
* Rule explanations
* End-of-story explanations

Do not reduce important explanations to a single sentence.

---

Output as a structured Game Master Reference Document using ## headers for each section above that has content in this chunk. Skip sections with no relevant content in this specific chunk — do not write "none found" or similar, just omit the section.`;

export async function geminiDistillCanon(
  sourceText: string,
  filename: string,
  onProgress?: (msg: string) => void,
  shouldAbort?: () => boolean
): Promise<string> {
  if (!hasGeminiQualityKey()) {
    throw new Error("NO_GEMINI_KEY");
  }

  const cappedText = sourceText.slice(0, 1800000); // safety cap for extreme outliers
  const chunks = splitBookIntoChunks(cappedText, 100000);

  if (onProgress) onProgress("Split into " + chunks.length + " chunk(s) for distillation...");

  const chunkResults: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (shouldAbort && shouldAbort()) {
      if (onProgress) onProgress("⏸ Paused after " + i + "/" + chunks.length + " chunks");
      // Return what we have so far, unmerged — caller should treat a paused result as incomplete
      return chunkResults.join("\n\n---\n\n");
    }

    const chunk = chunks[i];
    if (onProgress) onProgress("(" + (i + 1) + "/" + chunks.length + ") Distilling " + chunk.label + "...");

    const continuityNote = chunks.length > 1
      ? "This is " + chunk.label + " (part " + (i + 1) + " of " + chunks.length + ") from \"" + filename + "\". "
        + "Only extract what appears in THIS excerpt below — do not invent details from other parts of the book you have not seen. "
        + "If a character or location is only partially described here, just describe what this excerpt shows.\n\n"
      : "";

    const prompt = CANON_EXTRACTION_PROMPT_HEADER + "\n\n---\n\n"
      + continuityNote
      + "SOURCE EXCERPT:\n---\n" + chunk.text + "\n---\n";

    let attempt = 0;
    let chunkDone = false;
    while (!chunkDone) {
      attempt++;
      try {
        if (attempt > 1 && onProgress) onProgress("(" + (i + 1) + "/" + chunks.length + ") Retry " + attempt + " for " + chunk.label + "...");
        const result = await geminiQualityCallFor("canon", prompt);
        chunkResults.push("# " + chunk.label.toUpperCase() + "\n\n" + result);
        chunkDone = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (msg.startsWith("ALL_KEYS_LIMITED")) {
          await waitForKeyReset(msg, onProgress);
          if (shouldAbort && shouldAbort()) { if (onProgress) onProgress("⏸ Paused during wait"); return chunkResults.join("\n\n---\n\n"); }
          continue;
        }
        const isOverloaded = msg.includes("high demand") || msg.includes("RATE_LIMIT") ||
                             msg.includes("429") || msg.includes("503") || msg.includes("overloaded") ||
                             msg.includes("unavailable") || msg.includes("fetch") || msg.includes("network") ||
                             msg.includes("timeout") || msg.includes("TIMEOUT") || msg.includes("AbortError");
        if (isOverloaded) {
          const waitSec = Math.min(30 + attempt * 5, 120);
          if (onProgress) onProgress("Gemini busy — waiting " + waitSec + "s before retry...");
          await new Promise(r => setTimeout(r, waitSec * 1000));
          if (shouldAbort && shouldAbort()) { if (onProgress) onProgress("⏸ Paused during wait"); return chunkResults.join("\n\n---\n\n"); }
          continue;
        }
        throw new Error(msg);
      }
    }
  }

  // If only one chunk, no merge needed
  if (chunks.length === 1) {
    if (onProgress) onProgress("Distillation complete!");
    return chunkResults[0];
  }

  // ── Merge pass — Key 3 (general) combines all chunk outputs into one document ──
  if (onProgress) onProgress("Merging " + chunks.length + " chunk results into final Canon Reference...");

  const merged = await mergeCanonChunks(chunkResults, filename, onProgress, shouldAbort);
  if (onProgress) onProgress("Distillation complete! Merged " + chunks.length + " chunks.");
  return merged;
}

// ── Merge pass: combine chunk-level canon documents into one, deduping identical entries ──
async function mergeCanonChunks(
  chunkResults: string[],
  filename: string,
  onProgress?: (msg: string) => void,
  shouldAbort?: () => boolean
): Promise<string> {
  // Merge pass works on batches if there are many chunks, to avoid exceeding prompt limits.
  // Each merge batch combines up to 6 chunk outputs at a time; repeated passes fold the
  // combined results down until only one document remains.
  const BATCH_SIZE = 6;
  let currentLevel = chunkResults;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let b = 0; b < currentLevel.length; b += BATCH_SIZE) {
      if (shouldAbort && shouldAbort()) {
        if (onProgress) onProgress("⏸ Paused during merge");
        return currentLevel.join("\n\n---\n\n");
      }
      const batch = currentLevel.slice(b, b + BATCH_SIZE);
      if (batch.length === 1) { nextLevel.push(batch[0]); continue; }

      if (onProgress) onProgress("Merging batch " + (Math.floor(b / BATCH_SIZE) + 1) + " of " + Math.ceil(currentLevel.length / BATCH_SIZE) + "...");

      const mergePrompt = "You are merging multiple sections of a Canon Reference Document for \"" + filename + "\" into one combined section.\n\n"
        + "Each document below covers a different part of the same book, in order. Your job:\n"
        + "- Combine them into ONE document, preserving the original ## section headers (CHARACTERS, LOCATIONS, RELATIONSHIPS, etc).\n"
        + "- If the SAME character/location/item/organization appears in multiple documents with IDENTICAL or near-identical descriptions, merge them into a single entry — do not repeat the same fact twice.\n"
        + "- If the SAME character/location/item appears in multiple documents but with DIFFERENT details (e.g. new information revealed later, or the character changed), KEEP BOTH descriptions as separate entries under that character/location's name — do not discard either, do not collapse them into a vague summary.\n"
        + "- Timeline entries must stay in chronological order and must NOT be merged together even if about the same character — every individual event stays separate.\n"
        + "- Do not summarize, compress, or shorten any content. This is a reorganization and dedup pass only, not a summarization pass.\n\n"
        + batch.map((doc, i) => "=== DOCUMENT " + (i + 1) + " ===\n" + doc).join("\n\n")
        + "\n\nReturn the single merged document now, using ## headers.";

      let attempt = 0;
      let mergedBatch = "";
      let done = false;
      while (!done) {
        attempt++;
        try {
          mergedBatch = await geminiQualityCallFor("general", mergePrompt);
          done = true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          if (msg.startsWith("ALL_KEYS_LIMITED")) {
            await waitForKeyReset(msg, onProgress);
            if (shouldAbort && shouldAbort()) { if (onProgress) onProgress("⏸ Paused during merge wait"); return currentLevel.join("\n\n---\n\n"); }
            continue;
          }
          const isOverloaded = msg.includes("high demand") || msg.includes("RATE_LIMIT") ||
                               msg.includes("429") || msg.includes("503") || msg.includes("overloaded") ||
                               msg.includes("unavailable") || msg.includes("fetch") || msg.includes("network") ||
                               msg.includes("timeout") || msg.includes("TIMEOUT");
          if (isOverloaded && attempt < 5) {
            const waitSec = Math.min(20 + attempt * 5, 90);
            if (onProgress) onProgress("Gemini busy during merge — waiting " + waitSec + "s...");
            await new Promise(r => setTimeout(r, waitSec * 1000));
            continue;
          }
          // If merge fails repeatedly, fall back to simple concatenation for this batch rather than losing data
          mergedBatch = batch.join("\n\n---\n\n");
          done = true;
        }
      }
      nextLevel.push(mergedBatch);
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0] ?? "";
}


// Refine the distilled document with AI
export async function geminiRefineDistilledCanon(
  distilledText: string,
  filename: string
): Promise<string> {
  if (!hasGeminiQualityKey()) throw new Error("NO_GEMINI_KEY");

  const prompt = "You are reviewing a Canon Reference Document for a tabletop RPG campaign.\n\n"
    + "Source: " + filename + "\n\n"
    + "CURRENT DOCUMENT:\n" + distilledText + "\n\n"
    + "Improve this document by:\n"
    + "- Adding any missing sections or entries\n"
    + "- Making entries more specific and useful for a GM\n"
    + "- Ensuring all character relationships are clearly documented\n"
    + "- Adding context for why each fact matters canonically\n"
    + "- Fixing any inaccuracies or vague statements\n"
    + "- Preserving ALL existing content — only add and improve, never remove\n\n"
    + "Return the complete improved document:";

  return geminiQualityCall(prompt);
}



// ─── Import Canon Reference to Vault ─────────────────────────────────────────
// Gemini reads the already-distilled Canon Reference and outputs a flat JSON
// array of {text, category} entries. One fact per entry, right category.
// Much simpler than extraction — Gemini just needs to sort, not think.
export async function geminiImportCanonToVault(
  canonReference: string,
  filename: string,
  onProgress?: (msg: string) => void,
  shouldAbort?: () => boolean
): Promise<Array<{ text: string; category: string; entity?: string; tags?: string[] }>> {
  if (!hasGeminiQualityKey()) throw new Error("NO_GEMINI_KEY");

  const SECTION_CATEGORY_MAP: Record<string, string> = {
    "CHARACTERS": "characters", "CHARACTER": "characters",
    "LOCATIONS": "locations", "LOCATION": "locations",
    "RELATIONSHIPS": "relationships", "RELATIONSHIP": "relationships",
    "ROMANCE": "romance", "LOVE": "romance",
    "MAGIC & SUPERNATURAL": "magic-supernatural", "MAGIC": "magic-supernatural",
    "SPELLS": "magic-supernatural", "SUPERNATURAL": "magic-supernatural",
    "ORGANIZATIONS & FACTIONS": "organizations", "ORGANIZATIONS": "organizations",
    "KEY EVENTS": "timeline-continuity", "EVENTS": "timeline-continuity",
    "CHRONOLOGICAL EVENTS": "timeline-continuity", "TIMELINE": "timeline-continuity",
    "WORLD RULES & LORE": "lore-mythology", "WORLD RULES": "lore-mythology",
    "LORE": "lore-mythology", "RULES": "rules",
    "ITEMS & ARTIFACTS": "items-equipment", "ITEMS": "items-equipment", "ARTIFACTS": "items-equipment",
    "CANON FACTS": "world-overview", "IMPORTANT DETAILS": "world-overview",
    "CREATURES": "creatures-wildlife", "HISTORY": "history",
    "CULTURES": "cultures-society", "CONFLICT": "conflict-combat",
  };

  function getSectionCategory(header: string): string {
    const upper = header.toUpperCase().trim();
    if (SECTION_CATEGORY_MAP[upper]) return SECTION_CATEGORY_MAP[upper];
    for (const key of Object.keys(SECTION_CATEGORY_MAP)) {
      if (upper.includes(key)) return SECTION_CATEGORY_MAP[key];
    }
    return "world-overview";
  }

  // ── Vault Architect prompt — exact rules as specified, category IDs corrected
  // to match the app's actual hyphenated StoryCategory values (the source prompt
  // used underscores in a few places — e.g. magic_supernatural, player_character —
  // which would not match any real category and fall through unrecognized).
  const VAULT_ARCHITECT_RULES = `You are a Vault Architect.
Your task is to convert canon information into vault entries optimized for long-term retrieval, search, continuity tracking, and RPG memory.

GOAL
Transform information into atomic facts.
An atomic fact is the smallest self-contained piece of canon information that remains meaningful when viewed alone.

RULES
1. Never summarize.
2. Never combine multiple facts into one entry when they can be separated.
3. Preserve exact canon meaning.
4. Create as many entries as necessary.
5. Duplicate information across categories when appropriate.
6. Every entry must be understandable without reading any other entry.
7. Preserve names exactly.
8. Preserve chronology.
9. Preserve causes and consequences.
10. Preserve relationships.

ATOMIC FACT RULE
Bad:
"Harry Potter is a brave wizard and best friends with Ron Weasley."
Good:
"Harry Potter is a wizard."
"Harry Potter is brave."
"Ron Weasley is Harry Potter's best friend."
"Harry Potter is Ron Weasley's best friend."

CATEGORY RULES
CHARACTERS (category: "characters")
Store: physical descriptions, personality traits, abilities, motivations, goals, fears, possessions, status

RELATIONSHIPS (category: "relationships")
Store: friendships, rivalries, family ties, mentorships, alliances, enemies
Create relationship entries in BOTH directions.

LOCATIONS (category: "locations")
Store: descriptions, residents, events, significance, history

TIMELINE & CONTINUITY (category: "timeline-continuity")
Store: events, actions, decisions, consequences. One event per entry.

HISTORY (category: "history")
Store: historical events, wars, past discoveries, founding events

LORE & MYTHOLOGY (category: "lore-mythology")
Store: legends, myths, prophecies, ancient stories

MAGIC & SUPERNATURAL (category: "magic-supernatural")
Store: powers, spells, magical rules, magical limitations

ORGANIZATIONS (category: "organizations")
Store: groups, memberships, hierarchy, goals

FACTIONS & POWER (category: "factions")
Store: political influence, territorial control, rival factions

POLITICAL SYSTEMS (category: "political-systems")
Store: governments, laws, authority structures

CONFLICT & COMBAT (category: "conflict-combat")
Store: battles, duels, combat techniques, military actions

QUESTS & PLOTLINES (category: "quests-plotlines")
Store: objectives, investigations, missions, story arcs

ITEMS & EQUIPMENT (category: "items-equipment")
Store: artifacts, weapons, equipment, ownership

CREATURES & WILDLIFE (category: "creatures-wildlife")
Store: beasts, monsters, animals

CULTURES & SOCIETY (category: "cultures-society")
Store: traditions, customs, social norms

SPECIES & RACES (category: "species-races")
Store: species, racial traits, biological distinctions

ECONOMY (category: "economy")
Store: trade, currency, wealth systems

SCIENCE & TECHNOLOGY (category: "science-technology")
Store: inventions, technology, scientific principles

MYSTERIES (category: "mysteries")
Store: unanswered questions, secrets, hidden identities, unknown motives

CORE RULES (category: "rules")
Store: fundamental world rules, campaign rules, setting rules, meta rules, continuity rules

PLAYER CHARACTER (category: "player-character")
Store: player character information, history, abilities, status

ROMANCE & LOVE (category: "romance")
Store: romantic relationships, attractions, marriages, romantic feelings

WORLD OVERVIEW (category: "world-overview")
Store: broad setting descriptions, major world facts, world-level information

GEOGRAPHY (category: "geography")
Store: regions, countries, terrain, natural features, maps, environmental information

THEMES & TONE (category: "themes-tone")
Store: recurring themes, moral ideas, narrative tone, thematic concepts

WRITING STYLE (category: "writing-style")
Store: stylistic rules, narrative techniques, authorial patterns

OUTPUT FORMAT
Create multiple entries whenever multiple categories apply.
Preserve information. Never compress.`;

  // Split Canon Reference by ## headers
  const rawSections = canonReference.split("\n## ");
  const sections = rawSections
    .slice(1) // skip preamble
    .map(s => ({ raw: "## " + s, header: s.split("\n")[0].trim() }))
    .filter(s => s.raw.length > 50);

  if (sections.length === 0) {
    // No sections found — treat whole thing as one chunk
    sections.push({ raw: canonReference, header: "CONTENT" });
  }

  const allEntries: Array<{ text: string; category: string; entity?: string; tags?: string[] }> = [];
  if (onProgress) onProgress("Found " + sections.length + " sections to process...");

  for (let i = 0; i < sections.length; i++) {
    if (shouldAbort && shouldAbort()) {
      if (onProgress) onProgress("⏸ Paused — " + allEntries.length + " entries so far");
      return allEntries;
    }

    const { raw, header } = sections[i];
    const category = getSectionCategory(header);

    if (onProgress) onProgress("(" + (i + 1) + "/" + sections.length + ") " + header + " → " + category + "...");

    const prompt = VAULT_ARCHITECT_RULES + "\n\n---\n\n"
      + "You are processing this section of a Canon Reference Document:\n"
      + "SECTION HEADER: " + header + "\n"
      + "SUGGESTED PRIMARY CATEGORY: " + category + " (use this for most entries, but assign whichever category from the rules above actually fits each individual fact — duplicate across categories when appropriate, per the rules)\n\n"
      + raw + "\n\n"
      + "OUTPUT FORMAT\n"
      + "For each atomic fact, also identify the primary named entity (character, location, item, or organization) the fact is about, if any — use the exact name as written. Add 1-3 short lowercase tags describing the type of fact (e.g. \"appearance\", \"belief\", \"betrayal\", \"ability\", \"relationship\").\n"
      + "Return ONLY a JSON array, no markdown, no commentary:\n"
      + '[{"text": "Atomic canon fact", "category": "appropriate_category_id", "entity": "Name of character/location/item this is about, or omit if none", "tags": ["tag1", "tag2"]}]';

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        if (attempt > 1 && onProgress) onProgress("Retry " + attempt + " for section " + (i+1) + "...");
        const result = await geminiQualityCallFor("canon", prompt);
        const clean = result.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = clean.match(/\[([\s\S]*)\]/);
        if (!jsonMatch) { if (attempt < 5) { await new Promise(r => setTimeout(r, 10000)); continue; } break; }
        const parsed: Array<{ text: string; category: string; entity?: string; tags?: string[] }> = JSON.parse("[" + jsonMatch[1] + "]");
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(e => e.text && e.text.trim().length > 15);
          allEntries.push(...valid);
          if (onProgress) onProgress("✓ " + header + ": " + valid.length + " entries · " + allEntries.length + " total");
        }
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
        if (msg.startsWith("ALL_KEYS_LIMITED")) {
          await waitForKeyReset(msg, onProgress);
          continue;
        }
        const isRetryable = msg.includes("high demand") || msg.includes("RATE_LIMIT") ||
                            msg.includes("429") || msg.includes("503") || msg.includes("overloaded") ||
                            msg.includes("unavailable") || msg.includes("fetch") || msg.includes("network") ||
                            msg.includes("timeout") || msg.includes("AbortError");
        if (isRetryable) {
          const waitSec = Math.min(20 + attempt * 10, 90);
          if (onProgress) onProgress("Gemini busy — waiting " + waitSec + "s...");
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }
        if (onProgress) onProgress("⚠ Section " + (i+1) + " failed: " + msg + " — skipping");
        break;
      }
    }

    // Small pause between sections
    if (i < sections.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  if (onProgress) onProgress("✓ Complete — " + allEntries.length + " total entries extracted");
  return allEntries;
}


// ─── Distill Story (Inbox) ────────────────────────────────────────────────────
// Like Distill Canon but for player session notes, story content, campaign info.
// Output goes to Player Story subtab only.
export async function geminiDistillStory(
  sourceText: string,
  filename: string,
  onProgress?: (msg: string) => void,
  shouldAbort?: () => boolean
): Promise<string> {
  if (!hasGeminiQualityKey()) throw new Error("NO_GEMINI_KEY");

  const cappedText = sourceText.slice(0, 900000);
  const SOURCE_HEADER = "SOURCE: " + filename + "\n\n---\n" + cappedText + "\n---\n\n";

  // Chunked distillation — 4 focused calls instead of 1 giant call
  // Each call focuses on fewer sections = more detail per section = 4x total output
  const CHUNKS = [
    {
      label: "Characters & Relationships",
      prompt: SOURCE_HEADER
        + "Extract ONLY these sections from the above content. Be exhaustive — include every detail.\n\n"
        + "## PLAYER CHARACTER\n"
        + "Full name, titles, physical appearance, personality, abilities/powers, backstory, current condition, equipment worn, inventory.\n\n"
        + "## CHARACTERS MET\n"
        + "Every NPC encountered: name, description, role, personality, what they said/revealed, secrets they carry.\n\n"
        + "## RELATIONSHIPS\n"
        + "Every relationship: nature (friend/enemy/ally/neutral), history, current dynamic, trust level, recent changes.\n\n"
        + "## ROMANCE & BONDS\n"
        + "Any romantic interest, deep emotional bonds, love interests: who, what happened, current status, feelings involved.",
    },
    {
      label: "Events & Quests",
      prompt: SOURCE_HEADER
        + "Extract ONLY these sections from the above content. Be exhaustive — include every detail.\n\n"
        + "## EVENTS & SESSIONS\n"
        + "Everything that happened in strict chronological order: scene by scene, what occurred, who was involved, what was said, consequences.\n\n"
        + "## ACTIVE QUESTS\n"
        + "Every active quest/mission: name, goal, who gave it, why, current progress, obstacles, complications, deadline.\n\n"
        + "## PLAYER DECISIONS\n"
        + "Every major choice made: what options existed, what was chosen, immediate consequences, potential future impact.\n\n"
        + "## CURRENT STATUS\n"
        + "Exact current situation: location, time, who is present, active threats, immediate next steps, what happens when we resume.",
    },
    {
      label: "World & Lore",
      prompt: SOURCE_HEADER
        + "Extract ONLY these sections from the above content. Be exhaustive — include every detail.\n\n"
        + "## LOCATIONS VISITED\n"
        + "Every place visited or mentioned: name, full description, atmosphere, significance, what happened there, who lives/works there.\n\n"
        + "## DISCOVERIES & LORE\n"
        + "All new information learned: world history, secrets revealed, mysteries uncovered, rules of the world clarified, factions explained.\n\n"
        + "## MAGIC & ABILITIES\n"
        + "Every spell, ability, power used or mentioned: how it works, who has it, limitations, costs, what it revealed.",
    },
    {
      label: "Items & Mysteries",
      prompt: SOURCE_HEADER
        + "Extract ONLY these sections from the above content. Be exhaustive — include every detail.\n\n"
        + "## ITEMS & INVENTORY\n"
        + "Every item, weapon, artifact, tool mentioned: name, description, properties, who has it, how it was obtained, significance.\n\n"
        + "## UNRESOLVED MYSTERIES\n"
        + "Every open question, unexplained event, unresolved thread, planted hook, ominous hint, unanswered question.\n\n"
        + "## SESSION NOTES\n"
        + "Any important meta-information: tone shifts, significant NPC reactions, world-changing events, things to remember for next session.",
    },
  ];

  const results: string[] = [];

  for (let i = 0; i < CHUNKS.length; i++) {
    if (shouldAbort && shouldAbort()) {
      if (onProgress) onProgress("⏸ Paused after " + i + "/" + CHUNKS.length + " sections");
      return results.join("\n\n");
    }

    const chunk = CHUNKS[i];
    if (onProgress) onProgress("(" + (i+1) + "/" + CHUNKS.length + ") Distilling: " + chunk.label + "...");

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        if (attempt > 1 && onProgress) onProgress("Retry " + attempt + " for " + chunk.label + "...");
        const result = await geminiQualityCallFor("inbox", chunk.prompt);
        results.push(result);
        if (onProgress) onProgress("✓ (" + (i+1) + "/" + CHUNKS.length + ") " + chunk.label + " done · " + result.length.toLocaleString() + " chars");
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (msg.startsWith("ALL_KEYS_LIMITED")) {
          await waitForKeyReset(msg, onProgress);
          continue;
        }
        const isRetryable = msg.includes("high demand") || msg.includes("RATE_LIMIT") ||
                            msg.includes("429") || msg.includes("503") || msg.includes("overloaded") ||
                            msg.includes("unavailable") || msg.includes("fetch") || msg.includes("network") ||
                            msg.includes("timeout") || msg.includes("AbortError");
        if (isRetryable) {
          const waitSec = Math.min(30 + attempt * 5, 120);
          if (onProgress) onProgress("Gemini busy — waiting " + waitSec + "s...");
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }
        // Non-retryable — skip this chunk
        if (onProgress) onProgress("⚠ " + chunk.label + " failed: " + msg + " — skipping");
        break;
      }
    }

    if (i < CHUNKS.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  const combined = results.join("\n\n");
  if (onProgress) onProgress("✓ Distillation complete! " + combined.length.toLocaleString() + " chars across " + results.length + " sections");
  return combined;
}

// ─── Import Story Reference to Vault (Player Story subtab) ───────────────────
export async function geminiImportStoryToVault(
  storyReference: string,
  filename: string,
  onProgress?: (msg: string) => void,
  shouldAbort?: () => boolean
): Promise<Array<{ text: string; category: string; entity?: string; tags?: string[] }>> {
  if (!hasGeminiQualityKey()) throw new Error("NO_GEMINI_KEY");

  const SECTION_CATEGORY_MAP: Record<string, string> = {
    "PLAYER CHARACTER": "player-character",
    "CHARACTERS MET": "characters",
    "CHARACTERS": "characters",
    "LOCATIONS VISITED": "locations",
    "LOCATIONS": "locations",
    "RELATIONSHIPS": "relationships",
    "ROMANCE & BONDS": "romance",
    "ROMANCE": "romance",
    "BONDS": "romance",
    "EVENTS & SESSIONS": "timeline-continuity",
    "EVENTS": "timeline-continuity",
    "SESSIONS": "session-notes",
    "ACTIVE QUESTS": "quests-plotlines",
    "QUESTS": "quests-plotlines",
    "DISCOVERIES & LORE": "lore-mythology",
    "DISCOVERIES": "lore-mythology",
    "LORE": "lore-mythology",
    "ITEMS & INVENTORY": "items-equipment",
    "ITEMS": "items-equipment",
    "INVENTORY": "items-equipment",
    "PLAYER DECISIONS": "meta-information",
    "DECISIONS": "meta-information",
    "CURRENT STATUS": "timeline-continuity",
    "STATUS": "timeline-continuity",
    "MAGIC": "magic-supernatural",
    "ABILITIES": "player-character",
    "HISTORY": "history",
    "MYSTERIES": "mysteries",
    "CONFLICTS": "conflict-combat",
  };

  function getSectionCategory(header: string): string {
    const upper = header.toUpperCase().trim();
    if (SECTION_CATEGORY_MAP[upper]) return SECTION_CATEGORY_MAP[upper];
    for (const key of Object.keys(SECTION_CATEGORY_MAP)) {
      if (upper.includes(key)) return SECTION_CATEGORY_MAP[key];
    }
    return "session-notes";
  }

  const rawSections = storyReference.split("\n## ");
  const sections = rawSections
    .slice(1)
    .map(s => ({ raw: "## " + s, header: s.split("\n")[0].trim() }))
    .filter(s => s.raw.length > 50);

  if (sections.length === 0) {
    sections.push({ raw: storyReference, header: "CONTENT" });
  }

  const allEntries: Array<{ text: string; category: string; entity?: string; tags?: string[] }> = [];
  if (onProgress) onProgress("Found " + sections.length + " sections to process...");

  for (let i = 0; i < sections.length; i++) {
    if (shouldAbort && shouldAbort()) {
      if (onProgress) onProgress("⏸ Paused — " + allEntries.length + " entries so far");
      return allEntries;
    }

    const { raw, header } = sections[i];
    const category = getSectionCategory(header);

    if (onProgress) onProgress("(" + (i + 1) + "/" + sections.length + ") " + header + " → " + category + "...");

    const prompt = "Convert this section of a Story Reference Document into individual vault entries for the Player Story.\n\n"
      + "SECTION: " + header + "\n"
      + "TARGET CATEGORY: " + category + "\n\n"
      + raw + "\n\n"
      + "RULES:\n"
      + "- Each entry = one clear self-contained factual sentence\n"
      + "- Every bullet point and sub-bullet becomes at least one entry\n"
      + "- Do NOT modify — only split into individual facts\n"
      + "- All entries use category: \"" + category + "\"\n"
      + "- For each fact, also identify the primary named entity (character, location, item) it's about, if any — use the exact name as written. Add 1-3 short lowercase tags describing the type of fact.\n\n"
      + "Return ONLY a JSON array:\n"
      + '[{"text": "fact here", "category": "' + category + '", "entity": "Name or omit if none", "tags": ["tag1"]}]';

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        if (attempt > 1 && onProgress) onProgress("Retry " + attempt + " for section " + (i+1) + "...");
        const result = await geminiQualityCallFor("inbox", prompt);
        const clean = result.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = clean.match(/\[([\s\S]*)\]/);
        if (!jsonMatch) { if (attempt < 5) { await new Promise(r => setTimeout(r, 10000)); continue; } break; }
        const parsed: Array<{ text: string; category: string; entity?: string; tags?: string[] }> = JSON.parse("[" + jsonMatch[1] + "]");
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(e => e.text && e.text.trim().length > 15);
          allEntries.push(...valid);
          if (onProgress) onProgress("✓ " + header + ": " + valid.length + " entries · " + allEntries.length + " total");
        }
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
        if (msg.startsWith("ALL_KEYS_LIMITED")) {
          await waitForKeyReset(msg, onProgress);
          continue;
        }
        const isRetryable = msg.includes("high demand") || msg.includes("RATE_LIMIT") ||
                            msg.includes("429") || msg.includes("503") || msg.includes("overloaded") ||
                            msg.includes("unavailable") || msg.includes("fetch") || msg.includes("network") ||
                            msg.includes("timeout") || msg.includes("AbortError");
        if (isRetryable) {
          const waitSec = Math.min(20 + attempt * 10, 90);
          if (onProgress) onProgress("Gemini busy — waiting " + waitSec + "s...");
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }
        if (onProgress) onProgress("⚠ Section " + (i+1) + " failed: " + msg + " — skipping");
        break;
      }
    }
    if (i < sections.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  if (onProgress) onProgress("✓ Complete — " + allEntries.length + " total entries");
  return allEntries;
}

// [PENSIEVE PIPELINE] Three-stage: Cerebras pre-filter → DeepSeek Investigation → Gemini answer
// This function handles Stage 2: DeepSeek Investigation
// Stage 1 (Cerebras keyword pre-filter) happens in the Pensieve page before calling this
// Stage 3 (Gemini final answer) is a separate call in the Pensieve page
export async function geminiSemanticSearch(
  query: string,
  entries: Array<{ id: string; text: string; category: string }>
): Promise<Array<{ id: string; text: string; category: string; relevance: string }>> {
  if (!hasGeminiKey() || entries.length === 0) return [];

  // Stage 2: DeepSeek Investigation
  // Takes the pre-filtered candidates and determines what's actually relevant
  const entriesList = entries.map((e, i) => i + ". [" + e.category + "] " + e.text).join("\n");

  const prompt = "You are investigating a story/RPG archive to answer: \"" + query + "\"\n\n"
    + "INVESTIGATION TASK:\n"
    + "- Read all entries carefully\n"
    + "- Identify entries that are DIRECTLY relevant to the question\n"
    + "- Include entries that provide important context or background\n"
    + "- Resolve ambiguity — if two entries seem contradictory, include both\n"
    + "- Think like a historian: what evidence actually answers this question?\n\n"
    + "ARCHIVE ENTRIES:\n" + entriesList + "\n\n"
    + "Return a JSON array of relevant entry indices with why they matter:\n"
    + "[{\"index\": 0, \"relevance\": \"explains why this entry answers the question\"}]\n"
    + "Return [] only if truly nothing is relevant.";

  try {
    const result = await geminiCall(prompt);
    const clean = result.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = clean.match(/\[([\s\S]*)\]/);
    if (!jsonMatch) return [];
    const parsed: Array<{ index: number; relevance: string }> = JSON.parse("[" + jsonMatch[1] + "]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(p => p.index >= 0 && p.index < entries.length)
      .map(p => ({ ...entries[p.index], relevance: p.relevance }));
  } catch {
    // Fallback: return all candidates if investigation fails
    return entries.slice(0, 20).map(e => ({ ...e, relevance: "Keyword match" }));
  }
}


// [ARCHIVIST] Gemini generates the final human-readable Pensieve answer
export async function geminiPensieveFinalAnswer(
  query: string,
  evidence: Array<{ text: string; category: string; relevance: string }>
): Promise<string> {
  if (!hasGeminiQualityKey() || evidence.length === 0) {
    return "I found " + evidence.length + " relevant entries but need a Gemini key to generate a narrative answer. Check Settings → AI.";
  }

  const evidenceText = evidence.map((e, i) =>
    (i + 1) + ". [" + e.category + "] " + e.text + "\n   (Why relevant: " + e.relevance + ")"
  ).join("\n\n");

  const prompt = "You are The Archivist — an intelligent assistant for a story/RPG campaign.\n\n"
    + "The user asked: \"" + query + "\"\n\n"
    + "Here is the evidence from the archive:\n\n"
    + evidenceText + "\n\n"
    + "Write a clear, intelligent answer to the user's question based on this evidence.\n"
    + "Be conversational but precise. If the evidence is incomplete, say so.\n"
    + "Do not just list the evidence — synthesize it into a proper answer.\n"
    + "If there are contradictions in the evidence, highlight them.";

  try {
    return await geminiQualityCall(prompt);
  } catch {
    return "Based on the archive:\n\n" + evidence.map(e => "• " + e.text).join("\n");
  }
}


// [ARCHIVIST] Gemini handles rule organization (quick summaries)
export async function geminiOrganizeRules(
  rules: string[]
): Promise<{ organized: string[]; summary: string }> {
  if (!hasGeminiKey() || rules.length === 0) return { organized: rules, summary: "" };

  const rulesList = rules.map((r, i) => i + ". " + r).join("\n");
  const prompt = "Organize this RPG rulebook. Group similar rules, remove duplicates, add group headers in ALL CAPS like === COMBAT RULES ===.\n\n"
    + "Rules:\n" + rulesList + "\n\n"
    + "Return ONLY JSON:\n"
    + '{"organized": ["rule1", "=== GROUP ===", "rule2"], "summary": "what was done"}';

  try {
    const result = await geminiQualityCall(prompt);
    const clean = result.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.organized && Array.isArray(parsed.organized)) return parsed;
    }
    return { organized: rules, summary: "" };
  } catch {
    return { organized: rules, summary: "" };
  }
}

// ─── FEATURE: Verify Story Categories ────────────────────────────────────────

// [ANALYST] DeepSeek handles category verification
export async function geminiVerifyCategories(
  entries: Array<{ id: string; text: string; category: string }>,
  allCategories: string[]
): Promise<Array<{ id: string; text: string; currentCategory: string; suggestedCategory: string; reason: string; changed: boolean }>> {
  if (!hasGeminiKey() || entries.length === 0) return [];

  const batch = entries.slice(0, 40);
  const entriesList = batch.map((e, i) => i + ". [" + e.category + "] " + e.text.slice(0, 100)).join("\n");

  const prompt = "Audit these story archive entries. Find ones in the wrong category.\n\n"
    + "Available categories: " + allCategories.join(", ") + "\n\n"
    + "Entries:\n" + entriesList + "\n\n"
    + "Return ONLY entries that need moving:\n"
    + '[{"index": 0, "suggestedCategory": "better-category", "reason": "brief reason"}]\n'
    + "If all correct, return [].";

  try {
    const result = await groqCall(prompt);
    const clean = result.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed: Array<{ index: number; suggestedCategory: string; reason: string }> = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(p => p.index >= 0 && p.index < batch.length)
      .map(p => ({
        id: batch[p.index].id,
        text: batch[p.index].text,
        currentCategory: batch[p.index].category,
        suggestedCategory: p.suggestedCategory,
        reason: p.reason,
        changed: false,
      }));
  } catch {
    return [];
  }
}

// ─── FEATURE: Canon Placement ─────────────────────────────────────────────────

// [ANALYST] DeepSeek handles canon placement
export async function geminiCanonPlacement(
  newContent: string,
  existingCanon: string[],
  categoryName: string
): Promise<{ placement: string; context: string; suggestion: string }> {
  if (!hasGeminiKey()) return { placement: "", context: "", suggestion: "" };

  const canonSummary = existingCanon.slice(0, 10).map((c, i) => (i + 1) + ". " + c.slice(0, 200)).join("\n");
  const prompt = "A new entry was added to canon category \"" + categoryName + "\".\n\n"
    + "Existing entries:\n" + canonSummary + "\n\n"
    + "New content:\n" + newContent.slice(0, 500) + "\n\n"
    + "Return ONLY JSON:\n"
    + '{"placement": "where it belongs", "context": "why", "suggestion": "continuity notes"}';

  try {
    const result = await groqCall(prompt);
    const clean = result.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        placement: parsed.placement || "",
        context: parsed.context || "",
        suggestion: parsed.suggestion || "",
      };
    }
    return { placement: "", context: "", suggestion: "" };
  } catch {
    return { placement: "", context: "", suggestion: "" };
  }
}

// ─── FEATURE: Timeline Separation Check ──────────────────────────────────────

// [ANALYST] DeepSeek handles timeline separation

// ─── Refine Timeline Save ──────────────────────────────────────────────────────
// Cleans up and organizes a save's content for clarity while preserving every fact.
// Optionally checks against other saves to flag (not silently resolve) continuity clashes.
export async function geminiRefineTimelineSave(
  content: string,
  saveName: string,
  otherSaveSummaries: Array<{ name: string; snippet: string }> = []
): Promise<{ refined: string; warnings: string[] }> {
  if (!hasGeminiKey() && !hasGeminiQualityKey() && !hasGeminiQualityKey2() && !hasGeminiQualityKey3()) {
    throw new Error("NO_KEY");
  }

  const othersContext = otherSaveSummaries.length > 0
    ? "\n\nOther existing saves in this timeline (for clash-checking only — do not merge or copy from these):\n"
      + otherSaveSummaries.map(s => "- \"" + s.name + "\": " + s.snippet.slice(0, 200)).join("\n")
    : "";

  const prompt = "You are organizing a tabletop RPG timeline save document called \"" + saveName + "\".\n\n"
    + "TASK: Reorganize and clean up the save below for maximum clarity and readability. "
    + "Group related information under clear headers (Characters Present, Location, Events, Decisions Made, Current Status, etc — adapt headers to what's actually in the content). "
    + "Fix any redundancy or awkward phrasing. "
    + "DO NOT remove, invent, or alter any fact, name, number, or detail — every piece of information must be preserved exactly, just better organized.\n\n"
    + "SAVE CONTENT:\n---\n" + content + "\n---\n"
    + othersContext + "\n\n"
    + "Return your response as JSON with this exact structure:\n"
    + '{"refined": "the reorganized save content in markdown", "warnings": ["any continuity clash with other saves you noticed, if none then empty array"]}\n'
    + "Return ONLY the JSON object, no other text, no markdown code fences.";

  const result = await geminiQualityCallFor("general", prompt);
  const clean = result.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    return {
      refined: typeof parsed.refined === "string" ? parsed.refined : content,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  } catch {
    // If JSON parsing fails, fall back to using the raw response as the refined text
    return { refined: clean, warnings: [] };
  }
}

export async function geminiCheckTimelineSeparation(
  currentTimeline: { name: string; content: string },
  otherTimelines: Array<{ name: string; content: string }>
): Promise<{ hasConflicts: boolean; conflicts: Array<{ timeline: string; issue: string }> }> {
  if (!hasGeminiKey() || otherTimelines.length === 0) return { hasConflicts: false, conflicts: [] };

  const others = otherTimelines.slice(0, 5).map(t => "\"" + t.name + "\":\n" + t.content.slice(0, 300)).join("\n\n");
  const prompt = "Check if this timeline conflicts with existing ones.\n\n"
    + "NEW: \"" + currentTimeline.name + "\"\n" + currentTimeline.content.slice(0, 400) + "\n\n"
    + "EXISTING:\n" + others + "\n\n"
    + "Return ONLY JSON:\n"
    + '{"hasConflicts": false, "conflicts": [{"timeline": "name", "issue": "description"}]}';

  try {
    const result = await groqCall(prompt);
    const clean = result.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { hasConflicts: parsed.hasConflicts ?? false, conflicts: parsed.conflicts ?? [] };
    }
    return { hasConflicts: false, conflicts: [] };
  } catch {
    return { hasConflicts: false, conflicts: [] };
  }
}

// ─── FEATURE: AI-First Batch Classifier ──────────────────────────────────────

// [HISTORIAN] DeepSeek handles inbox sorting
export async function geminiClassifyText(
  text: string,
  allCategories: string[]
): Promise<Array<{ text: string; category: string }>> {
  if (!hasGeminiKey()) return [];

  const chunks = text
    .split(/\n\n+/)
    .flatMap(para => para.split(/(?<=[.!?])\s+/))
    .map(s => s.trim())
    .filter(s => s.length > 15);

  if (chunks.length === 0) return [];

  const BATCH_SIZE = 30;
  const results: Array<{ text: string; category: string }> = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const entriesList = batch.map((c, idx) => idx + ". " + c).join("\n");

    const prompt = "Classify each entry into ONE category.\n\n"
      + "Categories: " + allCategories.join(", ") + "\n\n"
      + "Entries:\n" + entriesList + "\n\n"
      + "Return ONLY JSON:\n"
      + '[{"index": 0, "category": "category-name"}]';

    try {
      const result = await geminiCall(prompt);
      const clean = result.replace(/```json|```/g, "").trim();
      const jsonMatch = clean.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed: Array<{ index: number; category: string }> = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
            if (p.index >= 0 && p.index < batch.length) {
              results.push({ text: batch[p.index], category: p.category });
            }
          });
        }
      }
    } catch {
      batch.forEach(t => results.push({ text: t, category: "meta-information" }));
    }
  }

  return results;
}

// ─── FEATURE: Extract Canon to Vault ─────────────────────────────────────────

export interface ExtractedVaultEntry {
  text: string;
  category: string;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function testDeepSeekConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await deepSeekCall("Reply with exactly: CONNECTED");
    return { ok: true, message: result.includes("CONNECTED") ? "Connected successfully" : "Connected" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "NO_KEY") return { ok: false, message: "No DeepSeek API key set" };
    if (msg === "INVALID_KEY") return { ok: false, message: "Invalid DeepSeek API key" };
    if (msg === "RATE_LIMIT") return { ok: false, message: "Rate limit — try again shortly" };
    return { ok: false, message: msg };
  }
}


// [ANALYST] DeepSeek handles extraction
export async function geminiExtractCanonToVault(
  content: string,
  filename: string,
  onProgress?: (message: string) => void
): Promise<ExtractedVaultEntry[]> {
  if (!hasGeminiKey()) return [];

  if (onProgress) onProgress("Preparing extraction...");

  // Split into 120k char chunks (fits in Groq 128k context window)
  const MAX_CHARS = 40000;
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += MAX_CHARS) {
    chunks.push(content.slice(i, i + MAX_CHARS));
  }

  const allEntries: ExtractedVaultEntry[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) {
      onProgress("Processing part " + (i + 1) + " of " + chunks.length + "... (" + allEntries.length + " facts found)");
    }

    const prompt = "You are an expert story archivist. Extract EVERY SINGLE fact from this text.\n\n"
      + "Source: \"" + filename + "\", part " + (i + 1) + " of " + chunks.length + "\n"
      + "---\n"
      + chunks[i]
      + "\n---\n\n"
      + "RULES:\n"
      + "- Extract EVERY named character, place, relationship, item, spell, creature, organization, event, rule, and world detail\n"
      + "- Include physical descriptions, personality traits, abilities, backstory details\n"
      + "- Include dialogue-revealed facts (e.g. if a character says something that reveals a fact)\n"
      + "- Include minor characters, background locations, passing mentions\n"
      + "- Each fact = one clear self-contained sentence with the subject named explicitly\n"
      + "- Aim for 100-200 facts per section — more is always better\n"
      + "- Do NOT summarize — extract individual atomic facts\n\n"
      + "CATEGORIES: characters, relationships, locations, magic-supernatural, organizations, history, lore-mythology, items-equipment, creatures-wildlife, rules, timeline-continuity, world-overview, conflict-combat, cultures-society\n\n"
      + "Return ONLY a JSON array:\n"
      + "[{\"text\": \"Harry Potter has a lightning-bolt shaped scar on his forehead.\", \"category\": \"characters\"},{\"text\": \"Hogwarts is a school of witchcraft and wizardry.\", \"category\": \"locations\"}]";

    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      try {
        const result = await groqCall(prompt, undefined, GROQ_EXTRACT_MODEL);
        const fence = String.fromCharCode(96,96,96);
        const clean = result.split(fence + "json").join("").split(fence).join("").trim();
        const jsonMatch = clean.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed: ExtractedVaultEntry[] = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            for (const entry of parsed) {
              if (!entry.text || !entry.category) continue;
              const k = entry.text.trim().toLowerCase().slice(0, 80);
              if (!seen.has(k) && entry.text.trim().length > 10) {
                seen.add(k);
                allEntries.push({ text: entry.text.trim(), category: entry.category });
              }
            }
          }
        }
        success = true;
      } catch (e) {
        attempts++;
        const msg = e instanceof Error ? e.message : "error";
        if (msg.includes("RATE_LIMIT") || msg.includes("429") || msg.includes("Too Many")) {
          const waitSec = 30 + (attempts * 30);
          if (onProgress) onProgress("Rate limit — waiting " + waitSec + "s before retry...");
          await wait(waitSec * 1000);
        } else if (msg.includes("TIMEOUT") || msg.includes("AbortError") || msg.includes("abort")) {
          const waitSec = 20;
          if (onProgress) onProgress("Timeout — waiting " + waitSec + "s before retry...");
          await wait(waitSec * 1000);
        } else {
          if (onProgress) onProgress("Part " + (i + 1) + " error: " + msg + " — retrying...");
          await wait(15000);
        }
      }
    }

    if (i < chunks.length - 1) {
      if (onProgress) onProgress("Waiting before next part...");
      await wait(20000); // 20s gap = max 3 requests/min, safely under 5/min limit
    }
  }

  if (onProgress) onProgress("Complete — " + allEntries.length + " facts extracted!");
  return allEntries;
}

// ─── AI Merge for Contradiction Resolution (Key 3 — general) ──────────────────
// Takes two conflicting/overlapping vault entries about the same subject and asks
// Gemini to combine them into one clear, accurate entry. Used by the "Merge" action
// in the Check Contradictions feature, on a per-pair basis (only spent when the user
// actually chooses to merge a specific pair, not during the free local scan).
export async function geminiMergeContradiction(
  textA: string,
  textB: string,
  subject: string
): Promise<string> {
  if (!hasGeminiQualityKey()) throw new Error("NO_GEMINI_KEY");

  const prompt = "You are merging two vault entries about the same subject (\"" + subject + "\") into one clear, accurate entry.\n\n"
    + "ENTRY A: " + textA + "\n"
    + "ENTRY B: " + textB + "\n\n"
    + "RULES:\n"
    + "- If both facts are true and compatible, combine them into one well-written sentence or two that captures both.\n"
    + "- If they genuinely conflict (e.g. one is outdated, one is more accurate or more recent), prefer the more specific/complete one, but do not silently discard meaningfully different information — if truly uncertain which is correct, keep both as a single entry noting the discrepancy.\n"
    + "- Do not add new information that wasn't in either entry.\n"
    + "- Keep it concise — this becomes a single vault entry, not a paragraph.\n\n"
    + "Return ONLY the merged entry text, nothing else — no quotes, no explanation, no markdown.";

  const result = await geminiQualityCallFor("general", prompt);
  return result.trim().replace(/^["']|["']$/g, "");
}