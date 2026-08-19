"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getCharacter } from "@/lib/characters";
import type { Character, Skill, Ability, Hook } from "@/lib/characters";

export default function PlayerEditCharacterPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const { data: session, status } = useSession();
  const base = getCharacter(slug);
  const [char, setChar] = useState<Character | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/characters/${slug}`);
    if (res.ok) setChar(await res.json());
    else router.replace(`/characters/${slug}`);
  }, [slug, router]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (!base) { router.replace("/characters"); return; }

    const isAdmin = session.user.role === "admin";
    if (isAdmin) { setAuthorized(true); load(); return; }

    fetch("/api/characters/assignments")
      .then((r) => (r.ok ? r.json() : {}))
      .then((assignments: Record<string, string>) => {
        if (assignments[slug] === session.user.id) {
          setAuthorized(true);
          load();
        } else {
          router.replace(`/characters/${slug}`);
        }
      });
  }, [status, session, slug, base, load, router]);

  const save = async () => {
    if (!char) return;
    setSaving(true);
    const res = await fetch(`/api/admin/characters/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(char),
    });
    setSaving(false);
    if (res.ok) notify("Saved.");
    else notify("Save failed.");
  };

  const setVital = (k: keyof Character["vitals"], v: number) =>
    setChar((c) => c ? { ...c, vitals: { ...c.vitals, [k]: v } } : c);

  const setStat = (k: keyof Character["characteristics"], v: number) =>
    setChar((c) => c ? { ...c, characteristics: { ...c.characteristics, [k]: v } } : c);

  const setSkill = (i: number, patch: Partial<Skill>) =>
    setChar((c) => { if (!c) return c; const s = [...c.skills]; s[i] = { ...s[i], ...patch }; return { ...c, skills: s }; });

  const addSkill = () =>
    setChar((c) => c ? { ...c, skills: [...c.skills, { name: "", value: 50, notes: "" }] } : c);

  const removeSkill = (i: number) =>
    setChar((c) => c ? { ...c, skills: c.skills.filter((_, idx) => idx !== i) } : c);

  const setAbility = (i: number, patch: Partial<Ability>) =>
    setChar((c) => { if (!c) return c; const a = [...c.abilities]; a[i] = { ...a[i], ...patch }; return { ...c, abilities: a }; });

  const addAbility = () =>
    setChar((c) => c ? { ...c, abilities: [...c.abilities, { name: "", type: "Active", description: "" }] } : c);

  const removeAbility = (i: number) =>
    setChar((c) => c ? { ...c, abilities: c.abilities.filter((_, idx) => idx !== i) } : c);

  const setHook = (i: number, patch: Partial<Hook>) =>
    setChar((c) => { if (!c) return c; const h = [...c.hooks]; h[i] = { ...h[i], ...patch }; return { ...c, hooks: h }; });

  const addHook = () =>
    setChar((c) => c ? { ...c, hooks: [...c.hooks, { title: "", description: "" }] } : c);

  const removeHook = (i: number) =>
    setChar((c) => c ? { ...c, hooks: c.hooks.filter((_, idx) => idx !== i) } : c);

  const setEquip = (i: number, v: string) =>
    setChar((c) => { if (!c) return c; const e = [...c.equipment]; e[i] = v; return { ...c, equipment: e }; });

  const addEquip = () =>
    setChar((c) => c ? { ...c, equipment: [...c.equipment, ""] } : c);

  const removeEquip = (i: number) =>
    setChar((c) => c ? { ...c, equipment: c.equipment.filter((_, idx) => idx !== i) } : c);

  if (!authorized || !char) {
    return <div style={{ ...page, justifyContent: "center", alignItems: "center", color: "var(--ink-text-2)" }}>Loading…</div>;
  }

  const ABILITY_TYPES: Ability["type"][] = ["Active", "Passive", "Utility", "Buffered Sanity", "Resonance Check"];

  return (
    <div style={page}>
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <Link href={`/characters/${slug}`} style={{ color: "var(--ink-text-2)", fontSize: 13, textDecoration: "none" }}>← Back to sheet</Link>
          <span style={{ color: "var(--ink-text-2)", fontSize: 13 }}>›</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>{char.name}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href={`/characters/${slug}`} className="btn btn-ghost btn-sm">View Sheet</Link>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div style={body}>

        {/* ── Identity ── */}
        <Section title="Identity">
          <div style={fieldGrid2}>
            <Field label="Name">
              <input style={input} value={char.name} onChange={(e) => setChar((c) => c ? { ...c, name: e.target.value } : c)} />
            </Field>
            <Field label="Age">
              <input style={input} type="number" value={char.age} onChange={(e) => setChar((c) => c ? { ...c, age: +e.target.value } : c)} />
            </Field>
            <Field label="Class / Archetype">
              <input style={input} value={char.className} onChange={(e) => setChar((c) => c ? { ...c, className: e.target.value } : c)} />
            </Field>
            <Field label="Former Status">
              <input style={input} value={char.formerStatus} onChange={(e) => setChar((c) => c ? { ...c, formerStatus: e.target.value } : c)} />
            </Field>
          </div>
          <Field label="Cover / Current Role">
            <input style={input} value={char.cover} onChange={(e) => setChar((c) => c ? { ...c, cover: e.target.value } : c)} />
          </Field>
        </Section>

        {/* ── Vitals ── */}
        <Section title="Dynamic Vitals">
          <div style={fieldGrid4}>
            {([
              ["hp", "Hit Points"],
              ["willpower", "Willpower (MP)"],
              ["sanity", "Current SAN"],
              ["maxSanity", "Max SAN"],
              ["bufferedSanity", "Buffered SAN"],
              ["bufferedSanityMax", "Buffered SAN Max"],
              ["ancestralResonance", "Ancestral Resonance %"],
              ["luck", "Luck"],
            ] as [keyof Character["vitals"], string][]).map(([k, lbl]) => (
              <Field key={k} label={lbl}>
                <input style={input} type="number" min={0} max={k === "ancestralResonance" ? 100 : 99}
                  value={char.vitals[k]}
                  onChange={(e) => setVital(k, +e.target.value)} />
              </Field>
            ))}
          </div>
        </Section>

        {/* ── Characteristics ── */}
        <Section title="Core Characteristics">
          <div style={fieldGrid4}>
            {(Object.keys(char.characteristics) as (keyof Character["characteristics"])[]).map((k) => (
              <Field key={k} label={k}>
                <input style={input} type="number" min={1} max={99}
                  value={char.characteristics[k]}
                  onChange={(e) => setStat(k, +e.target.value)} />
              </Field>
            ))}
          </div>
        </Section>

        {/* ── Skills ── */}
        <Section title="Skills & Field Competencies"
          action={<button className="btn btn-ghost btn-sm" onClick={addSkill}>+ Add Skill</button>}>
          <div style={listStack}>
            {char.skills.map((s, i) => (
              <div key={i} style={listRow}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, flex: 1 }}>
                  <Field label="Value %">
                    <input style={input} type="number" min={1} max={99} value={s.value}
                      onChange={(e) => setSkill(i, { value: +e.target.value })} />
                  </Field>
                  <Field label="Name">
                    <input style={input} value={s.name} onChange={(e) => setSkill(i, { name: e.target.value })} />
                  </Field>
                </div>
                <Field label="Notes" style={{ flex: 1 }}>
                  <input style={input} value={s.notes} onChange={(e) => setSkill(i, { notes: e.target.value })} />
                </Field>
                <button className="btn btn-ghost btn-sm btn-danger" style={{ alignSelf: "flex-end", marginBottom: 2 }} onClick={() => removeSkill(i)}>✕</button>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Abilities ── */}
        <Section title="Class Abilities"
          action={<button className="btn btn-ghost btn-sm" onClick={addAbility}>+ Add Ability</button>}>
          <div style={listStack}>
            {char.abilities.map((a, i) => (
              <div key={i} style={listRow}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 8, flex: 1 }}>
                  <Field label="Name">
                    <input style={input} value={a.name} onChange={(e) => setAbility(i, { name: e.target.value })} />
                  </Field>
                  <Field label="Type">
                    <select style={input} value={a.type} onChange={(e) => setAbility(i, { type: e.target.value as Ability["type"] })}>
                      {ABILITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Description" style={{ flex: 1 }}>
                  <textarea style={{ ...input, minHeight: 72, resize: "vertical" }} value={a.description}
                    onChange={(e) => setAbility(i, { description: e.target.value })} />
                </Field>
                <button className="btn btn-ghost btn-sm btn-danger" style={{ alignSelf: "flex-start", marginTop: 22 }} onClick={() => removeAbility(i)}>✕</button>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Hooks ── */}
        <Section title="Narrative Hooks & Flaws"
          action={<button className="btn btn-ghost btn-sm" onClick={addHook}>+ Add Hook</button>}>
          <div style={listStack}>
            {char.hooks.map((h, i) => (
              <div key={i} style={listRow}>
                <Field label="Title" style={{ minWidth: 200 }}>
                  <input style={input} value={h.title} onChange={(e) => setHook(i, { title: e.target.value })} />
                </Field>
                <Field label="Description" style={{ flex: 1 }}>
                  <textarea style={{ ...input, minHeight: 64, resize: "vertical" }} value={h.description}
                    onChange={(e) => setHook(i, { description: e.target.value })} />
                </Field>
                <button className="btn btn-ghost btn-sm btn-danger" style={{ alignSelf: "flex-start", marginTop: 22 }} onClick={() => removeHook(i)}>✕</button>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Equipment ── */}
        <Section title="Starting Equipment"
          action={<button className="btn btn-ghost btn-sm" onClick={addEquip}>+ Add Item</button>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {char.equipment.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...input, flex: 1 }} value={item} onChange={(e) => setEquip(i, e.target.value)} />
                <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeEquip(i)}>✕</button>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 60 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save All Changes"}
          </button>
        </div>
      </div>

      {toast && (
        <div style={toastStyle}>{toast}</div>
      )}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--ink-text-2)" }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--ink-text-2)" }}>{label}</label>
      {children}
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: "var(--ink)", display: "flex", flexDirection: "column", overflow: "auto" };
const topbar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid var(--line)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 };
const brandMark: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(155deg, var(--brass), var(--brass-dim))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--ink)" };
const body: React.CSSProperties = { padding: "40px", maxWidth: 860, width: "100%", margin: "0 auto" };
const input: React.CSSProperties = { background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", color: "var(--parchment)", padding: "8px 10px", fontSize: 13, width: "100%", fontFamily: "inherit" };
const fieldGrid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 12 };
const fieldGrid4: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px 16px" };
const listStack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const listRow: React.CSSProperties = { display: "flex", gap: 12, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", alignItems: "flex-start" };
const toastStyle: React.CSSProperties = { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--surface-3)", border: "1px solid var(--brass-dim)", color: "var(--parchment)", padding: "10px 20px", borderRadius: "var(--r-md)", fontSize: 13, fontFamily: "var(--font-mono)", zIndex: 50 };
