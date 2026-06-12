 "use client";

import { useEffect, useState } from "react";
import {
  loadArchive,
  saveArchive,
  addEntry,
  deleteEntry,
  regenerateMasterPrompt,
} from "@/lib/archiveEngine";

type RelationshipType =
  | "loves"
  | "hates"
  | "allies"
  | "enemies"
  | "friends"
  | "rivals"
  | "discovered"
  | "owns"
  | "destroyed"
  | "created"
  | "betrayed"
  | "trusts"
  | "fears"
  | "mentors"
  | "seeks"
  | "guards"
  | "custom";

const RELATIONSHIP_TYPES: RelationshipType[] = [
  "loves", "hates", "allies", "enemies", "friends", "rivals",
  "discovered", "owns", "destroyed", "created", "betrayed",
  "trusts", "fears", "mentors", "seeks", "guards", "custom",
];

const TYPE_SYMBOLS: Record<RelationshipType, string> = {
  loves: "❤️", hates: "💢", allies: "🤝", enemies: "⚔️",
  friends: "🫂", rivals: "🔥", discovered: "🔍", owns: "👑",
  destroyed: "💥", created: "✨", betrayed: "🗡️", trusts: "🌟",
  fears: "👁️", mentors: "📚", seeks: "🧭", guards: "🛡️", custom: "🔗",
};

export default function RelationshipsPage() {
  const [archive, setArchive] = useState(loadArchive());
  const [entityA, setEntityA] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("allies");
  const [entityB, setEntityB] = useState("");
  const [customType, setCustomType] = useState("");
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setArchive(loadArchive());
  }, []);

  // Get all relationship entries
  const relationships = archive.entries.filter(
    (e) => e.category === "relationships"
  );

  function addRelationship() {
    if (!entityA.trim() || !entityB.trim()) return;

    const type = relationshipType === "custom" && customType.trim()
      ? customType.trim()
      : relationshipType;

    const text = note.trim()
      ? `${entityA.trim()} ${type} ${entityB.trim()} — ${note.trim()}`
      : `${entityA.trim()} ${type} ${entityB.trim()}`;

    let updated = addEntry(archive, text, "relationships");
    updated = regenerateMasterPrompt(updated);
    saveArchive(updated);
    setArchive(updated);

    setEntityA("");
    setEntityB("");
    setCustomType("");
    setNote("");
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function removeRelationship(id: string) {
    const updated = regenerateMasterPrompt(deleteEntry(archive, id));
    saveArchive(updated);
    setArchive(updated);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">

      <h1 className="text-5xl font-bold mb-2">🤝 Relationships</h1>
      <p className="text-gray-500 mb-8">
        Define connections between characters, artifacts, locations, and more.
      </p>

      {/* Add Relationship */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-10">
        <h2 className="text-xl font-bold mb-6 text-gray-300">Add Relationship</h2>

        <div className="flex flex-wrap items-center gap-3 mb-4">

          {/* Entity A */}
          <input
            value={entityA}
            onChange={(e) => setEntityA(e.target.value)}
            placeholder="Entity A (e.g. Valefor)"
            className="bg-gray-800 rounded-lg px-4 py-2 outline-none text-white placeholder-gray-600 flex-1 min-w-[150px]"
          />

          {/* Relationship type */}
          <select
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
            className="bg-gray-800 rounded-lg px-4 py-2 outline-none text-blue-300"
          >
            {RELATIONSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_SYMBOLS[type]} {type}
              </option>
            ))}
          </select>

          {/* Entity B */}
          <input
            value={entityB}
            onChange={(e) => setEntityB(e.target.value)}
            placeholder="Entity B (e.g. Hermione)"
            className="bg-gray-800 rounded-lg px-4 py-2 outline-none text-white placeholder-gray-600 flex-1 min-w-[150px]"
          />

        </div>

        {/* Custom type field */}
        {relationshipType === "custom" && (
          <input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="Describe the relationship (e.g. 'is haunted by')"
            className="w-full bg-gray-800 rounded-lg px-4 py-2 outline-none mb-4 text-white placeholder-gray-600"
          />
        )}

        {/* Optional note */}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g. 'since Year 3, complicated by the time-turner')"
          className="w-full bg-gray-800 rounded-lg px-4 py-2 outline-none mb-4 text-white placeholder-gray-600 text-sm"
        />

        {/* Preview */}
        {entityA && entityB && (
          <div className="bg-gray-800/50 rounded-lg px-4 py-2 mb-4 text-sm text-gray-400">
            Preview: <span className="text-white">
              {entityA} {relationshipType === "custom" && customType ? customType : relationshipType} {entityB}
              {note ? ` — ${note}` : ""}
            </span>
          </div>
        )}

        <button
          onClick={addRelationship}
          disabled={!entityA.trim() || !entityB.trim()}
          className="bg-blue-700 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold transition-colors"
        >
          Add to Vault
        </button>

        {added && (
          <span className="ml-4 text-green-400 text-sm">✓ Relationship saved</span>
        )}
      </div>

      {/* Existing relationships */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-300">
          {relationships.length === 0 ? "No relationships yet" : `${relationships.length} Relationship${relationships.length === 1 ? "" : "s"}`}
        </h2>

        {relationships.length === 0 ? (
          <p className="text-gray-600 text-sm">
            Add your first relationship above. It will appear in your Master Prompt automatically.
          </p>
        ) : (
          <div className="space-y-3">
            {relationships.map((entry) => {
              // Parse the relationship text to highlight the parts
              const parts = entry.text.split(" — ");
              const main = parts[0];
              const detail = parts[1];

              return (
                <div
                  key={entry.id}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-5 py-4 flex items-center justify-between"
                >
                  <div>
                    <span className="text-white font-medium">{main}</span>
                    {detail && (
                      <span className="text-gray-500 text-sm ml-2">— {detail}</span>
                    )}
                  </div>

                  <button
                    onClick={() => removeRelationship(entry.id)}
                    className="text-gray-600 hover:text-red-400 text-sm transition-colors ml-4 shrink-0"
                  >
                    🗑️ Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}