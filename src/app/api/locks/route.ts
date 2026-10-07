import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import type { LocksState } from "@/lib/walkthrough";

/**
 * The safes cracked in a walkthrough level. Shared by everyone: once one
 * investigator opens a safe, it stands open for the whole party.
 */

const statePath = (level: string) => `locks/${level}.json`;
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
 * POST { level, id } — the dial was cracked: the lock is open.
 * POST { level, id, relock: true } — admins only: shut it again.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { level, id, relock } = (await req.json()) as { level?: unknown; id?: unknown; relock?: unknown };
  if (!validId(level) || !validId(id)) return NextResponse.json({ error: "Expected a level and a lock id" }, { status: 400 });
  if (relock && session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const state = await readJSON<LocksState>(statePath(level), {});
  if (relock) delete state[id];
  else state[id] ??= { by: session.user.id, at: Date.now() };
  await writeJSON(statePath(level), state);
  return NextResponse.json(state);
}
