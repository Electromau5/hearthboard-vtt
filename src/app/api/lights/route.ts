import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";

/**
 * The lights in a walkthrough level, shared by everyone there. The mains:
 * gamelord throws them and every lamp in the level goes dark (room switches
 * keep their own setting underneath); unset means on. The room switches by
 * each door: anyone can work them, and the room goes light or dark for the
 * whole party; unset means off.
 */
type Setting = { on: boolean; setAt: number; setBy: string };
export type LightsState = Setting & { switches?: Record<string, Setting> };

const statePath = (level: string) => `lights/${level}.json`;
const validLevel = (level: unknown): level is string => typeof level === "string" && /^[a-z0-9-]{1,40}$/.test(level);
const validSwitch = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9_-]{1,40}$/.test(id);

/** GET /api/lights?level=bellevue — the mains, and each room switch. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(null, { status: 401 });
  const level = req.nextUrl.searchParams.get("level");
  if (!validLevel(level)) return NextResponse.json({ error: "Unknown level" }, { status: 400 });
  return NextResponse.json(await readJSON<LightsState | null>(statePath(level), null));
}

/**
 * POST { level, on } — the mains: gamelord only, not every admin.
 * POST { level, switch, on } — a room switch: anyone in the level.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { level, on, switch: id } = await req.json();
  if (!validLevel(level) || typeof on !== "boolean" || (id !== undefined && !validSwitch(id))) {
    return NextResponse.json({ error: "Expected a level, on: true/false and an optional switch id" }, { status: 400 });
  }
  if (id === undefined && session.user.username !== "gamelord") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const setting: Setting = { on, setAt: Date.now(), setBy: session.user.id };
  const prior = await readJSON<LightsState | null>(statePath(level), null);
  const state: LightsState = id === undefined
    ? { ...prior, ...setting }
    : { on: true, setAt: 0, setBy: "", ...prior, switches: { ...prior?.switches, [id]: setting } };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}
