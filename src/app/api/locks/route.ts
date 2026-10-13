import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import type { DoorsState, LocksState, SafeItem } from "@/lib/walkthrough";
import { VESSEL_LEVEL } from "@/lib/fishing-vessel";

/**
 * The safes cracked in a walkthrough level. Shared by everyone: once one
 * investigator opens a safe, it stands open for the whole party. gamelord's
 * own openings are not kept (the walkthrough holds them for his visit only).
 */

const statePath = (level: string) => `locks/${level}.json`;

/** Levels whose safes hold something that, once taken, opens a door elsewhere (SafeItem.releases). */
const RELEASING = [VESSEL_LEVEL];
const itemFor = (level: string, id: string): SafeItem | undefined => RELEASING
  .filter(l => l.id === level)
  .flatMap(l => Object.values(l.locks ?? {}))
  .map(l => l.item)
  .find(i => i?.id === id);
const validId = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9_-]{1,40}$/.test(s);

/** GET /api/locks?level=house — the open locks, by examinable id. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const level = req.nextUrl.searchParams.get("level");
  if (!validId(level)) return NextResponse.json({ error: "Unknown level" }, { status: 400 });
  return NextResponse.json(await readJSON<LocksState>(statePath(level), {}));
}

/**
 * POST { level, id } — the dial was cracked: the lock is open. Also how an
 * item is taken out of a safe (its SafeItem id), which may open a door.
 * POST { level, id, relock: true } — admins only: shut it again.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { level, id, relock } = (await req.json()) as { level?: unknown; id?: unknown; relock?: unknown };
  if (!validId(level) || !validId(id)) return NextResponse.json({ error: "Expected a level and a lock id" }, { status: 400 });
  if (relock && session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const state = await readJSON<LocksState>(statePath(level), {});
  if (!relock && session.user.id === "gamelord") return NextResponse.json(state);
  const fresh = !relock && !state[id];
  if (relock) delete state[id];
  else state[id] ??= { by: session.user.id, at: Date.now() };
  await writeJSON(statePath(level), state);

  // Taken for the first time: whatever it was keeping shut opens, for everyone in that level.
  const release = fresh ? itemFor(level, id)?.releases : undefined;
  if (release) {
    const doors = await readJSON<DoorsState>(`doors/${release.level}.json`, {});
    doors[release.door] = { open: true, setAt: Date.now(), setBy: session.user.id };
    await writeJSON(`doors/${release.level}.json`, doors);
  }
  return NextResponse.json(state);
}
