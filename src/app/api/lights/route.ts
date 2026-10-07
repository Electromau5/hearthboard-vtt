import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";

/**
 * The mains in a walkthrough level: gamelord throws them and every lamp in the
 * level goes dark for everyone there (room switches keep their own setting
 * underneath). Unset means on.
 */
export type LightsState = { on: boolean; setAt: number; setBy: string };

const statePath = (level: string) => `lights/${level}.json`;
const validLevel = (level: unknown): level is string => typeof level === "string" && /^[a-z0-9-]{1,40}$/.test(level);

/** GET /api/lights?level=bellevue — whether the level's lights are on. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(null, { status: 401 });
  const level = req.nextUrl.searchParams.get("level");
  if (!validLevel(level)) return NextResponse.json({ error: "Unknown level" }, { status: 400 });
  return NextResponse.json(await readJSON<LightsState | null>(statePath(level), null));
}

/** POST { level, on } — gamelord only, not every admin. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.username !== "gamelord") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { level, on } = await req.json();
  if (!validLevel(level) || typeof on !== "boolean") {
    return NextResponse.json({ error: "Expected a level and on: true/false" }, { status: 400 });
  }
  const state: LightsState = { on, setAt: Date.now(), setBy: session.user.id };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}
