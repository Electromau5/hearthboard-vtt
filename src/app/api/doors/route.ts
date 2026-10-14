import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import type { DoorsState, LocksState } from "@/lib/walkthrough";
import { HOUSE_LEVEL } from "@/lib/innsmouth-house";

/**
 * The doors gamelord opens and shuts in a walkthrough level — the derelict
 * house's back door, onto the sewer. Shared by everyone there.
 */

const statePath = (level: string) => `doors/${level}.json`;
const validLevel = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s);
const validId = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9_-]{1,40}$/.test(s);

/** GET /api/doors?level=house — the doors standing open, by id. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const level = req.nextUrl.searchParams.get("level");
  if (!validLevel(level)) return NextResponse.json({ error: "Unknown level" }, { status: 400 });
  return NextResponse.json(await readJSON<DoorsState>(statePath(level), {}));
}

/** Levels with a scripted ambush (WalkthroughLevel.ambush) that the party sets off. */
const AMBUSHING = [HOUSE_LEVEL];

/**
 * POST { level, id, open } — gamelord only, not every admin.
 * POST { level, id, ambush: true } — any investigator: sets off the level's
 * ambush, once, and only after its item has been taken (Ambush.after).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { level?: unknown; id?: unknown; open?: unknown; ambush?: unknown };
  if (body.ambush === true) return setOff(body.level, body.id, session.user.id);
  if (session.user.username !== "gamelord") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { level, id, open } = body;
  if (!validLevel(level) || !validId(id) || typeof open !== "boolean") {
    return NextResponse.json({ error: "Expected a level, a door id and open: true/false" }, { status: 400 });
  }
  const state = await readJSON<DoorsState>(statePath(level), {});
  // Bringing an ambush in once its item is out is the real thing; before that it's a rehearsal.
  const ambush = AMBUSHING.find(l => l.id === level)?.ambush;
  const fired = !!state[id]?.fired
    || (open && ambush?.id === id && !!(await readJSON<LocksState>(`locks/${ambush.after.level}.json`, {}))[ambush.after.item]);
  state[id] = { open, setAt: Date.now(), setBy: session.user.id, ...(fired && { fired: true }) };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}

async function setOff(level: unknown, id: unknown, by: string) {
  const ambush = AMBUSHING.find(l => l.id === level)?.ambush;
  if (!validLevel(level) || !ambush || ambush.id !== id) {
    return NextResponse.json({ error: "No such ambush" }, { status: 400 });
  }
  const state = await readJSON<DoorsState>(statePath(level), {});
  // Once only: dismissed, it stays gone (gamelord can still set it off by hand). Only a real
  // setting-off counts — gamelord's here/gone before the item was taken doesn't use it up.
  if (state[ambush.id]?.fired || state[ambush.id]?.open) return NextResponse.json(state);
  const taken = await readJSON<LocksState>(`locks/${ambush.after.level}.json`, {});
  if (!taken[ambush.after.item]) return NextResponse.json({ error: "Not yet" }, { status: 409 });
  state[ambush.id] = { open: true, setAt: Date.now(), setBy: by, fired: true };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}
