"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ActiveEffect } from "@/app/api/admin/effects/route";

const EFFECTS = [
  {
    id: "sanity",
    label: "Sanity Slip",
    desc: "Screen blurs and warps with disorienting distortion",
    duration: 7000,
    color: "var(--arcane)",
    glow: "rgba(79,155,146,0.35)",
    icon: "🌀",
  },
  {
    id: "darkness",
    label: "Darkness",
    desc: "Screen fades to impenetrable black",
    duration: 5000,
    color: "#666",
    glow: "rgba(20,20,20,0.6)",
    icon: "🌑",
  },
  {
    id: "blood",
    label: "Blood Vision",
    desc: "Crimson vignette bleeds across the screen",
    duration: 6000,
    color: "var(--blood)",
    glow: "rgba(177,72,63,0.4)",
    icon: "🩸",
  },
  {
    id: "static",
    label: "Cosmic Static",
    desc: "Signal lost — noise interference takes over",
    duration: 4000,
    color: "#8a72c9",
    glow: "rgba(138,114,201,0.35)",
    icon: "📺",
  },
  {
    id: "horror",
    label: "Primal Horror",
    desc: "Violent screen shake with blinding flashes",
    duration: 3500,
    color: "var(--blood)",
    glow: "rgba(177,72,63,0.5)",
    icon: "💀",
  },
  {
    id: "echo",
    label: "Temporal Echo",
    desc: "Reality flickers with ghostly afterimages",
    duration: 6000,
    color: "#5f8fc9",
    glow: "rgba(95,143,201,0.35)",
    icon: "👁",
  },
  {
    id: "visions",
    label: "Visions",
    desc: "A horrifying image flashes on screen for half a second",
    duration: 8000,
    color: "#c47a2b",
    glow: "rgba(196,122,43,0.4)",
    icon: "🌀",
  },
] as const;

const PLAYERS = [
  { id: null, label: "All Players" },
  { id: "shay", label: "Shay" },
  { id: "greg", label: "Greg" },
  { id: "sanch", label: "Sanch" },
];

export default function ExperiencePage() {
  const [target, setTarget] = useState<string | null>(null);
  const [current, setCurrent] = useState<ActiveEffect | null>(null);
  const [toast, setToast] = useState("");
  const [countdown, setCountdown] = useState(0);

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const loadCurrent = async () => {
    const res = await fetch("/api/admin/effects");
    if (res.ok) setCurrent(await res.json());
  };

  useEffect(() => {
    loadCurrent();
    const i = setInterval(loadCurrent, 3000);
    return () => clearInterval(i);
  }, []);

  // Countdown ticker
  useEffect(() => {
    if (!current) { setCountdown(0); return; }
    const tick = () => {
      const rem = Math.max(0, current.triggeredAt + current.duration - Date.now());
      setCountdown(rem);
      if (rem === 0) setCurrent(null);
    };
    tick();
    const i = setInterval(tick, 200);
    return () => clearInterval(i);
  }, [current?.triggeredAt]);

  const trigger = async (effect: typeof EFFECTS[number]) => {
    const body: Record<string, unknown> = {
      id: effect.id,
      label: effect.label,
      duration: effect.duration,
      targetUserIds: target ? [target] : null,
    };
    if (effect.id === "visions") {
      body.data = { imageIndex: Math.floor(Math.random() * 3) + 1 };
    }
    const res = await fetch("/api/admin/effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setCurrent(await res.json());
      notify(`${effect.label} triggered${target ? ` → ${target}` : " → all players"}.`);
    }
  };

  const clear = async () => {
    await fetch("/api/admin/effects", { method: "DELETE" });
    setCurrent(null);
    notify("Effect cleared.");
  };

  const isLive = current && countdown > 0;

  return (
    <div style={page}>
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
            Admin — Experience
          </span>
          {isLive && (
            <div style={livePill}>
              <span style={liveDot} />
              LIVE · {(countdown / 1000).toFixed(1)}s
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/characters" className="btn btn-ghost btn-sm">Characters</Link>
          <Link href="/admin/locations" className="btn btn-ghost btn-sm">Locations</Link>
          <Link href="/admin/assets" className="btn btn-ghost btn-sm">Assets</Link>
          <Link href="/admin/users" className="btn btn-ghost btn-sm">Users</Link>
          <Link href="/" className="btn btn-ghost btn-sm">← App</Link>
        </div>
      </div>

      <div style={body}>

        {/* Target selector */}
        <div style={section}>
          <div style={sectionLabel}>Target</div>
          <div style={targetRow}>
            {PLAYERS.map((p) => (
              <button
                key={String(p.id)}
                className="btn btn-sm"
                style={target === p.id ? targetBtnActive : targetBtn}
                onClick={() => setTarget(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active effect banner */}
        {isLive && (
          <div style={activeBanner}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>
                {EFFECTS.find((e) => e.id === current!.id)?.icon ?? "✦"}
              </span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>
                  {current!.label}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-text-2)", marginTop: 2 }}>
                  {current!.targetUserIds ? `→ ${current!.targetUserIds.join(", ")}` : "→ all players"} · {(countdown / 1000).toFixed(1)}s remaining
                </div>
              </div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={clear}>Clear Now</button>
          </div>
        )}

        {/* Effects grid */}
        <div style={sectionLabel}>Effects</div>
        <div style={grid}>
          {EFFECTS.map((eff) => {
            const isThisActive = isLive && current!.id === eff.id;
            return (
              <div key={eff.id} style={{ ...card, ...(isThisActive ? { ...cardActive, boxShadow: `0 0 24px ${eff.glow}` } : {}) }}>
                <div style={cardTop}>
                  <span style={cardIcon}>{eff.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...cardLabel, color: eff.color }}>{eff.label}</div>
                    <div style={cardDuration}>{(eff.duration / 1000).toFixed(0)}s</div>
                  </div>
                </div>
                <div style={cardDesc}>{eff.desc}</div>
                <button
                  className="btn btn-sm"
                  style={{ ...triggerBtn, borderColor: eff.color, color: eff.color, ...(isThisActive ? { background: eff.glow } : {}) }}
                  onClick={() => trigger(eff)}
                >
                  {isThisActive ? "Retriggering…" : "Trigger"}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 32, padding: "18px 20px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-text-2)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>How it works</div>
          <p style={{ fontSize: 13, color: "var(--ink-text-2)", margin: 0, lineHeight: 1.6 }}>
            Effects appear on player screens within ~2 seconds of triggering. Players must be on the VTT board (<code>/</code>) to see them. Effects auto-expire after their duration. You can clear them early with the Clear button. Effects are not shown on your own screen.
          </p>
        </div>
      </div>

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: "var(--ink)", display: "flex", flexDirection: "column", overflow: "auto" };
const topbar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid var(--line)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 };
const brandMark: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(155deg, var(--brass), var(--brass-dim))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--ink)" };
const livePill: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "rgba(177,72,63,0.15)", border: "1px solid var(--blood)", borderRadius: 20, padding: "3px 10px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--blood)", letterSpacing: "0.5px" };
const liveDot: React.CSSProperties = { width: 6, height: 6, borderRadius: "50%", background: "var(--blood)", animation: "pulse 1s ease-in-out infinite" };
const body: React.CSSProperties = { padding: "36px 40px 60px", maxWidth: 900, width: "100%", margin: "0 auto" };
const section: React.CSSProperties = { marginBottom: 28 };
const sectionLabel: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--ink-text-2)", marginBottom: 12 };
const targetRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const targetBtn: React.CSSProperties = { background: "var(--surface-2)", borderColor: "var(--line)", color: "var(--ink-text-2)" };
const targetBtnActive: React.CSSProperties = { background: "rgba(201,148,79,0.15)", borderColor: "var(--brass)", color: "var(--brass)" };
const activeBanner: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "rgba(177,72,63,0.08)", border: "1px solid rgba(177,72,63,0.3)", borderRadius: "var(--r-md)", marginBottom: 28 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14, marginBottom: 16 };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, transition: "border-color .2s, box-shadow .2s" };
const cardActive: React.CSSProperties = { borderColor: "var(--blood)" };
const cardTop: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12 };
const cardIcon: React.CSSProperties = { fontSize: 26, lineHeight: 1 };
const cardLabel: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 };
const cardDuration: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-text-2)", marginTop: 2 };
const cardDesc: React.CSSProperties = { fontSize: 12.5, color: "var(--ink-text-2)", lineHeight: 1.5, flex: 1 };
const triggerBtn: React.CSSProperties = { background: "transparent", width: "100%", justifyContent: "center", transition: "background .2s" };
const toastStyle: React.CSSProperties = { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--surface-3)", border: "1px solid var(--brass-dim)", color: "var(--parchment)", padding: "10px 20px", borderRadius: "var(--r-md)", fontSize: 13, fontFamily: "var(--font-mono)", zIndex: 50 };
