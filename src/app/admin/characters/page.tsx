"use client";

import Link from "next/link";
import { CHARACTERS } from "@/lib/characters";

export default function AdminCharactersPage() {
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
          <Link href="/admin/locations" className="btn btn-ghost btn-sm">Locations</Link>
          <Link href="/admin/assets" className="btn btn-ghost btn-sm">Assets</Link>
          <Link href="/admin/users" className="btn btn-ghost btn-sm">Users</Link>
          <Link href="/" className="btn btn-ghost btn-sm">← App</Link>
        </div>
      </div>

      <div style={body}>
        <div style={sectionHeader}>
          <span style={label}>Investigator Dossiers</span>
          <span style={count}>{CHARACTERS.length} characters</span>
        </div>
        <p style={hint}>
          Click Edit to modify a character's vitals, stats, skills, abilities, hooks, and equipment.
          Changes are persisted and visible to all users.
        </p>

        <div style={grid}>
          {CHARACTERS.map((c) => (
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
