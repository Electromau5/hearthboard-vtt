"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHARACTERS } from "@/lib/characters";
import type { Character } from "@/lib/characters";

/**
 * Roster with stored overrides applied. Falls back to the compiled-in
 * defaults until the request lands so the grid still paints immediately.
 */
function useMergedCharacters(): Character[] {
  const [chars, setChars] = useState<Character[]>(CHARACTERS);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/characters", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Character[] | null) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) setChars(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return chars;
}

export default function AdminCharactersPage() {
  const characters = useMergedCharacters();
  return (
    <div style={page}>
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
            Admin — Characters
          </span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/locations" className="btn btn-ghost btn-sm nav-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Locations
          </Link>
          <Link href="/admin/assets" className="btn btn-ghost btn-sm nav-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Assets
          </Link>
          <Link href="/admin/users" className="btn btn-ghost btn-sm nav-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Users
          </Link>
          <Link href="/" className="btn btn-ghost btn-sm nav-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            App
          </Link>
        </div>
      </div>

      <div style={body}>
        <div style={sectionHeader}>
          <span style={label}>Investigator Dossiers</span>
          <span style={count}>{characters.length} characters</span>
        </div>
        <p style={hint}>
          Click Edit to modify a character's vitals, stats, skills, abilities, hooks, and equipment.
          Changes are persisted and visible to all users.
        </p>

        <div style={grid}>
          {characters.map((c) => (
            <div key={c.slug} style={card}>
              <div style={cardInitial}>{c.name.charAt(0)}</div>
              <div style={cardInfo}>
                <div style={cardName}>{c.name}</div>
                <div style={cardClass}>{c.className}</div>
                <div style={cardStats}>
                  HP {c.vitals.hp} · SAN {c.vitals.sanity}/{c.vitals.maxSanity} · MP {c.vitals.willpower}
                </div>
              </div>
              <div style={cardActions}>
                <Link href={`/admin/characters/${c.slug}/edit`} className="btn btn-sm btn-primary">
                  Edit
                </Link>
                <Link href={`/characters/${c.slug}`} className="btn btn-sm btn-ghost">
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: "var(--ink)", display: "flex", flexDirection: "column", overflow: "auto" };
const topbar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid var(--line)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 };
const brandMark: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(155deg, var(--brass), var(--brass-dim))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--ink)" };
const body: React.CSSProperties = { padding: "40px", maxWidth: 900, width: "100%", margin: "0 auto" };
const sectionHeader: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 };
const label: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--ink-text-2)" };
const count: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--brass)" };
const hint: React.CSSProperties = { color: "var(--ink-text-2)", fontSize: 13, marginBottom: 28, marginTop: 0 };
const grid: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const card: React.CSSProperties = { display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", transition: "border-color .15s" };
const cardInitial: React.CSSProperties = { width: 44, height: 44, borderRadius: "var(--r-md)", background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--brass)", flexShrink: 0 };
const cardInfo: React.CSSProperties = { flex: 1, minWidth: 0 };
const cardName: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, marginBottom: 2 };
const cardClass: React.CSSProperties = { fontSize: 12, color: "var(--brass)", marginBottom: 4 };
const cardStats: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-text-2)" };
const cardActions: React.CSSProperties = { display: "flex", gap: 8, flexShrink: 0 };
