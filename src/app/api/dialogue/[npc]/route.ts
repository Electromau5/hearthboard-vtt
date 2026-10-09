import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ask, DialogueError, openDialogue, speakerFor } from "@/lib/dialogue/director";
import { SKILLS, type DialogueSkill } from "@/lib/dialogue/types";

/**
 * Topic dialogue with an NPC (see src/lib/dialogue).
 *
 * GET  ?as=<slug>                         — walk up: greeting, regard and the topics on offer
 * POST { topic, skill?: charm|intimidate|persuade|deceive, as? } — ask, straight or pushed
 *
 * `as` lets the GM speak as any investigator; players always speak as their own.
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ npc: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { npc } = await params;
  const who = await speakerFor(session.user, req.nextUrl.searchParams.get("as"));
  const view = await openDialogue(npc, who);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ npc: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { npc } = await params;
  const body = (await req.json().catch(() => ({}))) as { topic?: unknown; skill?: unknown; as?: unknown };
  if (typeof body.topic !== "string") return NextResponse.json({ error: "Ask about something" }, { status: 400 });
  const skill = body.skill == null ? null : SKILLS.includes(body.skill as DialogueSkill) ? (body.skill as DialogueSkill) : undefined;
  if (skill === undefined) return NextResponse.json({ error: "Unknown skill" }, { status: 400 });
  const who = await speakerFor(session.user, typeof body.as === "string" ? body.as : null);
  try {
    return NextResponse.json(await ask(npc, who, body.topic, skill));
  } catch (err) {
    if (err instanceof DialogueError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error(`dialogue ${npc} failed:`, err);
    return NextResponse.json({ error: "He looks at you, and says nothing." }, { status: 500 });
  }
}
