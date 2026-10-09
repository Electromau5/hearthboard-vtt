import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { gmAction, loadSave, type GmAction } from "@/lib/dialogue/director";
import { DIALOGUE_FACTS, DIALOGUE_NPCS } from "@/lib/dialogue/registry";
import { TIDES } from "@/lib/dialogue/types";

/**
 * The dialogue save, for the GM: GET returns everything (states, reputations,
 * facts, the interaction log) plus the NPC and fact catalogues; POST runs a GM
 * action — advance the day, set the tide, add a fact, set a disposition, reset.
 */

async function admin() {
  const session = await auth();
  return session?.user?.role === "admin" ? session : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    save: await loadSave(),
    npcs: Object.values(DIALOGUE_NPCS).map(n => ({ id: n.id, name: n.name, location_id: n.location_id, faction_id: n.faction_id, topics: n.topics.map(t => ({ id: t.id, prompt: t.prompt })) })),
    facts: Object.values(DIALOGUE_FACTS),
  });
}

export async function POST(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const a = (await req.json().catch(() => ({}))) as GmAction;
  const ok =
    a.action === "advance-day" || a.action === "reset" ||
    (a.action === "set-tide" && TIDES.includes(a.tide)) ||
    (a.action === "add-fact" && !!DIALOGUE_FACTS[a.fact_id]) ||
    (a.action === "set-disposition" && !!DIALOGUE_NPCS[a.npc_id] && typeof a.investigator === "string" && Number.isFinite(a.value)) ||
    (a.action === "reset-npc" && !!DIALOGUE_NPCS[a.npc_id]);
  if (!ok) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json({ save: await gmAction(a) });
}
