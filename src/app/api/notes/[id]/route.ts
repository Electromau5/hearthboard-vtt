import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeJSON } from "@/lib/blob-storage";
import { getNotes } from "@/app/api/notes/route";

const BLOB_PATH = "notes/notes.json";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { text?: string; x?: number; y?: number };

  const notes = await getNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.text !== undefined) notes[idx].text = body.text;
  if (typeof body.x === "number") notes[idx].x = body.x;
  if (typeof body.y === "number") notes[idx].y = body.y;

  await writeJSON(BLOB_PATH, notes);
  return NextResponse.json(notes[idx]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const notes = await getNotes();
  const updated = notes.filter((n) => n.id !== id);
  await writeJSON(BLOB_PATH, updated);
  return NextResponse.json({ ok: true });
}
