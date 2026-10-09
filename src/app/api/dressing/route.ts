import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import { PROP_LIBRARY } from "@/lib/prop-library";
import type { DressedProp, DressingState } from "@/lib/walkthrough";

/**
 * Set dressing: the props gamelord has set down in a walkthrough level from
 * the prop library's tray. One list per level, read when the level opens and
 * replaced whole on each change (players in the level hear of a change over
 * Liveblocks and read it again, so nothing polls this).
 */

const statePath = (level: string) => `dressing/${level}.json`;
const EMPTY: DressingState = { items: [], setAt: 0, setBy: "" };
const MAX_ITEMS = 400;
const validLevel = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s);
const num = (n: unknown, max = 1000): n is number => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= max;
const vec3 = (v: unknown, max?: number): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(n => num(n, max));

/** Only what a dressed prop is made of, checked and rounded; null when it is not one. */
function clean(raw: unknown): DressedProp | null {
  if (!raw || typeof raw !== "object") return null;
  const { key, asset, p, turnDeg, up } = raw as Record<string, unknown>;
  if (typeof key !== "string" || !/^[a-z0-9]{4,24}$/.test(key)) return null;
  if (typeof asset !== "string" || !Object.hasOwn(PROP_LIBRARY, asset)) return null;
  if (!vec3(p) || !num(turnDeg, 3600)) return null;
  if (up !== undefined && !vec3(up, 1)) return null;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return {
    key,
    asset: asset as DressedProp["asset"],
    p: [r(p[0]), r(p[1]), r(p[2])],
    turnDeg: Math.round((((turnDeg % 360) + 360) % 360) * 10) / 10,
    ...(up ? { up: [r(up[0]), r(up[1]), r(up[2])] as [number, number, number] } : {}),
  };
}

/** GET /api/dressing?level=house — what is set down there. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const level = req.nextUrl.searchParams.get("level");
  if (!validLevel(level)) return NextResponse.json({ error: "Unknown level" }, { status: 400 });
  return NextResponse.json(await readJSON<DressingState>(statePath(level), EMPTY));
}

/** POST { level, items } — the level's whole set dressing. gamelord only, not every admin. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.username !== "gamelord") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { level, items } = (await req.json()) as { level?: unknown; items?: unknown };
  if (!validLevel(level) || !Array.isArray(items) || items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Expected a level and up to ${MAX_ITEMS} items` }, { status: 400 });
  }
  const cleaned = items.map(clean);
  if (cleaned.some(i => !i)) return NextResponse.json({ error: "An item is not a library prop" }, { status: 400 });
  const state: DressingState = { items: cleaned as DressedProp[], setAt: Date.now(), setBy: session.user.id };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}
