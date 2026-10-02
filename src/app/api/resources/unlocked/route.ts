import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";

/**
 * Archived resources the gamelord has released to the party. An id listed here
 * shows in All Resources as active instead of in the Archive. Everyone reads
 * the list; only the gamelord account may change it — not any admin.
 */
const STATE_PATH = "resources/unlocked.json";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await readJSON<string[]>(STATE_PATH, []));
}

/** Body: { id, unlocked } — unlocked: false returns the item to the Archive. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id !== "gamelord") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, unlocked } = await req.json() as { id?: unknown; unlocked?: unknown };
  if (typeof id !== "string" || !id || typeof unlocked !== "boolean") {
    return NextResponse.json({ error: "Expected { id: string, unlocked: boolean }" }, { status: 400 });
  }

  const ids = new Set(await readJSON<string[]>(STATE_PATH, []));
  if (unlocked) ids.add(id); else ids.delete(id);
  const next = [...ids];
  await writeJSON(STATE_PATH, next);
  return NextResponse.json(next);
}
