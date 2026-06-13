// ═══════════════════════════════════════════════════════════════════════════════
// DUAL AI ENGINE — Val Archives
// Cerebras: fast tasks (extraction, classification, search)
// Gemini: quality tasks (refine prompts, enhance, chat)
// Get Cerebras key at cloud.cerebras.ai (free, 1M tokens/day)
// Get Gemini key at aistudio.google.com (free, 250 req/day)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Cerebras (fast) ──────────────────────────────────────────────────────────
const CEREBRAS_KEY_STORAGE = "valArchivesGeminiKey"; // keep same key name for backwards compat
const CEREBRAS_MODEL = "llama-3.3-70b";
const CEREBRAS_API_BASE = "https://api.cerebras.ai/v1/chat/completions";

// ─── Gemini (quality) ─────────────────────────────────────────────────────────
const GEMINI_KEY_STORAGE = "valArchivesGeminiKeyQuality";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

  const response = await fetch(CEREBRAS_API_BASE, {
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
  });

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
  body.generationConfig = { temperature: 0.7, maxOutputTokens: 4096 };

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
  if (!hasGeminiKey()) throw new Error("NO_KEY");

  const systemInstruction = `You are an AI assistant with complete knowledge of this story/RPG archive.
Use the archive information below as your primary source of truth.
Be helpful, specific, and always stay consistent with established facts.
You can help with: storytelling, character analysis, world-building, quest planning, writing, and anything related to this archive.

ARCHIVE CONTEXT:
${masterPrompt.slice(0, 8000)}`;

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

export async function geminiSemanticSearch(
  query: string,
  entries: Array<{ id: string; text: string; category: string }>
): Promise<Array<{ id: string; text: string; category: string; relevance: string }>> {
  if (!hasGeminiKey() || entries.length === 0) return [];

  const BATCH_SIZE = 60;
  const allResults: Array<{ id: string; text: string; category: string; relevance: string }> = [];

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const entriesList = batch.map((e, idx) => idx + ". [" + e.category + "] " + e.text.slice(0, 150)).join("\n");

    const prompt = "Search this story archive for: \"" + query + "\"\n\n"
      + "Entries:\n" + entriesList + "\n\n"
      + "Return ONLY relevant entries as JSON:\n"
      + '[{"index": 0, "relevance": "why relevant"}]\n'
      + "If nothing relevant, return [].";

    try {
      const result = await geminiCall(prompt);
      const clean = result.replace(/```json|```/g, "").trim();
      const jsonMatch = clean.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed: Array<{ index: number; relevance: string }> = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          parsed
            .filter(p => p.index >= 0 && p.index < batch.length)
            .forEach(p => allResults.push({ ...batch[p.index], relevance: p.relevance }));
        }
      }
    } catch {}
  }

  return allResults;
}

// ─── FEATURE: Organize Rule Book ─────────────────────────────────────────────

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
    const result = await geminiCall(prompt);
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
    const result = await geminiCall(prompt);
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
    const result = await geminiCall(prompt);
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
    const result = await geminiCall(prompt);
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

    const prompt = "Extract story facts from this text for a world-building archive database.\n\n"
      + "Source: \"" + filename + "\", part " + (i + 1) + " of " + chunks.length + "\n"
      + "---\n"
      + chunks[i]
      + "\n---\n\n"
      + "Extract EVERY named character, location, relationship, magical ability, organization, creature, item, and world fact.\n"
      + "Be very thorough — extract as many facts as possible.\n"
      + "Each entry = one clear self-contained sentence.\n\n"
      + "Examples:\n"
      + "- \"Harry Potter is a young boy who lives with his aunt and uncle at 4 Privet Drive\" category: characters\n"
      + "- \"Hogwarts is a school for witchcraft and wizardry\" category: locations\n"
      + "- \"Hermione Granger is a highly intelligent witch and one of Harry Potter best friends\" category: characters\n"
      + "- \"Owls are used to deliver mail in the wizarding world\" category: world-overview\n\n"
      + "Categories: characters, relationships, locations, magic-supernatural, organizations, history, lore-mythology, items-equipment, creatures-wildlife, rules, timeline-continuity, world-overview, conflict-combat, cultures-society\n\n"
      + "Return ONLY a JSON array, nothing else:\n"
      + '[{"text": "fact here", "category": "category-name"}]';

    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      try {
        const result = await geminiCall(prompt);
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
        if (msg.includes("RATE_LIMIT") || msg.includes("429")) {
          const waitSec = attempts * 20;
          if (onProgress) onProgress("Rate limit — waiting " + waitSec + "s before retry...");
          await wait(waitSec * 1000);
        } else {
          if (onProgress) onProgress("Part " + (i + 1) + " error: " + msg);
          break;
        }
      }
    }

    if (i < chunks.length - 1) {
      if (onProgress) onProgress("Waiting before next part...");
      await wait(5000);
    }
  }

  if (onProgress) onProgress("Complete — " + allEntries.length + " facts extracted!");
  return allEntries;
}