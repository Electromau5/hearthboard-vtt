"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { getCharacter } from "@/lib/characters";
import type { Character, Ability, Skill } from "@/lib/characters";
import { useEffect, useState, useCallback } from "react";

// ── Skill category system ──────────────────────────────────────────────────

const SKILL_CATS = [
  { id: "medical",  label: "Medical",          color: "#3dba8a", keywords: ["medicine", "first aid", "forensic", "biology", "anatomy", "surgery", "pathology"] },
  { id: "covert",   label: "Covert Ops",       color: "#7b90d4", keywords: ["stealth", "sleight", "locksmith", "infiltrat", "evad", "disguise"] },
  { id: "combat",   label: "Combat",           color: "#c84444", keywords: ["combat", "fighting", "firearm", "dodge", "brawl", "weapon", "hand-to", "martial", "trench knife"] },
  { id: "social",   label: "Social",           color: "#c99a4f", keywords: ["fast talk", "persuade", "intimidation", "charm", "misdirection", "command", "perform", "oratory"] },
  { id: "academic", label: "Occult & Research",color: "#9966cc", keywords: ["occult", "history", "library", "language", "research", "science", "lore", "cthulhu", "mythos", "cultural"] },
  { id: "field",    label: "Field & Perception",color: "#6aab4a", keywords: ["spot hidden", "listen", "track", "climb", "swim", "drive", "navigate", "survival", "mechanical", "cinemato", "photogr", "art"] },
  { id: "covert2",  label: "Streetwise",       color: "#c07050", keywords: ["streetwise", "underworld", "network", "criminal", "shadow"] },
] as const;

const ABILITY_CFG: Record<string, { color: string; glow: string; icon: string }> = {
  "Active":          { color: "#c84444", glow: "rgba(200,68,68,0.35)",   icon: "⚡" },
  "Passive":         { color: "#7b90d4", glow: "rgba(123,144,212,0.3)",  icon: "✦" },
  "Utility":         { color: "#3dba8a", glow: "rgba(61,186,138,0.3)",   icon: "◉" },
  "Buffered Sanity": { color: "#9966cc", glow: "rgba(153,102,204,0.35)", icon: "◈" },
  "Resonance Check": { color: "#c99a4f", glow: "rgba(201,154,79,0.35)",  icon: "∞" },
};

function getCat(name: string) {
  const lower = name.toLowerCase();
  for (const cat of SKILL_CATS) {
    if (cat.keywords.some((k) => lower.includes(k))) return cat;
  }
  return { id: "general", label: "General", color: "#888", keywords: [] as string[] };
}

function getItemIcon(item: string): string {
  const l = item.toLowerCase();
  if (l.includes("kit") || l.includes("dissect") || l.includes("tool")) return "🧰";
  if (l.includes("apron") || l.includes("coat") || l.includes("cloth") || l.includes("silk")) return "🥼";
  if (l.includes("jar") || l.includes("chemical") || l.includes("formald") || l.includes("vial")) return "⚗️";
  if (l.includes("scalpel") || l.includes("blade") || l.includes("knife")) return "🔪";
  if (l.includes("cane") || l.includes("staff")) return "🪄";
  if (l.includes("gun") || l.includes("revolver") || l.includes("pistol") || l.includes("firearm") || l.includes("trench gun")) return "🔫";
  if (l.includes("smoke") || l.includes("pellet") || l.includes("flash") || l.includes("magnesium")) return "💨";
  if (l.includes("lock") || l.includes("pick") || l.includes("key")) return "🗝️";
  if (l.includes("credential") || l.includes("pass") || l.includes("badge") || l.includes("certif")) return "🪪";
  if (l.includes("note") || l.includes("debt") || l.includes("letter") || l.includes("document")) return "📜";
  if (l.includes("camera") || l.includes("film") || l.includes("eyemo") || l.includes("nitrate")) return "🎞️";
  if (l.includes("tripod")) return "📷";
  if (l.includes("powder") || l.includes("dish")) return "💡";
  if (l.includes("develop")) return "🧪";
  if (l.includes("rope") || l.includes("silk")) return "🪢";
  if (l.includes("bottle") || l.includes("flask")) return "🍶";
  if (l.includes("torch") || l.includes("lantern") || l.includes("light")) return "🕯️";
  if (l.includes("book") || l.includes("journal") || l.includes("diary") || l.includes("grimoire")) return "📔";
  if (l.includes("money") || l.includes("cash") || l.includes("coin")) return "💰";
  if (l.includes("holster") || l.includes("pouch")) return "👝";
  return "📦";
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CharacterSheetPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
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
    fetch(`/api/admin/characters/${slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setChar(data); });
    fetch("/api/characters/assignments", { cache: "no-store" })
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
        await updateSession({ assignedSlug: slug });
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

  // Group skills into categories
  const catMap = new Map<string, { cat: ReturnType<typeof getCat>; skills: Skill[] }>();
  for (const skill of char.skills) {
    const cat = getCat(skill.name);
    if (!catMap.has(cat.id)) catMap.set(cat.id, { cat, skills: [] });
    catMap.get(cat.id)!.skills.push(skill);
  }
  const groupedSkills = Array.from(catMap.values());

  return (
    <div style={{ minHeight: "100vh", background: "#07090e", display: "flex", flexDirection: "column", color: "var(--parchment)", fontFamily: "var(--font-mono)" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 999,
          background: "#1a1f28", border: "1px solid var(--brass-dim)", color: "var(--parchment)",
          padding: "10px 20px", borderRadius: 8, fontSize: 13,
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        }}>{toast}</div>
      )}

      {/* Topbar */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 52,
        borderBottom: "1px solid rgba(201,148,79,0.18)",
        background: "rgba(7,9,14,0.96)", backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 20, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: "linear-gradient(155deg, var(--brass), var(--brass-dim))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "#07090e",
          }}>H</div>
          <Link href="/characters" style={{ color: "rgba(232,227,210,0.45)", fontSize: 12, textDecoration: "none", letterSpacing: "0.3px" }}>Dossiers</Link>
          <span style={{ color: "rgba(232,227,210,0.25)", fontSize: 12 }}>›</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--parchment)" }}>{char.name}</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "2px 8px", borderRadius: 20,
            border: "1px solid rgba(201,148,79,0.3)", color: "var(--brass)",
            background: "rgba(201,148,79,0.08)", letterSpacing: "0.5px",
          }}>{char.className}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isAdmin ? (
            <Link href={`/admin/characters/${slug}/edit`} className="btn btn-sm btn-primary">Edit Sheet</Link>
          ) : isMyCharacter ? (
            <Link href={`/characters/${slug}/edit`} className="btn btn-sm btn-primary">Edit Character</Link>
          ) : isTaken ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(177,72,63,0.4)", color: "var(--blood)", background: "rgba(177,72,63,0.08)" }}>Claimed</span>
          ) : isAvailable && !iAlreadyHaveOne ? (
            <button className="btn btn-sm btn-primary" onClick={handleChoose} disabled={choosing}>
              {choosing ? "Claiming…" : "Choose Character"}
            </button>
          ) : null}
          <span style={{ fontSize: 12, color: "rgba(232,227,210,0.45)", letterSpacing: "0.3px" }}>{session?.user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
        </div>
      </nav>

      {/* Body: two-column grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "290px 1fr",
        flex: 1,
        maxWidth: 1440,
        width: "100%",
        margin: "0 auto",
        alignItems: "start",
      }}>

        {/* ── LEFT SIDEBAR ───────────────────────────────────────── */}
        <aside style={{
          borderRight: "1px solid rgba(201,148,79,0.12)",
          background: "rgba(10,12,18,0.7)",
          display: "flex", flexDirection: "column",
          minHeight: "calc(100vh - 52px)",
          position: "sticky", top: 52,
          height: "calc(100vh - 52px)",
          overflowY: "auto",
        }}>

          {/* Portrait */}
          <div style={{
            padding: "28px 20px 22px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            borderBottom: "1px solid rgba(201,148,79,0.1)",
            background: "linear-gradient(180deg, rgba(201,148,79,0.05) 0%, transparent 100%)",
          }}>
            {/* Portrait ring */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* Outer decorative ring */}
              <div style={{
                position: "absolute",
                width: 114, height: 114, borderRadius: "50%",
                border: "1px solid rgba(201,148,79,0.25)",
              }} />
              {/* Middle ring */}
              <div style={{
                position: "absolute",
                width: 106, height: 106, borderRadius: "50%",
                border: "1px solid rgba(201,148,79,0.12)",
              }} />
              {/* Main portrait */}
              <div style={{
                width: 94, height: 94, borderRadius: "50%",
                background: "radial-gradient(circle at 38% 32%, rgba(201,148,79,0.22) 0%, rgba(10,12,22,0.95) 65%)",
                border: "2px solid rgba(201,148,79,0.55)",
                boxShadow: "0 0 28px rgba(201,148,79,0.18), 0 0 60px rgba(201,148,79,0.06), inset 0 0 24px rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, color: "var(--brass)",
              }}>
                {char.name.charAt(0)}
              </div>
            </div>

            <div style={{ textAlign: "center", width: "100%" }}>
              <h1 style={{
                fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700,
                margin: "0 0 5px", color: "#f0e8d4", letterSpacing: "-0.2px", lineHeight: 1.2,
              }}>{char.name}</h1>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "1.8px",
                textTransform: "uppercase", color: "var(--brass)", marginBottom: 8,
              }}>{char.className}</div>
              <div style={{ fontSize: 11, color: "rgba(232,227,210,0.45)", lineHeight: 1.6 }}>
                Age {char.age} · {char.gender}<br />{char.cover}
              </div>
            </div>

            <div style={{
              width: "100%", padding: "8px 12px", textAlign: "center",
              background: "rgba(201,148,79,0.05)", border: "1px solid rgba(201,148,79,0.14)",
              borderRadius: 6,
            }}>
              <div style={{ fontSize: 8.5, letterSpacing: "1.3px", textTransform: "uppercase", color: "rgba(201,148,79,0.55)", marginBottom: 3 }}>Former</div>
              <div style={{ fontSize: 11, color: "rgba(232,227,210,0.55)", lineHeight: 1.5 }}>{char.formerStatus}</div>
            </div>
          </div>

          {/* Core Characteristics */}
          <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(201,148,79,0.1)" }}>
            <PanelLabel>Core Attributes</PanelLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginTop: 12 }}>
              {Object.entries(char.characteristics).map(([key, val]) => (
                <StatBadge key={key} label={key} value={val as number} />
              ))}
            </div>
          </div>

          {/* Past Demons */}
          {char.pastDemons && (
            <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(201,148,79,0.1)" }}>
              <PanelLabel>Past Demons</PanelLabel>
              <div style={{
                marginTop: 12, fontSize: 11, color: "rgba(232,227,210,0.5)",
                lineHeight: 1.65, whiteSpace: "pre-wrap",
              }}>{char.pastDemons}</div>
            </div>
          )}

          {/* Psychological profile / hooks */}
          <div style={{ padding: "18px 20px", flex: 1 }}>
            <PanelLabel>Psychological Profile</PanelLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {char.hooks.map((h) => (
                <div key={h.title} style={{
                  background: "rgba(177,72,63,0.05)",
                  border: "1px solid rgba(177,72,63,0.18)",
                  borderLeft: "3px solid rgba(177,72,63,0.7)",
                  borderRadius: "0 6px 6px 0",
                  padding: "10px 13px",
                }}>
                  <div style={{ fontSize: 8.5, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(177,72,63,0.9)", marginBottom: 5 }}>
                    {h.title}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(232,227,210,0.5)", lineHeight: 1.55 }}>
                    {h.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANEL ────────────────────────────────────────── */}
        <main style={{ display: "flex", flexDirection: "column" }}>

          {/* Vitals */}
          <section style={{ padding: "22px 28px 18px", borderBottom: "1px solid rgba(201,148,79,0.1)" }}>
            <SectionLabel icon="♥" accent="#c84444">Dynamic Vitals</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <VitalBar label="Hit Points"   current={char.vitals.hp}         max={char.vitals.hp}            color="#c84444" />
              <VitalBar label="Willpower MP" current={char.vitals.willpower}   max={char.vitals.willpower}    color="#9966cc" />
              <VitalBar label="Sanity"       current={char.vitals.sanity}      max={char.vitals.maxSanity}    color="#c99a4f" showFraction />
              <VitalBar label="Luck"         current={char.vitals.luck}        max={99}                       color="#5f8fc9" />
            </div>
            {char.vitals.bufferedSanityMax > 0 && (
              <div style={{ marginTop: 10 }}>
                <VitalBar label="Buffered Sanity" current={char.vitals.bufferedSanity} max={char.vitals.bufferedSanityMax} color="#7b90d4" showFraction />
              </div>
            )}
            {/* Ancestral Resonance — special */}
            <div style={{
              marginTop: 14, padding: "13px 16px",
              background: "rgba(153,102,204,0.05)",
              border: "1px solid rgba(153,102,204,0.18)",
              borderRadius: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#9966cc" }}>∞</span>
                  <span style={{ fontSize: 9.5, letterSpacing: "1.4px", textTransform: "uppercase", color: "rgba(153,102,204,0.9)" }}>
                    Ancestral Resonance
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "#9966cc" }}>
                  {char.vitals.ancestralResonance}%
                </span>
              </div>
              <div style={{ position: "relative", height: 7, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", inset: "0 auto 0 0", width: `${char.vitals.ancestralResonance}%`,
                  background: "linear-gradient(90deg, #7b46aa, #9966cc, #c99a4f)",
                  boxShadow: "0 0 10px rgba(153,102,204,0.5)",
                  borderRadius: 4,
                }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(232,227,210,0.4)", lineHeight: 1.5 }}>
                Genetic alignment with the prehistoric tomb. Failure on Luck/Willpower triggers involuntary somatic ritual actions.
              </div>
            </div>
          </section>

          {/* Skill Tree */}
          <section style={{ padding: "22px 28px 18px", borderBottom: "1px solid rgba(201,148,79,0.1)" }}>
            <SectionLabel icon="◎" accent="#3dba8a">Skills & Field Competencies</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {groupedSkills.map(({ cat, skills }) => (
                <SkillBranch key={cat.id} catLabel={cat.label} catColor={cat.color} skills={skills} />
              ))}
            </div>
          </section>

          {/* Abilities */}
          <section style={{ padding: "22px 28px 18px", borderBottom: "1px solid rgba(201,148,79,0.1)" }}>
            <SectionLabel icon="⚡" accent="#c84444">Class Abilities</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10, marginTop: 16 }}>
              {char.abilities.map((a) => (
                <AbilityCard key={a.name} ability={a} />
              ))}
            </div>
          </section>

          {/* Equipment inventory grid */}
          <section style={{ padding: "22px 28px 32px" }}>
            <SectionLabel icon="📦" accent="#c99a4f">Equipment &amp; Inventory</SectionLabel>
            <InventoryGrid items={char.equipment} />
          </section>
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 2, height: 10, background: "var(--brass)", borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 9, letterSpacing: "1.8px", textTransform: "uppercase", color: "rgba(232,227,210,0.4)" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(201,148,79,0.12)" }} />
    </div>
  );
}

function SectionLabel({ icon, accent, children }: { icon: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, color: accent }}>{icon}</span>
      <span style={{ fontSize: 9.5, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(232,227,210,0.45)", whiteSpace: "nowrap" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}30, transparent)` }} />
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  const isHigh = value >= 70;
  const isMed = value >= 50 && value < 70;
  const valColor = isHigh ? "var(--brass)" : isMed ? "rgba(232,227,210,0.85)" : "rgba(232,227,210,0.45)";
  const borderColor = isHigh ? "rgba(201,148,79,0.3)" : "rgba(255,255,255,0.07)";
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${borderColor}`,
      borderRadius: 7, padding: "8px 4px 6px", textAlign: "center",
      boxShadow: isHigh ? "0 0 12px rgba(201,148,79,0.07), inset 0 1px 0 rgba(201,148,79,0.1)" : "none",
    }}>
      <div style={{ fontSize: 8, letterSpacing: "0.4px", textTransform: "uppercase", color: "rgba(232,227,210,0.35)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 19, fontWeight: 700, color: valColor, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 8.5, color: "rgba(232,227,210,0.28)", marginTop: 3 }}>
        {Math.floor(value / 2)}·{Math.floor(value / 5)}
      </div>
    </div>
  );
}

function VitalBar({ label, current, max, color, showFraction }: {
  label: string; current: number; max: number; color: string; showFraction?: boolean;
}) {
  const pct = Math.min(100, max > 0 ? Math.round((current / max) * 100) : 0);
  const segs = Math.min(max, 20);
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 8, padding: "10px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(232,227,210,0.4)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color }}>
          {showFraction ? `${current} / ${max}` : current}
        </span>
      </div>
      <div style={{
        position: "relative", height: 9,
        background: "rgba(0,0,0,0.4)", borderRadius: 5, overflow: "hidden",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          position: "absolute", inset: "0 auto 0 0", width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          boxShadow: `0 0 8px ${color}70`,
          borderRadius: 5, transition: "width 0.5s ease",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent calc(${100 / segs}% - 1px), rgba(0,0,0,0.35) calc(${100 / segs}% - 1px), rgba(0,0,0,0.35) calc(${100 / segs}%))`,
        }} />
      </div>
    </div>
  );
}

function SkillBranch({ catLabel, catColor, skills }: {
  catLabel: string; catColor: string; skills: Skill[];
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
      {/* Category header */}
      <div style={{ width: 136, flexShrink: 0, display: "flex", justifyContent: "flex-end", paddingRight: 14, paddingTop: 9 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "1.2px",
          textTransform: "uppercase", color: catColor,
          padding: "3px 8px", border: `1px solid ${catColor}40`,
          background: `${catColor}0e`, borderRadius: 4, whiteSpace: "nowrap",
        }}>
          {catLabel}
        </div>
      </div>

      {/* Connector */}
      <div style={{ width: 1, alignSelf: "stretch", marginTop: 14, background: `${catColor}28`, flexShrink: 0 }} />

      {/* Skill nodes */}
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 12 }}>
        {skills.map((skill) => (
          <SkillNode key={skill.name} skill={skill} color={catColor} />
        ))}
      </div>
    </div>
  );
}

function SkillNode({ skill, color }: { skill: Skill; color: string }) {
  const NODE = 44;
  const RADIUS = 17;
  const circ = 2 * Math.PI * RADIUS;
  const offset = circ * (1 - skill.value / 100);
  return (
    <div
      title={skill.notes || undefined}
      style={{
        display: "flex", alignItems: "center", gap: 9, cursor: "default",
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${color}22`,
        borderRadius: 7, padding: "6px 12px 6px 6px",
        minWidth: 170, flex: "0 1 auto",
      }}
    >
      {/* SVG circular progress */}
      <div style={{ position: "relative", width: NODE, height: NODE, flexShrink: 0 }}>
        <svg width={NODE} height={NODE} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
          <circle cx={NODE / 2} cy={NODE / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2.5} />
          <circle
            cx={NODE / 2} cy={NODE / 2} r={RADIUS} fill="none"
            stroke={color} strokeWidth={2.5}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, color,
        }}>
          {skill.value}%
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "#ece4cc", marginBottom: 2, lineHeight: 1.2 }}>{skill.name}</div>
        {skill.notes && (
          <div style={{ fontSize: 9.5, color: "rgba(232,227,210,0.38)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            {skill.notes}
          </div>
        )}
      </div>
    </div>
  );
}

function AbilityCard({ ability }: { ability: Ability }) {
  const cfg = ABILITY_CFG[ability.type] ?? { color: "rgba(232,227,210,0.5)", glow: "transparent", icon: "◆" };
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${cfg.color}30`,
      borderRadius: 9, padding: "14px 15px",
      boxShadow: `inset 0 0 30px ${cfg.glow}12`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: `${cfg.color}14`, border: `1px solid ${cfg.color}38`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, color: cfg.color,
          boxShadow: `0 0 12px ${cfg.glow}`,
        }}>
          {cfg.icon}
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "#f0e8d4", lineHeight: 1.2, marginBottom: 4 }}>
            {ability.name}
          </div>
          <div style={{
            display: "inline-block", fontSize: 8, letterSpacing: "1.3px", textTransform: "uppercase",
            color: cfg.color, padding: "2px 7px",
            border: `1px solid ${cfg.color}35`, background: `${cfg.color}10`, borderRadius: 4,
          }}>
            {ability.type}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "rgba(232,227,210,0.55)", lineHeight: 1.65 }}>
        {ability.description}
      </div>
    </div>
  );
}

function InventoryGrid({ items }: { items: string[] }) {
  const COLS = 5;
  const filled = items.length;
  const total = Math.max(COLS * 3, Math.ceil(filled / COLS) * COLS);
  const slots = [...items, ...Array<null>(total - filled).fill(null)];

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 8, marginTop: 16 }}>
      {slots.map((item, i) => (
        <div key={i} style={{
          aspectRatio: "1 / 1.15",
          border: item
            ? "1px solid rgba(201,148,79,0.28)"
            : "1px dashed rgba(255,255,255,0.07)",
          borderRadius: 9,
          background: item
            ? "radial-gradient(circle at 50% 30%, rgba(201,148,79,0.07) 0%, rgba(10,12,18,0.8) 100%)"
            : "rgba(255,255,255,0.01)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "10px 8px", textAlign: "center", gap: 6,
          boxShadow: item ? "inset 0 0 16px rgba(201,148,79,0.05)" : "none",
          position: "relative", overflow: "hidden",
          transition: "border-color 0.15s",
        }}>
          {item ? (
            <>
              {/* Corner shine */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 1,
                background: "linear-gradient(90deg, transparent, rgba(201,148,79,0.3), transparent)",
              }} />
              <div style={{ fontSize: 26, lineHeight: 1 }}>
                {getItemIcon(item)}
              </div>
              <div style={{
                fontSize: 9.5, color: "rgba(232,227,210,0.75)", fontWeight: 500,
                lineHeight: 1.35, fontFamily: "var(--font-mono)", letterSpacing: "0.1px",
              }}>
                {item.length > 32 ? item.slice(0, 30) + "…" : item}
              </div>
              {/* Item rarity-style bottom bar (gold = common campaign item) */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, rgba(201,148,79,0.4), transparent)",
              }} />
            </>
          ) : (
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.06)" }}>+</div>
          )}
        </div>
      ))}
    </div>
  );
}
