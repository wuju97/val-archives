"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getVaultIndex, getActiveVaultId, migrateOldVault } from "@/lib/archiveEngine";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    migrateOldVault();
    const vaults = getVaultIndex();
    const activeId = getActiveVaultId();

    if (vaults.length === 0) {
      // No vaults at all — go to vault switcher to create one
      router.replace("/vaults");
    } else if (activeId && vaults.find(v => v.id === activeId)) {
      // Has an active vault — go straight to dashboard
      router.replace("/dashboard");
    } else {
      // Has vaults but none active — go to vault switcher to pick one
      router.replace("/vaults");
    }
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Loading...</p>
    </div>
  );
}