"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DialogueSave, FactDef, TidePhase } from "@/lib/dialogue/types";
import { TIDES } from "@/lib/dialogue/types";

type NpcInfo = { id: string; name: string; location_id: string; faction_id: string; topics: { id: string; prompt: string }[] };
type Data = { save: DialogueSave; npcs: NpcInfo[]; facts: FactDef[] };

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: "var(--ink-text-2)" };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 18 };

/**
 * The GM's view of the dialogue system: game time, every NPC's regard for each
 * investigator, reputations, the fact registry and the interaction log — and
 * the controls that move them (next day, tide, add a fact, set or reset).
 */
export default function AdminDialoguePage() {
  const [data, setData] = useState<Data | null>(null);
  const [fact, setFact] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dialogue", { cache: "no-store" })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setData, () => setError("Could not load the dialogue save."));
  }, []);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    const res = await fetch("/api/dialogue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed."); return; }
    setError("");
    setData(d => d ? { ...d, save: json.save } : d);
  };

  const save = data?.save;
  const known = new Set(save?.fact_registry.map(f => f.id));

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid var(--line)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>Admin — NPC Dialogue</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/experience" className="btn btn-ghost btn-sm nav-btn">Experience</Link>
          <Link href="/" className="btn btn-ghost btn-sm nav-btn">App</Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        {error && <div style={{ color: "var(--blood)" }}>{error}</div>}
        {!save ? <div style={mono}>Loading…</div> : (
          <>
            <div style={{ ...card, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={mono}>Game time</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>Day {save.game_time.day} · {save.game_time.tide_phase} tide</div>
              </div>
              <span style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={() => act({ action: "advance-day" })} title="Dispositions drift toward 0 (grudges at half rate); faction gossip lands">Next day</button>
              <select value={save.game_time.tide_phase} onChange={e => act({ action: "set-tide", tide: e.target.value as TidePhase })} className="btn btn-ghost btn-sm">
                {TIDES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={() => act({ action: "reset" }, "Wipe the whole dialogue save — every NPC forgets everyone?")}>Reset all</button>
            </div>

            {data.npcs.map(npc => {
              const states = save.npc_states[npc.id] ?? {};
              return (
                <div key={npc.id} style={card}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>{npc.name}</span>
                    <span style={mono}>{npc.location_id} · {npc.faction_id}</span>
                    <span style={{ flex: 1 }} />
                    <button className="btn btn-ghost btn-sm" onClick={() => act({ action: "reset-npc", npc_id: npc.id }, `${npc.name} forgets everyone?`)}>Reset NPC</button>
                  </div>
                  {Object.keys(save.topic_claims?.[npc.id] ?? {}).length > 0 && (
                    <div style={{ marginBottom: 10, fontSize: 12 }}>
                      <div style={{ ...mono, marginBottom: 4 }}>Questions used up (one attempt per party)</div>
                      {Object.entries(save.topic_claims![npc.id]).map(([topic, c]) => (
                        <div key={topic} style={{ color: "var(--ink-text-2)" }}>
                          {npc.topics.find(t => t.id === topic)?.prompt ?? topic} — {c.name}, {c.skill ?? "straight"}{c.outcome !== "straight" ? `, ${c.outcome.replace("_", " ")}` : ""} (day {c.day})
                        </div>
                      ))}
                    </div>
                  )}
                  {Object.keys(states).length === 0 ? <div style={mono}>No one has spoken to them yet.</div> : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr style={{ textAlign: "left" }}>{["Investigator", "Disposition", "Asked", "Locked", "Flags / lies", ""].map(h => <th key={h} style={{ ...mono, padding: "4px 6px" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {Object.entries(states).map(([who, st]) => (
                          <tr key={who} style={{ borderTop: "1px solid var(--line)" }}>
                            <td style={{ padding: "6px" }}>{who}<div style={mono}>{st.interaction_count} interactions</div></td>
                            <td style={{ padding: "6px" }}>
                              <input type="number" defaultValue={Math.round(st.disposition)} key={st.disposition} min={-100} max={100} style={{ width: 64, background: "var(--ink)", color: "inherit", border: "1px solid var(--line)", padding: 3 }}
                                onBlur={e => { const v = Number(e.target.value); if (v !== st.disposition) void act({ action: "set-disposition", npc_id: npc.id, investigator: who, value: v }); }} />
                            </td>
                            <td style={{ padding: "6px", color: "var(--ink-text-2)" }}>{st.topics_asked.join(", ")}</td>
                            <td style={{ padding: "6px", color: "var(--ink-text-2)" }}>{st.topics_locked.join(", ")}</td>
                            <td style={{ padding: "6px", color: "var(--ink-text-2)" }}>
                              {st.flags.join(", ")}
                              {Object.entries(st.lies_believed).map(([lie, b]) => <div key={lie} style={{ color: b ? "var(--arcane)" : "var(--blood)" }}>{lie}: {b ? "believed" : "not believed"}</div>)}
                            </td>
                            <td><button className="btn btn-ghost btn-sm" onClick={() => act({ action: "reset-npc", npc_id: npc.id, investigator: who }, `${npc.name} forgets ${who}?`)}>Forget</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
              <div style={card}>
                <div style={{ ...mono, marginBottom: 8 }}>Reputation</div>
                {Object.keys(save.reputations).length === 0 && <div style={{ fontSize: 12, color: "var(--ink-text-2)" }}>Untouched everywhere.</div>}
                {Object.entries(save.reputations).map(([scope, v]) => (
                  <div key={scope} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{scope}</span><span style={{ color: v < 0 ? "var(--blood)" : "var(--forest)" }}>{v}</span></div>
                ))}
                {save.pending_gossip.map((g, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--ink-text-2)", fontStyle: "italic" }}>{g.scope} {g.delta > 0 ? "+" : ""}{g.delta} lands on day {g.day}</div>
                ))}
              </div>
              <div style={card}>
                <div style={{ ...mono, marginBottom: 8 }}>Fact registry</div>
                {data.facts.map(f => (
                  <div key={f.id} style={{ fontSize: 12, padding: "2px 0", color: known.has(f.id) ? "var(--parchment)" : "var(--ink-text-2)", opacity: known.has(f.id) ? 1 : 0.45 }} title={f.summary}>
                    {known.has(f.id) ? "● " : "○ "}{f.id}{f.gossip_spread ? " (gossip)" : ""}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <select value={fact} onChange={e => setFact(e.target.value)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                    <option value="">Add a fact (e.g. a discovered clue)…</option>
                    {data.facts.filter(f => !known.has(f.id)).map(f => <option key={f.id} value={f.id}>{f.id}</option>)}
                  </select>
                  <button className="btn btn-sm" disabled={!fact} onClick={() => { void act({ action: "add-fact", fact_id: fact }); setFact(""); }}>Add</button>
                </div>
              </div>
            </div>

            <div style={card}>
              <div style={{ ...mono, marginBottom: 8 }}>Interaction log ({save.interaction_log.length})</div>
              {[...save.interaction_log].reverse().map(e => (
                <div key={e.entry_id} style={{ borderTop: "1px solid var(--line)", padding: "6px 0", fontSize: 12 }}>
                  <div><span style={mono}>Day {e.game_time.day} · {e.game_time.tide_phase}</span> {e.note}</div>
                  <div style={{ color: "var(--ink-text-2)", fontSize: 11 }}>
                    disposition {e.disposition_delta >= 0 ? "+" : ""}{e.disposition_delta}
                    {e.roll && <> · d100 {e.roll.d100} vs {e.roll.target} ({e.roll.mods.join(", ")})</>}
                    {e.reputation_delta && <> · {Object.entries(e.reputation_delta).map(([k, v]) => `${k} ${v}`).join(", ")}</>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
