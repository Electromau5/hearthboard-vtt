import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/blob-storage";

export interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  sceneId: string;
  author: string;
}

const BLOB_PATH = "notes/notes.json";

export async function getNotes(): Promise<StickyNote[]> {
  return readJSON<StickyNote[]>(BLOB_PATH, []);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json([], { status: 401 });
  return NextResponse.json(await getNotes());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<StickyNote>;
  if (typeof body.x !== "number" || typeof body.y !== "number" || !body.sceneId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const note: StickyNote = {
    id: body.id ?? ("n" + Date.now()),
    text: body.text ?? "",
    x: body.x,
    y: body.y,
    sceneId: body.sceneId,
    author: session.user.name ?? session.user.id,
  };

  const notes = await getNotes();
  notes.push(note);
  await writeJSON(BLOB_PATH, notes);
  return NextResponse.json(note);
}
