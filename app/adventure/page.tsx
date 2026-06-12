"use client";

import Link from "next/link";

export default function AdventurePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors mb-6 block">← Home</Link>
      <h1 className="text-5xl font-bold mb-6">▶ Adventure</h1>
      <p className="text-gray-400">Your active sessions and story progression will appear here.</p>
    </div>
  );
}