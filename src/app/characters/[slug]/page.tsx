"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { getCharacter } from "@/lib/characters";
import type { Character, Ability } from "@/lib/characters";
import { useEffect, useState, useCallback } from "react";

export default function CharacterSheetPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const base = getCharacter(slug);
  const [char, setChar] = useState<Character | null>(base ?? null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [choosing, setChoosing] = useState(false);
  const [toast, setToast] = useState("");
  const isAdmin = session?.user?.role === "admin";
  const myId = session?.user?.id ?? "";

  const assignedTo = assignments[slug];
  const isMyCharacter = assignedTo === myId;
  const isTaken = !!assignedTo && !isMyCharacter;
  const isAvailable = !assignedTo;
  const iAlreadyHaveOne = Object.values(assignments).includes(myId) && !isMyCharacter;

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  useEffect(() => {
    if (!base) { router.replace("/characters"); return; }
    fetch(`/api/admin/characters/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setChar(data); });
    fetch("/api/characters/assignments")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setAssignments);
  }, [slug, base, router]);

  const handleChoose = async () => {
    setChoosing(true);
    try {
      const res = await fetch("/api/characters/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch {}
      if (res.ok) {
        setAssignments((prev) => ({ ...prev, [slug]: myId }));
        notify(`${char?.name} is now your investigator.`);
      } else {
        notify(data.error ?? "Could not claim character.");
      }
    } catch {
      notify("Network error. Please try again.");
    } finally {
      setChoosing(false);
    }
  };

  if (!char) return null;

  const sanPct = Math.round((char.vitals.sanity / char.vitals.maxSanity) * 100);
  const buffPct = char.vitals.bufferedSanityMax > 0
    ? Math.round((char.vitals.bufferedSanity / char.vitals.bufferedSanityMax) * 100)
    : 0;

  return (
    <div style={page}>
      {toast && (
        <div style={toastStyle}>{toast}</div>
      )}
      {/* Topbar */}
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <Link href="/characters" style={{ color: "var(--ink-text-2)", fontSize: 13, textDecoration: "none" }}>
            Dossiers
          </Link>
          <span style={{ color: "var(--ink-text-3, var(--ink-text-2))", fontSize: 13 }}>›</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>{char.name}</span>
          <span style={classPill}>{char.className}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isAdmin ? (
            <Link href={`/admin/characters/${slug}/edit`} className="btn btn-sm btn-primary">Edit Sheet</Link>
          ) : isMyCharacter ? (
            <Link href={`/characters/${slug}/edit`} className="btn btn-sm btn-primary">Edit Character</Link>
          ) : isTaken ? (
            <span style={takenBadge}>Claimed</span>
          ) : isAvailable && !iAlreadyHaveOne ? (
            <button className="btn btn-sm btn-primary" onClick={handleChoose} disabled={choosing}>
              {choosing ? "Claiming…" : "Choose Character"}
            </button>
          ) : null}
          <span style={{ fontSize: 13, color: "var(--ink-text-2)" }}>{session?.user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
        </div>
      </div>

      <div style={body}>
        {/* ── Identity block ── */}
        <div style={identityBlock}>
          <div style={identityInitial}>{char.name.charAt(0)}</div>
          <div>
            <h1 style={charName}>{char.name}</h1>
            <div style={charMeta}>
              Age {char.age} · <em>{char.cover}</em>
            </div>
            <div style={formerRow}>
              <span style={formerLabel}>Former:</span>
              <span style={{ color: "var(--ink-text-2)", fontSize: 13 }}>{char.formerStatus}</span>
            </div>
          </div>
        </div>

        {/* ── Vitals ── */}
        <Section title="Dynamic Vitals">
          <div style={vitalsRow}>
            <VitalBlock label="Hit Points" current={char.vitals.hp} max={char.vitals.hp} color="var(--blood)" />
            <VitalBlock label="Willpower (MP)" current={char.vitals.willpower} max={char.vitals.willpower} color="var(--arcane)" />
            <VitalBlock label="Sanity" current={char.vitals.sanity} max={char.vitals.maxSanity} color="var(--brass)" showFraction />
            <VitalBlock label="Max Sanity" current={char.vitals.maxSanity} max={99} color="var(--ink-text-2)" noBar />
            <VitalBlock label="Buffered SAN" current={char.vitals.bufferedSanity} max={char.vitals.bufferedSanityMax} color="var(--arcane)" />
            <VitalBlock label="Luck" current={char.vitals.luck} max={99} color="#5f8fc9" />
          </div>
          {/* Ancestral Resonance */}
          <div style={resBlock}>
            <div style={resHeader}>
              <span style={resTitle}>Ancestral Resonance</span>
              <span style={resPct}>{char.vitals.ancestralResonance}%</span>
            </div>
            <div style={resBarOuter}>
              <div style={{ ...resBarInner, width: `${char.vitals.ancestralResonance}%` }} />
            </div>
            <p style={resNote}>
              Genetic alignment with the prehistoric tomb. Grants situational intuition near relics; failure on Luck/Willpower triggers involuntary somatic ritual actions.
            </p>
          </div>
        </Section>

        {/* ── Characteristics ── */}
        <Section title="Core Characteristics">
          <div style={statsGrid}>
            {Object.entries(char.characteristics).map(([key, val]) => (
              <StatBlock key={key} label={key} value={val as number} />
            ))}
          </div>
        </Section>

        {/* ── Skills ── */}
        <Section title="Skills & Field Competencies">
          <div style={skillsTable}>
            {char.skills.map((s) => (
              <div key={s.name} style={skillRow}>
                <div style={skillLeft}>
                  <span style={skillPercent}>{s.value}%</span>
                  <SkillBar value={s.value} />
                </div>
                <div style={skillRight}>
                  <div style={skillRowName}>{s.name}</div>
                  <div style={skillRowNotes}>{s.notes}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Abilities ── */}
        <Section title="Class Abilities & Mechanics">
          <div style={abilitiesList}>
            {char.abilities.map((a) => (
              <AbilityCard key={a.name} ability={a} />
            ))}
          </div>
        </Section>

        {/* ── Hooks ── */}
        <Section title="Narrative Hooks & Flaws">
          <div style={hooksList}>
            {char.hooks.map((h) => (
              <div key={h.title} style={hookCard}>
                <div style={hookTitle}>{h.title}</div>
                <div style={hookBody}>{h.description}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Equipment ── */}
        <Section title="Standard Equipment">
          <ul style={equipList}>
            {char.equipment.map((item) => (
              <li key={item} style={equipItem}>
                <span style={equipDot}>◆</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={section}>
      <div style={sectionHead}>
        <span style={sectionTitle}>{title}</span>
        <div style={sectionLine} />
      </div>
      {children}
    </div>
  );
}

function VitalBlock({ label, current, max, color, showFraction, noBar }: {
  label: string; current: number; max: number; color: string; showFraction?: boolean; noBar?: boolean;
}) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div style={vitalBlock}>
      <div style={vitalLabel}>{label}</div>
      <div style={{ ...vitalValue, color }}>
        {showFraction ? `${current} / ${max}` : current}
      </div>
      {!noBar && (
        <div style={vitalBarOuter}>
          <div style={{ ...vitalBarInner, width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  const half = Math.floor(value / 2);
  const fifth = Math.floor(value / 5);
  return (
    <div style={statBlock}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
      <div style={statSubs}>
        <span title="Half">{half}</span>
        <span style={{ color: "var(--line)" }}>·</span>
        <span title="Fifth">{fifth}</span>
      </div>
    </div>
  );
}

function SkillBar({ value }: { value: number }) {
  return (
    <div style={skillBarOuter}>
      <div style={{ ...skillBarInner, width: `${value}%` }} />
    </div>
  );
}

const ABILITY_TYPE_COLORS: Record<string, string> = {
  Active: "var(--blood)",
  Passive: "var(--ink-text-2)",
  Utility: "#5f8fc9",
  "Buffered Sanity": "var(--arcane)",
  "Resonance Check": "var(--brass)",
};

function AbilityCard({ ability }: { ability: Ability }) {
  const color = ABILITY_TYPE_COLORS[ability.type] ?? "var(--ink-text-2)";
  return (
    <div style={abilityCard}>
      <div style={abilityHeader}>
        <span style={abilityName}>{ability.name}</span>
        <span style={{ ...abilityType, borderColor: color, color }}>{ability.type}</span>
      </div>
      <p style={abilityDesc}>{ability.description}</p>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
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
  padding: "14px 40px",
  borderBottom: "1px solid var(--line)",
  background: "var(--surface)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};
const brandMark: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 7,
  background: "linear-gradient(155deg, var(--brass), var(--brass-dim))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 14,
  color: "var(--ink)",
};
const classPill: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "2px 8px",
  borderRadius: 20,
  border: "1px solid var(--brass-dim)",
  color: "var(--brass)",
  background: "rgba(201,148,79,0.08)",
};
const body: React.CSSProperties = {
  padding: "40px",
  maxWidth: 900,
  width: "100%",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 40,
};
const identityBlock: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 20,
};
const identityInitial: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: 14,
  background: "linear-gradient(155deg, rgba(201,148,79,0.25), rgba(201,148,79,0.06))",
  border: "1px solid var(--brass-dim)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 700,
  color: "var(--brass)",
  flexShrink: 0,
};
const charName: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 30,
  fontWeight: 600,
  margin: "0 0 4px",
};
const charMeta: React.CSSProperties = {
  fontSize: 14,
  color: "var(--ink-text-2)",
  marginBottom: 6,
};
const formerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const formerLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--ink-text-2)",
  textTransform: "uppercase",
  letterSpacing: "0.8px",
};
const section: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
const sectionHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: "var(--ink-text-2)",
  whiteSpace: "nowrap",
};
const sectionLine: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: "var(--line)",
};
const vitalsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 12,
};
const vitalBlock: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const vitalLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
  color: "var(--ink-text-2)",
};
const vitalValue: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1,
  marginTop: 2,
};
const vitalBarOuter: React.CSSProperties = {
  height: 2,
  background: "var(--line)",
  borderRadius: 2,
  overflow: "hidden",
  marginTop: 6,
};
const vitalBarInner: React.CSSProperties = {
  height: "100%",
  borderRadius: 2,
  transition: "width 0.3s",
};
const resBlock: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const resHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const resTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.8px",
  color: "var(--ink-text-2)",
};
const resPct: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--arcane)",
};
const resBarOuter: React.CSSProperties = {
  height: 4,
  background: "var(--line)",
  borderRadius: 2,
  overflow: "hidden",
};
const resBarInner: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, var(--arcane), var(--brass))",
  borderRadius: 2,
  transition: "width 0.4s",
};
const resNote: React.CSSProperties = {
  fontSize: 12,
  color: "var(--ink-text-2)",
  margin: 0,
  lineHeight: 1.5,
};
const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, 1fr)",
  gap: 10,
};
const statBlock: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  padding: "12px 10px",
  textAlign: "center",
};
const statLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
  color: "var(--ink-text-2)",
  marginBottom: 4,
};
const statValue: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 22,
  fontWeight: 700,
  color: "var(--brass)",
  lineHeight: 1,
};
const statSubs: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--ink-text-2)",
  marginTop: 4,
  display: "flex",
  gap: 4,
  justifyContent: "center",
};
const skillsTable: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  overflow: "hidden",
};
const skillRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "12px 16px",
  borderBottom: "1px solid var(--line)",
};
const skillLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 120,
  flexShrink: 0,
};
const skillPercent: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--brass)",
  width: 38,
  textAlign: "right",
};
const skillBarOuter: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: "var(--line)",
  borderRadius: 2,
  overflow: "hidden",
};
const skillBarInner: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, var(--brass-dim), var(--brass))",
  borderRadius: 2,
};
const skillRight: React.CSSProperties = {
  flex: 1,
};
const skillRowName: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 2,
};
const skillRowNotes: React.CSSProperties = {
  fontSize: 12,
  color: "var(--ink-text-2)",
  lineHeight: 1.4,
};
const abilitiesList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const abilityCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  padding: "16px 18px",
};
const abilityHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 8,
};
const abilityName: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 15,
  fontWeight: 600,
};
const abilityType: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  padding: "2px 7px",
  borderRadius: 20,
  border: "1px solid",
  letterSpacing: "0.5px",
};
const abilityDesc: React.CSSProperties = {
  fontSize: 13,
  color: "var(--ink-text-2)",
  lineHeight: 1.6,
  margin: 0,
};
const hooksList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const hookCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderLeft: "3px solid var(--blood)",
  borderRadius: "0 var(--r-lg) var(--r-lg) 0",
  padding: "14px 18px",
};
const hookTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.5px",
  color: "var(--blood)",
  textTransform: "uppercase",
  marginBottom: 6,
};
const hookBody: React.CSSProperties = {
  fontSize: 13,
  color: "var(--ink-text-2)",
  lineHeight: 1.6,
};
const equipList: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const equipItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 13,
};
const equipDot: React.CSSProperties = {
  color: "var(--brass)",
  fontSize: 8,
  flexShrink: 0,
};
const takenBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "4px 12px",
  borderRadius: 20,
  border: "1px solid #7a3030",
  color: "var(--blood)",
  background: "rgba(177,72,63,0.1)",
};
const toastStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  background: "var(--surface-2)",
  border: "1px solid var(--brass-dim)",
  color: "var(--parchment)",
  padding: "10px 20px",
  borderRadius: "var(--r-md)",
  fontSize: 13,
  zIndex: 999,
  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
};
