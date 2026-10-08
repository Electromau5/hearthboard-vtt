import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import type { DoorsState } from "@/lib/walkthrough";

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

/** POST { level, id, open } — gamelord only, not every admin. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.username !== "gamelord") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { level, id, open } = (await req.json()) as { level?: unknown; id?: unknown; open?: unknown };
  if (!validLevel(level) || !validId(id) || typeof open !== "boolean") {
    return NextResponse.json({ error: "Expected a level, a door id and open: true/false" }, { status: 400 });
  }
  const state = await readJSON<DoorsState>(statePath(level), {});
  state[id] = { open, setAt: Date.now(), setBy: session.user.id };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}
