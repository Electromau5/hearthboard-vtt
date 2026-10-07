import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import { MODELS } from "@/lib/rlyeh-model";
import type { ModelState } from "@/lib/walkthrough";

/**
 * The party's progress on a model in a walkthrough level (the architect's
 * R'lyeh): which pieces are in place, and which of the pieces that start
 * somewhere else have been found. Shared by everyone.
 */

const statePath = (id: string) => `models/${id}.json`;
const EMPTY: ModelState = { placed: [], found: [] };

/** GET /api/models/rlyeh */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!MODELS[id]) return NextResponse.json({ error: "Unknown model" }, { status: 404 });
  return NextResponse.json(await readJSON<ModelState>(statePath(id), EMPTY));
}

/**
 * POST { action: 'place', piece } — set a piece into the model. It must be on
 *   the table or already found.
 * POST { action: 'find', piece } — a piece from elsewhere is brought back.
 * POST { action: 'reset' } — admins only: every piece off the model, nothing found.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const model = MODELS[id];
  if (!model) return NextResponse.json({ error: "Unknown model" }, { status: 404 });

  const { action, piece } = (await req.json()) as { action?: string; piece?: string };
  const state = await readJSON<ModelState>(statePath(id), EMPTY);

  if (action === "reset") {
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await writeJSON(statePath(id), EMPTY);
    return NextResponse.json(EMPTY);
  }

  const def = model.pieces.find((p) => p.id === piece);
  if (!def) return NextResponse.json({ error: "Unknown piece" }, { status: 400 });

  if (action === "find") {
    if (def.source === "elsewhere" && !state.found.includes(def.id)) state.found.push(def.id);
  } else if (action === "place") {
    if (def.source === "elsewhere" && !state.found.includes(def.id)) {
      return NextResponse.json({ error: "That piece hasn't been found yet" }, { status: 409 });
    }
    if (!state.placed.includes(def.id)) state.placed.push(def.id);
  } else {
    return NextResponse.json({ error: "Expected action place, find or reset" }, { status: 400 });
  }

  await writeJSON(statePath(id), state);
  return NextResponse.json(state);
}
