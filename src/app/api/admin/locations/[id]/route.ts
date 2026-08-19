import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON, deleteFile } from "@/lib/blob-storage";
import type { Location } from "@/lib/vtt-types";

const BLOB_PATH = "locations/index.json";

async function getLocations(): Promise<Location[]> {
  return readJSON<Location[]>(BLOB_PATH, []);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { name?: string; description?: string };

  const locations = await getLocations();
  const idx = locations.findIndex((l) => l.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.name !== undefined) locations[idx].name = body.name.trim();
  if (body.description !== undefined) locations[idx].description = body.description;
  await writeJSON(BLOB_PATH, locations);
  return NextResponse.json(locations[idx]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const locations = await getLocations();
  const loc = locations.find((l) => l.id === id);
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete all attached files
  for (const att of loc.attachments) {
    await deleteFile(att.url);
  }

  const updated = locations.filter((l) => l.id !== id);
  await writeJSON(BLOB_PATH, updated);
  return NextResponse.json({ ok: true });
}
