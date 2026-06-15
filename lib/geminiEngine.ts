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
    // Fall back to Gemini if no OpenRouter key
    return geminiQualityCall(prompt, systemInstruction, history);
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
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
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
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
    const result = await owlAlphaCall("Reply with exactly: CONNECTED");
    return { ok: true, message: result.includes("CONNECTED") ? "Connected (Owl Alpha ready)" : "Connected" };
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





// ─── OpenRouter (Owl Alpha + Nemotron 3 Ultra) ────────────────────────────────
const OPENROUTER_KEY_STORAGE = "valArchivesOpenRouterKey";
const OWL_ALPHA_MODEL = "openrouter/optimus-alpha";
const NEMOTRON_MODEL = "nvidia/llama-3.1-nemotron-ultra-253b-v1:free";
const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1/chat/completions";

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

export async function geminiQualityCall(
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  const key = getGeminiQualityKey();
  if (!key) {
    // Fall back to Cerebras if no Gemini key
    return geminiCall(prompt, systemInstruction, history);
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (history) {
    for (const msg of history) {
      contents.push({ role: msg.role, parts: [{ text: msg.text }] });
    }
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  body.generationConfig = { temperature: 0.7, maxOutputTokens: 65536 };

  const response = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;
    if (response.status === 403) throw new Error("INVALID_KEY");
    if (response.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.trim();
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

export async function geminiChat(
  message: string,
  masterPrompt: string,
  history: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  if (!hasGeminiKey() && !hasOpenRouterKey()) throw new Error("NO_KEY");

  const systemInstruction = `You are The Archivist — an intelligent AI assistant for a story/RPG campaign.\nYou have complete knowledge of this archive including both Canon Story facts and the Player's current journey.\nBe helpful, specific, and always stay consistent with established facts.\nYou can help with: storytelling, character analysis, world-building, quest planning, theories, and anything related to this campaign.\n\nARCHIVE CONTEXT:\n${masterPrompt.slice(0, 8000)}`;

  // Use Owl Alpha for chat if available (better story intelligence)
  if (hasOpenRouterKey()) {
    return owlAlphaCall(message, systemInstruction, history);
  }
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
  if (!hasGeminiKey() || entries.length === 0) return [];

  const entriesList = entries.map((e, i) => i + ". [" + e.category + "] " + e.text.slice(0, 120)).join("\n");
  const prompt = "A user wants to delete vault entries related to: \"" + query + "\"\n\n"
    + "Entries:\n" + entriesList + "\n\n"
    + "Return ONLY a JSON array of matching entry indices:\n"
    + '[{"index": 0, "reason": "brief reason"}]\n'
    + "If nothing matches, return: []";

  try {
    const result = await geminiCall(prompt);
    const clean = result.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed: Array<{ index: number; reason: string }> = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(p => p.index >= 0 && p.index < entries.length)
      .map(p => ({ ...entries[p.index], reason: p.reason }));
  } catch {
    return [];
  }
}

// ─── FEATURE: Semantic Search ─────────────────────────────────────────────────

// ─── Canon Distill ────────────────────────────────────────────────────────────
// Uses Gemini to read an entire source file and produce a structured canon
// reference document. Much better than direct extraction because Gemini reads
// the full text at once with complete context.
export async function geminiDistillCanon(
  sourceText: string,
  filename: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  if (!hasGeminiQualityKey()) {
    throw new Error("NO_GEMINI_KEY");
  }

  if (onProgress) onProgress("Sending to Gemini for distillation...");

  // Gemini 2.5 Flash supports 1M token context — HP1 is ~110k tokens, fits easily
  // Cap at 900k chars just to be safe
  const cappedText = sourceText.slice(0, 900000);

  const prompt = "You are a Canon Archivist for a tabletop RPG campaign. "
    + "Your job is to read this source material and produce a structured CANON REFERENCE DOCUMENT "
    + "that a Game Master can use as a definitive reference during play.\n\n"
    + "SOURCE: " + filename + "\n\n"
    + "---\n" + cappedText + "\n---\n\n"
    + "Create a comprehensive Canon Reference Document with these sections:\n\n"
    + "## CHARACTERS\n"
    + "For every named character: full name, physical description, personality, key traits, "
    + "abilities/powers, role in the story, key relationships, important history, secrets.\n\n"
    + "## LOCATIONS\n"
    + "Every named place: description, significance, who lives/works there, what happens there.\n\n"
    + "## RELATIONSHIPS\n"
    + "All meaningful relationships between characters: nature of relationship, history, tensions, dynamics.\n\n"
    + "## MAGIC & SUPERNATURAL\n"
    + "Every spell, magical ability, magical object, supernatural rule, and how magic works.\n\n"
    + "## ORGANIZATIONS & FACTIONS\n"
    + "Every group, institution, faction: purpose, members, hierarchy, goals.\n\n"
    + "## KEY EVENTS (Chronological)\n"
    + "Every significant event in story order: what happened, who was involved, consequences.\n\n"
    + "## WORLD RULES & LORE\n"
    + "How this world works: laws, customs, social structures, history, mythology, anything that defines the setting.\n\n"
    + "## ITEMS & ARTIFACTS\n"
    + "Every named object, weapon, tool, or artifact of significance.\n\n"
    + "## CANON FACTS (Important Details)\n"
    + "Any other facts that are canonically important — things a GM must never get wrong.\n\n"
    + "Be thorough and specific. Include minor characters and details. "
    + "Write each entry as a clear factual statement. "
    + "This document will be used as the sole reference for running this story as an RPG.";

  // Auto-retry indefinitely on high demand / rate limit errors
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      if (attempt > 1 && onProgress) onProgress("Attempt " + attempt + " — sending to Gemini...");
      const result = await geminiQualityCall(prompt);
      if (onProgress) onProgress("Distillation complete!");
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      const isOverloaded = msg.includes("high demand") || msg.includes("RATE_LIMIT") || 
                           msg.includes("429") || msg.includes("503") || msg.includes("overloaded") ||
                           msg.includes("unavailable") || msg.includes("fetch") || msg.includes("network") ||
                           msg.includes("timeout") || msg.includes("TIMEOUT") || msg.includes("AbortError");
      if (isOverloaded) {
        const waitSec = Math.min(30 + attempt * 5, 120); // 35s, 40s... up to 120s
        if (onProgress) onProgress("Gemini busy — waiting " + waitSec + "s before retry " + (attempt + 1) + "...");
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue; // retry
      }
      throw new Error(msg); // non-retryable error
    }
  }
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
  onProgress?: (msg: string) => void
): Promise<Array<{ text: string; category: string }>> {
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

  const allEntries: Array<{ text: string; category: string }> = [];
  if (onProgress) onProgress("Found " + sections.length + " sections to process...");

  for (let i = 0; i < sections.length; i++) {
    const { raw, header } = sections[i];
    const category = getSectionCategory(header);

    if (onProgress) onProgress("(" + (i + 1) + "/" + sections.length + ") " + header + " → " + category + "...");

    const prompt = "Convert this section of a Canon Reference Document into individual vault entries.\n\n"
      + "SECTION: " + header + "\n"
      + "TARGET CATEGORY: " + category + "\n\n"
      + raw + "\n\n"
      + "RULES:\n"
      + "- Each entry = one clear self-contained factual sentence\n"
      + "- Every bullet point and sub-bullet becomes at least one entry\n"
      + "- For characters: separate entries for physical description, personality, abilities, relationships, history\n"
      + "- Do NOT modify or summarize — only split into individual facts\n"
      + "- All entries use category: \"" + category + "\"\n\n"
      + "Return ONLY a JSON array:\n"
      + '[{"text": "fact here", "category": "' + category + '"}]';

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        if (attempt > 1 && onProgress) onProgress("Retry " + attempt + " for section " + (i+1) + "...");
        const result = await geminiQualityCall(prompt);
        const clean = result.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = clean.match(/\[([\s\S]*)\]/);
        if (!jsonMatch) { if (attempt < 5) { await new Promise(r => setTimeout(r, 10000)); continue; } break; }
        const parsed: Array<{ text: string; category: string }> = JSON.parse("[" + jsonMatch[1] + "]");
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(e => e.text && e.text.trim().length > 15);
          allEntries.push(...valid);
          if (onProgress) onProgress("✓ " + header + ": " + valid.length + " entries · " + allEntries.length + " total");
        }
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
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
    // Use Owl Alpha for Pensieve answers if available
    if (hasOpenRouterKey()) {
      return await owlAlphaCall(prompt);
    }
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