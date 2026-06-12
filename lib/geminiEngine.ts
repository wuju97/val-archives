// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI ENGINE — Central AI layer for Val Archives
// All calls use the user's own API key stored in localStorage
// Gracefully does nothing if no key is present
// ═══════════════════════════════════════════════════════════════════════════════

const GEMINI_KEY_STORAGE = "valArchivesGeminiKey";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ─── Key Management ───────────────────────────────────────────────────────────

export function getGeminiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GEMINI_KEY_STORAGE) || null;
}

export function setGeminiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
}

export function clearGeminiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GEMINI_KEY_STORAGE);
}

export function hasGeminiKey(): boolean {
  return !!getGeminiKey();
}

// ─── Core API Call ────────────────────────────────────────────────────────────

export async function geminiCall(
  prompt: string,
  systemInstruction?: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error("NO_KEY");

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Add history if provided
  if (history) {
    for (const msg of history) {
      contents.push({ role: msg.role, parts: [{ text: msg.text }] });
    }
  }

  // Add current prompt
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const body: Record<string, unknown> = { contents };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  body.generationConfig = {
    temperature: 0.7,
    maxOutputTokens: 2048,
  };

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
    if (response.status === 400) throw new Error(`BAD_REQUEST: ${msg}`);
    if (response.status === 403) throw new Error("INVALID_KEY");
    if (response.status === 429) throw new Error("RATE_LIMIT");
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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

// ─── FEATURE: Refine Inbox Classification ─────────────────────────────────────

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

Review and refine this Master Prompt to make it more effective, clearer, and better structured. 
- Fix any redundancy or contradictions
- Make instructions more precise and actionable
- Preserve ALL the factual content — do not remove any lore, rules, or character info
- Keep the same section structure
- Make it no longer than the original

Original Master Prompt:
${masterPrompt}

Return ONLY the refined prompt, no commentary:`;

  try {
    return await geminiCall(prompt);
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
    return await geminiCall(prompt);
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
    const result = await geminiCall(prompt);
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
    return await geminiCall(prompt);
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
    return await geminiCall(prompt);
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
  if (!hasGeminiKey()) throw new Error("NO_KEY");

  const systemInstruction = `You are an AI assistant with complete knowledge of this story/RPG archive.
Use the archive information below as your primary source of truth.
Be helpful, specific, and always stay consistent with established facts.
You can help with: storytelling, character analysis, world-building, quest planning, writing, and anything related to this archive.

ARCHIVE CONTEXT:
${masterPrompt.slice(0, 8000)}`;

  return geminiCall(message, systemInstruction, history);
}

// ─── FEATURE: Auto-enhance Rule ──────────────────────────────────────────────

export async function geminiEnhanceRule(rule: string): Promise<string> {
  if (!hasGeminiKey() || !rule.trim()) return rule;

  const prompt = `Improve this RPG/story rule to be clearer and more specific for an AI game master.
Keep the same intent. Make it unambiguous and actionable.
Original: "${rule}"
Return ONLY the improved rule:`;

  try {
    return await geminiCall(prompt);
  } catch {
    return rule;
  }
}

// ─── Error message helper ─────────────────────────────────────────────────────

export function geminiErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : "Unknown error";
  if (msg === "NO_KEY") return "Add your Gemini API key in Settings → AI to enable this feature.";
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

Make it comprehensive but focused on what matters for THIS specific story/campaign.

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
    return await geminiCall(prompt);
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
    return await geminiCall(prompt);
  } catch {
    return customPrompt;
  }
}

// ─── FEATURE: Smart Category Review (second pass) ────────────────────────────

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
  const catList = allCategories.join(", ");
  const ctx = archiveContext.slice(0, 800);

  const prompt = "You are an expert story/RPG archivist. Review these auto-classified entries and suggest better categories where needed.\n\n"
    + "Available categories: " + catList + "\n\n"
    + "Archive context (use this to make better decisions):\n" + ctx + "\n\n"
    + "Entries to review:\n" + entriesList + "\n\n"
    + "For each entry, decide if the category is correct or should be changed.\n"
    + "Return ONLY a JSON array, no other text:\n"
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