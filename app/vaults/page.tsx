"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getVaultIndex, createVault, deleteVault, renameVault,
  setActiveVaultId, getActiveVaultId, exportVault, importVault,
  migrateOldVault, VaultMeta, loadVaultByIdAsync,
} from "@/lib/archiveEngine";

export default function VaultSwitcherPage() {
  const router = useRouter();
  const [vaults, setVaults] = useState<VaultMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Preview cache — loaded async from IDB-first source so counts are always accurate
  const [previews, setPreviews] = useState<Record<string, { name: string; text: string }>>({});

  useEffect(() => {
    migrateOldVault();
    const index = getVaultIndex();
    setVaults(index);
    setActiveId(getActiveVaultId());
    if (index.length === 1 && !getActiveVaultId()) {
      setActiveVaultId(index[0].id);
      setActiveId(index[0].id);
    }
    loadPreviews(index);
  }, []);

  async function loadPreviews(vaultList: VaultMeta[]) {
    for (const vault of vaultList) {
      try {
        const data = await loadVaultByIdAsync(vault.id);
        const entries = data.entries?.length ?? 0;
        const playerEntries = data.playerEntries?.length ?? 0;
        const saves = data.timelineSaves?.length ?? 0;
        const canon = (data.canonCategories ?? []).reduce((sum, c) => sum + c.entries.length, 0);
        const parts: string[] = [];
        if (entries > 0) parts.push(`${entries} canon entries`);
        if (playerEntries > 0) parts.push(`${playerEntries} player entries`);
        if (saves > 0) parts.push(`${saves} saves`);
        if (canon > 0) parts.push(`${canon} canon files`);
        setPreviews(prev => ({
          ...prev,
          [vault.id]: {
            name: data.archiveName?.trim() || "",
            text: parts.length > 0 ? parts.join(" · ") : "Empty vault",
          },
        }));
      } catch {
        setPreviews(prev => ({ ...prev, [vault.id]: { name: "", text: "Empty vault" } }));
      }
    }
  }

  function refresh() {
    const index = getVaultIndex();
    setVaults(index);
    setActiveId(getActiveVaultId());
    loadPreviews(index);
  }

  function handleCreateVault() {
    if (!newVaultName.trim()) return;
    createVault(newVaultName.trim());
    setNewVaultName(""); setShowCreate(false);
    refresh();
  }

  function handleOpenVault(id: string) {
    setActiveVaultId(id);
    router.push("/dashboard");
  }

  function handleRename(id: string) {
    if (!renameValue.trim()) return;
    renameVault(id, renameValue.trim());
    setRenamingId(null); setRenameValue(""); refresh();
  }

  function handleDelete(id: string) {
    deleteVault(id);
    setDeleteConfirmId(null);
    refresh();
  }

  function handleExport(id: string) {
    exportVault(id);
  }

  function handleImport(file: File | null) {
    if (!file) return;
    setImportError(""); setImportSuccess("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = importVault(text);
      if (result) {
        setImportSuccess(`✓ "${result.name}" imported successfully`);
        refresh();
        setTimeout(() => setImportSuccess(""), 4000);
      } else {
        setImportError("✗ Could not read file. Make sure it's a valid Val Archives export.");
        setTimeout(() => setImportError(""), 4000);
      }
    };
    reader.readAsText(file);
    if (importRef.current) importRef.current.value = "";
  }

  function getPreview(id: string): string {
    return previews[id]?.text ?? "Loading...";
  }

  function getActualName(id: string): string {
    return previews[id]?.name ?? "";
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "3rem 1.5rem" }}>

      {/* Logo / Title */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <p style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🌌</p>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "0.25rem" }}>Val Archives</h1>
        <p style={{ color: "var(--va-text-muted)", fontSize: "0.9rem" }}>Your Prompt Operating System</p>
      </div>

      <div style={{ width: "100%", maxWidth: "560px" }}>

        {/* Messages */}
        {importSuccess && (
          <div style={{ background: "rgba(20,83,45,0.3)", border: "1px solid #15803d", borderRadius: "0.5rem", padding: "0.75rem 1rem", color: "#4ade80", fontSize: "0.875rem", marginBottom: "1rem" }}>
            {importSuccess}
          </div>
        )}
        {importError && (
          <div style={{ background: "rgba(127,29,29,0.3)", border: "1px solid #7f1d1d", borderRadius: "0.5rem", padding: "0.75rem 1rem", color: "#fca5a5", fontSize: "0.875rem", marginBottom: "1rem" }}>
            {importError}
          </div>
        )}

        {/* Vault list */}
        {vaults.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
              Your Vaults
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {vaults.map(vault => (
                <div key={vault.id}
                  style={{ background: "var(--va-surface)", border: `1px solid ${activeId === vault.id ? "var(--va-accent)" : "var(--va-border)"}`, borderRadius: "0.75rem", overflow: "hidden", transition: "border-color 0.2s" }}>

                  {deleteConfirmId === vault.id ? (
                    <div style={{ padding: "1rem" }}>
                      <p style={{ color: "#fca5a5", fontWeight: "600", marginBottom: "0.5rem" }}>Delete "{vault.name}"?</p>
                      <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem", marginBottom: "0.875rem" }}>
                        This permanently deletes all entries, saves, and data in this vault. Cannot be undone.
                        Export it first if you want to keep a backup.
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => handleDelete(vault.id)} style={{ background: "#b91c1c", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Yes, Delete</button>
                        <button onClick={() => setDeleteConfirmId(null)} style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>

                        {/* Vault icon */}
                        <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>🗄️</span>

                        {/* Name / rename */}
                        {renamingId === vault.id ? (
                          <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRename(vault.id); if (e.key === "Escape") setRenamingId(null); }}
                            autoFocus style={{ flex: 1, background: "var(--va-bg)", border: "1px solid var(--va-accent)", borderRadius: "0.375rem", padding: "0.375rem 0.625rem", outline: "none", color: "var(--va-text)", fontSize: "0.9rem", fontWeight: "600" }} />
                        ) : (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: "700", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {getActualName(vault.id) || vault.name}
                            </p>
                            <p style={{ color: "var(--va-text-muted)", fontSize: "0.75rem", marginTop: "0.1rem" }}>{getPreview(vault.id)}</p>
                          </div>
                        )}

                        {/* Last saved */}
                        <span style={{ color: "var(--va-text-muted)", fontSize: "0.7rem", flexShrink: 0 }}>
                          {new Date(vault.lastSaved).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button onClick={() => handleOpenVault(vault.id)}
                          style={{ background: "var(--va-accent)", color: "white", padding: "0.4rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.8rem", flex: 1 }}>
                          Open →
                        </button>
                        <button onClick={() => { setRenamingId(vault.id); setRenameValue(vault.name); }}
                          style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                          ✏️ Rename
                        </button>
                        <button onClick={() => handleExport(vault.id)}
                          style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                          📤 Export
                        </button>
                        <button onClick={() => setDeleteConfirmId(vault.id)}
                          style={{ background: "none", color: "var(--va-text-muted)", padding: "0.4rem 0.5rem", borderRadius: "0.375rem", border: "1px solid var(--va-border)", cursor: "pointer", fontSize: "0.8rem" }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {vaults.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📭</p>
            <p style={{ color: "var(--va-text-muted)", marginBottom: "0.25rem" }}>No vaults yet.</p>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>Create a new vault or import an existing one.</p>
            <button
              onClick={() => {
                migrateOldVault();
                refresh();
              }}
              style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
              🔍 Detect existing data
            </button>
          </div>
        )}

        {/* Create new vault */}
        {showCreate ? (
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-accent)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1rem" }}>
            <p style={{ fontWeight: "700", marginBottom: "0.75rem", color: "var(--va-accent)" }}>🌌 Create New Vault</p>
            <input value={newVaultName} onChange={(e) => setNewVaultName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateVault()}
              placeholder="Vault name (e.g. Harry Potter Campaign)"
              autoFocus
              style={{ width: "100%", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", outline: "none", color: "var(--va-text)", fontSize: "0.9rem", marginBottom: "0.75rem", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button onClick={handleCreateVault} disabled={!newVaultName.trim()}
                style={{ flex: 1, background: "var(--va-accent)", color: "white", padding: "0.625rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.9rem", opacity: !newVaultName.trim() ? 0.4 : 1 }}>
                Create Vault
              </button>
              <button onClick={() => { setShowCreate(false); setNewVaultName(""); }}
                style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCreate(true)}
            style={{ width: "100%", background: "var(--va-accent)", color: "white", padding: "0.75rem", borderRadius: "0.75rem", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
            + Create New Vault
          </button>
        )}

        {/* Import vault */}
        <label style={{ display: "block", cursor: "pointer" }}>
          <div style={{ width: "100%", background: "var(--va-surface)", color: "var(--va-text-muted)", padding: "0.75rem", borderRadius: "0.75rem", border: "1px dashed var(--va-border)", textAlign: "center", fontSize: "0.875rem", boxSizing: "border-box" }}>
            📥 Import Vault from .json file
          </div>
          <input ref={importRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={(e) => handleImport(e.target.files?.[0] ?? null)} />
        </label>

        <p style={{ color: "var(--va-text-muted)", fontSize: "0.7rem", textAlign: "center", marginTop: "1.5rem", lineHeight: "1.6" }}>
          Each vault is completely isolated · Data stored in your browser + IndexedDB<br />
          Export regularly to keep backups
        </p>
      </div>
    </div>
  );
}