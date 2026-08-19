"use client";

import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { CHARACTERS } from "@/lib/characters";
import type { Character } from "@/lib/characters";
import { useEffect, useState } from "react";

export default function CharactersPage() {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/characters/assignments")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setAssignments);
  }, []);

  const myId = session?.user?.id ?? "";
  const mySlug = Object.entries(assignments).find(([, uid]) => uid === myId)?.[0] ?? null;

  return (
    <div style={page}>
      {/* Topbar */}
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
            Investigator Dossiers
          </span>
          <span style={campaignTag}>Echoes of Darkness</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--ink-text-2)" }}>{session?.user?.name}</span>
          <Link href="/" className="btn btn-ghost btn-sm">← Back to app</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
        </div>
      </div>

      <div style={body}>
        <div style={headerRow}>
          <div>
            <div style={eyebrow}>Campaign · 1930s Investigative</div>
            <h1 style={heading}>Investigator Dossiers</h1>
            <p style={subheading}>
              Seven specialists bound by fate to the 17-year subterranean excavation.
            </p>
          </div>
          <span style={countBadge}>{CHARACTERS.length} investigators</span>
        </div>

        {mySlug && (
          <div style={myCharBanner}>
            Your investigator: <strong style={{ color: "var(--brass)" }}>
              {CHARACTERS.find(c => c.slug === mySlug)?.name}
            </strong>
          </div>
        )}

        <div style={grid}>
          {CHARACTERS.map((char) => {
            const assignedTo = assignments[char.slug];
            const status: "mine" | "available" | "taken" =
              assignedTo === myId ? "mine" : assignedTo ? "taken" : "available";
            return <CharacterCard key={char.slug} char={char} status={status} />;
          })}
        </div>
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<"mine" | "available" | "taken", React.CSSProperties> = {
  mine:      { background: "rgba(201,148,79,0.15)", border: "1px solid var(--brass-dim)", color: "var(--brass)" },
  available: { background: "rgba(79,155,146,0.12)", border: "1px solid var(--arcane-dim)", color: "var(--arcane)" },
  taken:     { background: "rgba(177,72,63,0.12)",  border: "1px solid #7a3030",           color: "var(--blood)" },
};
const STATUS_LABEL = { mine: "★ Your Character", available: "Available", taken: "Claimed" };

function CharacterCard({ char, status }: { char: Character; status: "mine" | "available" | "taken" }) {
  const sanPct = Math.round((char.vitals.sanity / char.vitals.maxSanity) * 100);
  const hpPct = 100; // full HP at start

  return (
    <Link href={`/characters/${char.slug}`} style={{ textDecoration: "none" }}>
      <div style={{ ...card, opacity: status === "taken" ? 0.65 : 1 }} className="char-card">
        <div style={cardHeader}>
          <div style={cardInitial}>{char.name.charAt(0)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={cardName}>{char.name}</div>
            <div style={cardClass}>{char.className}</div>
          </div>
          <div style={{ ...statusBadge, ...STATUS_BADGE[status] }}>{STATUS_LABEL[status]}</div>
        </div>

        <div style={cardCover}>{char.cover}</div>

        {/* Vital bars */}
        <div style={vitalsGrid}>
          <VitalBar label="HP" current={char.vitals.hp} max={char.vitals.hp} color="var(--blood)" />
          <VitalBar label="MP" current={char.vitals.willpower} max={char.vitals.willpower} color="var(--arcane)" />
          <VitalBar label="SAN" current={char.vitals.sanity} max={char.vitals.maxSanity} color="var(--brass)" />
          <VitalBar label="LUCK" current={char.vitals.luck} max={99} color="var(--forest)" />
        </div>

        {/* Resonance */}
        <div style={resonanceRow}>
          <span style={resonanceLabel}>Ancestral Resonance</span>
          <div style={resonanceBarOuter}>
            <div style={{ ...resonanceBarInner, width: `${char.vitals.ancestralResonance}%` }} />
          </div>
          <span style={resonancePct}>{char.vitals.ancestralResonance}%</span>
        </div>

        {/* Top skills */}
        <div style={topSkills}>
          {char.skills.slice(0, 3).map((s) => (
            <div key={s.name} style={skillChip}>
              <span style={skillName}>{s.name.split("/")[0].split("(")[0].trim()}</span>
              <span style={skillVal}>{s.value}%</span>
            </div>
          ))}
        </div>

        <div style={viewBtn}>View Full Sheet →</div>
      </div>
    </Link>
  );
}

function VitalBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  const pct = Math.round((current / max) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.8px", color: "var(--ink-text-2)", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color }}>{current}/{max}</span>
      </div>
      <div style={{ height: 3, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--ink)",
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
};
const topbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 40px",
  borderBottom: "1px solid var(--line)",
  background: "var(--surface)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};
const brandMark: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 7,
  background: "linear-gradient(155deg, var(--brass), var(--brass-dim))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 15,
  color: "var(--ink)",
};
const campaignTag: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "2px 8px",
  borderRadius: 20,
  border: "1px solid var(--brass-dim)",
  color: "var(--brass)",
  background: "rgba(201,148,79,0.08)",
  letterSpacing: "0.5px",
};
const body: React.CSSProperties = {
  padding: "40px",
  maxWidth: 1200,
  width: "100%",
  margin: "0 auto",
};
const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginBottom: 32,
};
const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: "var(--ink-text-2)",
  marginBottom: 6,
};
const heading: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 600,
  margin: "0 0 6px",
};
const subheading: React.CSSProperties = {
  color: "var(--ink-text-2)",
  fontSize: 14,
  margin: 0,
};
const countBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--brass)",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
  gap: 20,
};
const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  padding: "20px",
  cursor: "pointer",
  transition: "border-color 0.15s, box-shadow 0.15s",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};
const cardInitial: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  background: "linear-gradient(155deg, rgba(201,148,79,0.3), rgba(201,148,79,0.1))",
  border: "1px solid var(--brass-dim)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--brass)",
  flexShrink: 0,
};
const cardName: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 15,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const cardClass: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--ink-text-2)",
  letterSpacing: "0.5px",
  marginTop: 2,
};
const ageBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "2px 7px",
  borderRadius: 20,
  border: "1px solid var(--line)",
  color: "var(--ink-text-2)",
  flexShrink: 0,
};
const statusBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "2px 8px",
  borderRadius: 20,
  flexShrink: 0,
  whiteSpace: "nowrap",
};
const myCharBanner: React.CSSProperties = {
  marginBottom: 24,
  padding: "10px 16px",
  background: "rgba(201,148,79,0.08)",
  border: "1px solid var(--brass-dim)",
  borderRadius: "var(--r-md)",
  fontSize: 13,
  color: "var(--ink-text)",
};
const cardCover: React.CSSProperties = {
  fontSize: 12,
  color: "var(--ink-text-2)",
  lineHeight: 1.4,
  fontStyle: "italic",
  borderLeft: "2px solid var(--brass-dim)",
  paddingLeft: 10,
};
const vitalsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px 14px",
};
const resonanceRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const resonanceLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.5px",
  color: "var(--ink-text-2)",
  textTransform: "uppercase",
  flexShrink: 0,
};
const resonanceBarOuter: React.CSSProperties = {
  flex: 1,
  height: 3,
  background: "var(--line)",
  borderRadius: 2,
  overflow: "hidden",
};
const resonanceBarInner: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, var(--arcane), var(--brass))",
  borderRadius: 2,
  transition: "width 0.3s",
};
const resonancePct: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  color: "var(--arcane)",
  flexShrink: 0,
};
const topSkills: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};
const skillChip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  padding: "3px 8px",
};
const skillName: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--ink-text-2)",
};
const skillVal: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--brass)",
  fontWeight: 600,
};
const viewBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--brass)",
  letterSpacing: "0.5px",
  marginTop: "auto",
};
