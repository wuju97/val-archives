"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  loadArchive, saveArchive, addEntry, updateEntry, deleteEntry,
  regenerateMasterPrompt, CATEGORY_LABELS, CATEGORY_ICONS, StoryCategory,
  getPriorityLevel, setPriority,
} from "@/lib/archiveEngine";

// ─── Subcategory Map ──────────────────────────────────────────────────────────

const SUBCATEGORIES: Partial<Record<StoryCategory, string[]>> = {
  "world-overview": ["World Overview","Setting Description","Geography","Continents","Regions","Countries","Cities","Villages","Landmarks","Climate","Natural Resources","Maps","Borders"],
  "history": ["Ancient History","Prehistory","Founding Events","Historical Eras","Wars","Revolutions","Empires","Rise and Fall of Nations","Colonization","Disasters","Major Discoveries","Historical Figures","Treaties","Timeline of Events","Legends Based on Real Events"],
  "lore-mythology": ["Creation Myths","Cosmology","Religions","Gods","Pantheons","Demons","Prophecies","Sacred Texts","Folklore","Legends","Superstitions","Afterlife Beliefs","Origin Stories","World Mysteries"],
  "magic-supernatural": ["Magic Rules","Energy Sources","Spellcasting Methods","Schools of Magic","Limitations","Costs","Forbidden Magic","Rituals","Enchantments","Curses","Blessings","Magical Creatures","Artifacts","Dimensions","Planes of Existence","Supernatural Laws"],
  "science-technology": ["Technology Level","Scientific Principles","Medicine","Transportation","Communication","Engineering","Weapons Technology","Industrial Development","Experimental Sciences","Biotechnology","Artificial Intelligence","Space Travel"],
  "political-systems": ["Governments","Political Parties","Nobility","Royal Families","Succession Rules","Laws","Justice Systems","Diplomacy","International Relations","Political Conflicts","Ideologies","Corruption"],
  "organizations": ["Guilds","Orders","Religious Institutions","Corporations","Military Groups","Secret Societies","Criminal Syndicates","Rebel Groups","Academic Institutions","Mercenary Companies","Government Agencies"],
  "economy": ["Currencies","Trade Routes","Markets","Tax Systems","Industries","Wealth Distribution","Banking","Black Markets","Resources","Economic Crises","Imports/Exports"],
  "cultures-society": ["Languages","Customs","Traditions","Etiquette","Fashion","Cuisine","Art","Architecture","Festivals","Social Classes","Family Structures","Marriage Traditions","Education","Entertainment","Taboos","Values"],
  "species-races": ["Playable Races","Intelligent Species","Non-Human Civilizations","Biology","Lifespans","Physical Traits","Psychology","Culture","Interracial Relations","Evolution","Subspecies"],
  "characters": ["Protagonists","Antagonists","Supporting Characters","NPCs","Character Profiles","Physical Appearance","Personality","Goals","Motivations","Fears","Strengths","Weaknesses","Secrets","Character Arcs"],
  "relationships": ["Friendships","Rivalries","Romances","Family Trees","Mentorships","Political Alliances","Betrayals","Enemies","Reputations","Trust Levels","Relationship Histories"],
  "factions": ["Influence Networks","Territories","Leaders","Resources","Objectives","Internal Politics","Faction Relationships","Conflicts","Hierarchy","Membership"],
  "mysteries": ["Unsolved Events","Hidden Truths","Ancient Secrets","Unknown Locations","Disappearances","Conspiracies","Lost Civilizations","Prophecies","Identity Mysteries","Hidden Agendas","Unexplained Phenomena","Foreshadowing Clues"],
  "quests-plotlines": ["Main Plot","Subplots","Character Arcs","Quest Chains","Side Quests","Objectives","Rewards","Consequences","Branching Outcomes","Hooks","Climaxes","Resolutions"],
  "timeline-continuity": ["Chronological Events","Session Timeline","Character Timelines","Flashbacks","Future Events","Alternate Timelines","What-If Scenarios","Retcons","Ages","Dates","Continuity Notes"],
  "conflict-combat": ["Combat Rules","Battle Styles","Military Doctrine","Strategies","Duels","Wars","Weapon Systems","Power Scaling","Rankings","Tournament Structures"],
  "items-equipment": ["Weapons","Armor","Tools","Artifacts","Relics","Consumables","Quest Items","Treasures","Crafting Materials","Technology","Inventory Systems"],
  "creatures-wildlife": ["Animals","Monsters","Beasts","Dragons","Spirits","Undead","Ecology","Habitats","Behavior","Threat Levels","Domesticated Species"],
  "locations": ["Cities","Dungeons","Castles","Forests","Ruins","Temples","Planets","Dimensions","Hidden Areas","Safe Havens","Battlefields"],
  "themes-tone": ["Hope","Corruption","Redemption","Identity","Love","Sacrifice","War","Freedom","Survival","Found Family","Revenge","Moral Ambiguity","Tragedy","Comedy","Horror","Wonder"],
  "writing-style": ["Narrative Voice","POV Rules","Paragraph Style","Dialogue Style","Pacing","Descriptive Density","Humor Style","Violence Level","Romance Level","Prose Guidelines","Formatting Rules"],
  "session-notes": ["Player Decisions","Major Events","NPC Interactions","Combat Results","Loot Obtained","New Lore Learned","Consequences","Unresolved Threads","Future Hooks"],
  "meta-information": ["Author Notes","Revision Notes","Ideas Dump","Cut Content","Future Plans","Inspiration Sources","Research Notes","To-Do Lists","Canon Status","Retired Concepts"],
  "branching-canon": ["Main Canon","Alternate Universe","Non-Canon","Parallel Timelines","Bad Endings","Good Endings","Player Routes","Simulation Worlds","Dream Worlds","Fanon"],
  "emotional-architecture": ["Character Emotional States","Trauma Histories","Core Wounds","Desires","Needs","Internal Conflicts","Emotional Turning Points","Healing Journeys","Relationship Dynamics","Psychological Profiles"],
  "information-architecture": ["Facts","Rumors","Lies","Half-Truths","Unknown Information","Player Knowledge","Audience Knowledge","Character Knowledge","Hidden Information","Revealed Information","Contradictions"],
  "rules": ["Core Rules","Restrictions","Always Rules","Never Rules","Game Mechanics","Player Limits","World Laws","Meta Rules"],
  "player-character": ["Name & Identity","Physical Appearance","Personality","Backstory","Goals","Abilities & Powers","Inventory","Relationships","Character Arc","Current Status"],
  "geography": ["Continents","Regions","Countries","Cities","Villages","Landmarks","Climate","Natural Resources","Maps","Borders","Terrain"],
};

// ─── Auto-assign subcategory based on entry content ───────────────────────────
// Used for entries that don't have [SubTag] prefix (e.g. AI-extracted entries)
function guessSubcategory(text: string, category: StoryCategory): string | null {
  const subs = SUBCATEGORIES[category];
  if (!subs || subs.length === 0) return null;
  const lower = text.toLowerCase();

  // Category-specific keyword matching
  const keywordMap: Record<string, string[]> = {
    "Physical Appearance": ["tall","short","hair","eyes","skin","face","built","appearance","looks","blonde","dark","red hair","green eyes","blue eyes","brown","pale","scar"],
    "Personality": ["brave","kind","cunning","loyal","ambitious","intelligent","stubborn","shy","confident","arrogant","gentle","fierce","witty","serious","cheerful","mischievous"],
    "Goals": ["wants to","goal is","aims to","seeks","desires","hopes to","determined to","dreams of","mission is","objective"],
    "Motivations": ["motivated by","driven by","because of","in order to","so that","to protect","to prove","to find","to avenge","to save"],
    "Fears": ["fears","afraid of","terrified of","scared of","phobia","dread","nightmare","cannot stand"],
    "Strengths": ["gifted at","talented in","skilled at","excellent","powerful","strong","capable of","best at","known for"],
    "Weaknesses": ["weakness","struggles with","difficulty","flaw","vulnerable","susceptible","poor at","cannot"],
    "Secrets": ["secret","hidden","nobody knows","only","keeps","conceals","never told","private"],
    "Character Arcs": ["arc","development","growth","changes","transforms","learns","becomes","overcomes"],
    "Protagonists": ["protagonist","main character","hero","heroine","player character"],
    "Antagonists": ["antagonist","villain","enemy","oppose","against"],
    "NPCs": ["npc","shopkeeper","innkeeper","guard","merchant","townsperson"],
    "Romances": ["love","romance","relationship","dating","feelings for","attracted to","kiss","together"],
    "Friendships": ["friend","friendship","companion","ally","partner","bond"],
    "Rivalries": ["rival","rivalry","competition","compete","against each other"],
    "Betrayals": ["betray","betrayal","backstab","turncoat","double cross"],
    "Family Trees": ["father","mother","son","daughter","brother","sister","uncle","aunt","cousin","grandparent","family"],
    "Magic Rules": ["rule","law","principle","how magic","magic requires","magic cannot","magic must"],
    "Spellcasting Methods": ["cast","casting","spell","wand","incantation","gesture","verbal","ritual cast"],
    "Artifacts": ["artifact","relic","ancient","powerful object","legendary item","magical object"],
    "Weapons": ["sword","blade","dagger","bow","axe","staff","wand","gun","weapon","arms"],
    "Armor": ["armor","shield","protection","defense","plate","mail","cloak of protection"],
    "Cities": ["city","town","capital","metropolis","settlement","village","hamlet"],
    "Dungeons": ["dungeon","cave","underground","cavern","crypt","tomb","ruins underground"],
    "Ancient History": ["ancient","long ago","centuries","millennia","prehistory","old world","primordial"],
    "Wars": ["war","battle","conflict","siege","campaign","invasion","fought","defeated","conquered"],
    "Combat Rules": ["combat","fight","attack","defend","initiative","damage","hit points","round"],
    "Gods": ["god","goddess","deity","divine","omnipotent","worshipped","pantheon","celestial being"],
    "Prophecies": ["prophecy","foretold","destined","prophecy says","written that","will come"],
  };

  for (const [sub, keywords] of Object.entries(keywordMap)) {
    if (subs.includes(sub) && keywords.some(kw => lower.includes(kw))) {
      return sub;
    }
  }

  return "General";
}

export default function CategoryPage() {
  const params = useParams();
  const category = params.category as StoryCategory;
  const [archive, setArchive] = useState(loadArchive());
  const [input, setInput] = useState("");
  const [selectedSub, setSelectedSub] = useState<string>("");
  const [added, setAdded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterSub, setFilterSub] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => { setArchive(loadArchive()); }, []);

  const label = CATEGORY_LABELS[category] ?? category;
  const icon = CATEGORY_ICONS[category] ?? "📁";
  const subcategories = SUBCATEGORIES[category] ?? [];
  const allEntries = archive.entries.filter((e) => e.category === category);

  // Priority
  const priorityId = `story-${category}`;
  const priority = getPriorityLevel(archive, priorityId);

  function handlePriorityClick() {
    let updated;
    if (priority === "none") updated = setPriority(archive, priorityId, "blue");
    else if (priority === "blue") updated = setPriority(archive, priorityId, "red");
    else updated = setPriority(archive, priorityId, "none");
    saveArchive(updated);
    setArchive(updated);
  }

  const priorityColor = priority === "red" ? "#ef4444" : priority === "blue" ? "#3b82f6" : "var(--va-border)";
  const priorityLabel = priority === "red" ? "🔴 First Priority" : priority === "blue" ? "🔵 Second Priority" : "○ Set Priority";

  // Get subcategory tag from entry text (explicit [Tag] prefix)
  function getSubTag(text: string): string | null {
    const match = text.match(/^\[([^\]]+)\] /);
    return match ? match[1] : null;
  }

  function getDisplayText(text: string): string {
    return text.replace(/^\[[^\]]+\] /, "");
  }

  // For display: get explicit tag OR guess from content
  function getEffectiveSubTag(text: string): string {
    const explicit = getSubTag(text);
    if (explicit) return explicit;
    if (subcategories.length === 0) return "";
    const guessed = guessSubcategory(text, category);
    return guessed || "General";
  }

  // Entries filtered by subcategory and search
  const entries = allEntries.filter((e) => {
    const matchesSub = filterSub === "all" || getEffectiveSubTag(e.text) === filterSub;
    const matchesSearch = search.trim() === "" || e.text.toLowerCase().includes(search.toLowerCase());
    return matchesSub && matchesSearch;
  });

  if (!CATEGORY_LABELS[category]) return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>
      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.5rem" }}>← Home</Link>
      <Link href="/story-studio" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1rem" }}>← Story Studio</Link>
      <p style={{ color: "var(--va-text-muted)" }}>Category not found.</p>
    </div>
  );

  function handleAdd() {
    if (!input.trim()) return;
    const text = selectedSub ? `[${selectedSub}] ${input.trim()}` : input.trim();
    const updated = regenerateMasterPrompt(addEntry(archive, text, category));
    saveArchive(updated); setArchive(updated); setInput(""); setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function saveEdit(id: string) {
    if (!editingText.trim()) return;
    const updated = regenerateMasterPrompt(updateEntry(archive, id, editingText));
    saveArchive(updated); setArchive(updated); setEditingId(null); setEditingText("");
  }

  function doDelete(id: string) {
    const updated = regenerateMasterPrompt(deleteEntry(archive, id));
    saveArchive(updated); setArchive(updated); setDeleteConfirmId(null);
  }

  // Count entries per effective subcategory
  const subCounts: Record<string, number> = {};
  for (const entry of allEntries) {
    const tag = getEffectiveSubTag(entry.text);
    subCounts[tag] = (subCounts[tag] ?? 0) + 1;
  }

  const S = {
    surface: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem" },
    input: { background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem", outline: "none", color: "var(--va-text)", fontSize: "0.875rem" },
    muted: { color: "var(--va-text-muted)" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--va-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Link href="/dashboard" style={{ ...S.muted, fontSize: "0.875rem" }}>← Home</Link>
            <span style={{ ...S.muted, fontSize: "0.875rem" }}>/</span>
            <Link href="/story-studio" style={{ ...S.muted, fontSize: "0.875rem" }}>Story Studio</Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "2.5rem" }}>{icon}</span>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>{label}</h1>
              <p style={{ ...S.muted, fontSize: "0.875rem" }}>{allEntries.length} {allEntries.length === 1 ? "entry" : "entries"}</p>
            </div>
          </div>
        </div>
        {/* Priority button */}
        <button onClick={handlePriorityClick}
          style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: `2px solid ${priorityColor}`, background: priority !== "none" ? priorityColor : "transparent", color: priority !== "none" ? "white" : "var(--va-text-muted)", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600", transition: "all 0.2s", marginTop: "0.5rem" }}>
          {priorityLabel}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1 }}>

        {/* Left — Subcategory sidebar */}
        {subcategories.length > 0 && (
          <aside style={{ width: "14rem", borderRight: "1px solid var(--va-border)", background: "var(--va-surface)", padding: "1rem", flexShrink: 0 }}>
            <p style={{ ...S.muted, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>Subcategories</p>
            <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <button onClick={() => setFilterSub("all")}
                style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem", background: filterSub === "all" ? "var(--va-border)" : "transparent", color: filterSub === "all" ? "var(--va-text)" : "var(--va-text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>All</span>
                <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{allEntries.length}</span>
              </button>
              {subcategories.map((sub) => (
                <button key={sub} onClick={() => setFilterSub(sub)}
                  style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem", background: filterSub === sub ? "var(--va-border)" : "transparent", color: filterSub === sub ? "var(--va-text)" : "var(--va-text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>{sub}</span>
                  {(subCounts[sub] ?? 0) > 0 && <span style={{ fontSize: "0.7rem", color: "var(--va-accent)" }}>{subCounts[sub]}</span>}
                </button>
              ))}
              {/* General bucket for entries that don't match any subcategory */}
              {(subCounts["General"] ?? 0) > 0 && (
                <button onClick={() => setFilterSub("General")}
                  style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem", background: filterSub === "General" ? "var(--va-border)" : "transparent", color: filterSub === "General" ? "var(--va-text)" : "var(--va-text-muted)", display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--va-border)", marginTop: "0.25rem", paddingTop: "0.5rem" }}>
                  <span style={{ fontStyle: "italic" }}>General</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--va-accent)" }}>{subCounts["General"]}</span>
                </button>
              )}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <main style={{ flex: 1, padding: "1.5rem 2rem" }}>

          {/* Add entry */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
              {subcategories.length > 0 && (
                <select value={selectedSub} onChange={(e) => setSelectedSub(e.target.value)} style={{ ...S.input, minWidth: "180px" }}>
                  <option value="">No subcategory</option>
                  {subcategories.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                </select>
              )}
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={selectedSub ? `Add to ${selectedSub}...` : `Add to ${label}...`}
                style={{ ...S.input, flex: 1, minWidth: "200px" }} />
              <button onClick={handleAdd} disabled={!input.trim()}
                style={{ background: "var(--va-accent)", color: "white", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: !input.trim() ? 0.3 : 1, flexShrink: 0 }}>
                Add
              </button>
            </div>
            {selectedSub && input && (
              <p style={{ ...S.muted, fontSize: "0.75rem" }}>Will be added as: [{selectedSub}] {input}</p>
            )}
            {added && <p style={{ color: "#4ade80", fontSize: "0.875rem", marginTop: "0.25rem" }}>✓ Added to Vault</p>}
          </div>

          {/* Search + filter bar */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries..."
              style={{ ...S.input, flex: 1 }} />
            {filterSub !== "all" && (
              <button onClick={() => setFilterSub("all")} style={{ ...S.muted, background: "none", border: "1px solid var(--va-border)", borderRadius: "0.375rem", padding: "0 0.75rem", cursor: "pointer", fontSize: "0.75rem" }}>
                Clear filter ×
              </button>
            )}
          </div>

          {/* Active filter indicator */}
          {(filterSub !== "all" || search) && (
            <p style={{ ...S.muted, fontSize: "0.875rem", marginBottom: "1rem" }}>
              Showing <strong style={{ color: "var(--va-text)" }}>{entries.length}</strong> entries
              {filterSub !== "all" && <span> in <span style={{ color: "var(--va-accent)" }}>{filterSub}</span></span>}
              {search && <span> matching "<span style={{ color: "var(--va-accent)" }}>{search}</span>"</span>}
            </p>
          )}

          {/* Entries */}
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: "4rem" }}>
              <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>{icon}</p>
              <p style={S.muted}>
                {allEntries.length === 0 ? "No entries yet. Add above or paste into Inbox." : "No entries match your filter."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {entries.map((entry) => {
                const effectiveSub = getEffectiveSubTag(entry.text);
                const hasExplicitTag = !!getSubTag(entry.text);
                const displayText = getDisplayText(entry.text);
                return (
                  <div key={entry.id} style={{ ...S.surface, padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {effectiveSub && effectiveSub !== "General" && (
                          <span style={{ fontSize: "0.7rem", background: hasExplicitTag ? "var(--va-accent)" : "var(--va-border)", color: hasExplicitTag ? "white" : "var(--va-text-muted)", padding: "0.125rem 0.5rem", borderRadius: "9999px", opacity: hasExplicitTag ? 1 : 0.7 }}>
                            {effectiveSub}{!hasExplicitTag && " ~"}
                          </span>
                        )}
                        <span style={{ ...S.muted, fontSize: "0.7rem" }}>{new Date(entry.updatedAt).toLocaleString()}</span>
                      </div>
                      {editingId !== entry.id && deleteConfirmId !== entry.id && (
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                          <button onClick={() => { setEditingId(entry.id); setEditingText(entry.text); }} style={{ ...S.muted, background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>✏️ Edit</button>
                          <button onClick={() => setDeleteConfirmId(entry.id)} style={{ ...S.muted, background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>🗑️ Delete</button>
                        </div>
                      )}
                    </div>

                    {editingId === entry.id ? (
                      <div>
                        <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)}
                          style={{ ...S.input, minHeight: "80px", resize: "vertical", width: "100%", display: "block", marginBottom: "0.5rem", boxSizing: "border-box" }} autoFocus />
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button onClick={() => saveEdit(entry.id)} style={{ background: "#15803d", color: "white", padding: "0.25rem 0.75rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>✓ Save</button>
                          <button onClick={() => setEditingId(null)} style={{ ...S.muted, background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
                        </div>
                      </div>
                    ) : deleteConfirmId === entry.id ? (
                      <div>
                        <p style={{ fontSize: "0.875rem", color: "var(--va-text)", marginBottom: "0.75rem" }}>{displayText}</p>
                        <div style={{ background: "rgba(127,29,29,0.3)", border: "1px solid #7f1d1d", borderRadius: "0.375rem", padding: "0.75rem" }}>
                          <p style={{ color: "#fca5a5", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Delete? Cannot be undone.</p>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button onClick={() => doDelete(entry.id)} style={{ background: "#b91c1c", color: "white", padding: "0.25rem 0.75rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Yes</button>
                            <button onClick={() => setDeleteConfirmId(null)} style={{ ...S.muted, background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: "0.875rem", whiteSpace: "pre-wrap", color: "var(--va-text)" }}>{displayText}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}