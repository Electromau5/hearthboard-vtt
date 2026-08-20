import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeJSON, deleteFile } from "@/lib/blob-storage";
import type { Location } from "@/lib/vtt-types";
import { CAMPAIGN_LOCATIONS } from "@/lib/campaign-defaults";
import { getStoredLocations } from "@/app/api/admin/locations/route";

const BLOB_PATH = "locations/index.json";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { name?: string; description?: string; primaryImage?: string };

  const stored = await getStoredLocations();
  let idx = stored.findIndex((l) => l.id === id);

  if (idx === -1) {
    // Not in storage yet — seed from campaign defaults so we can apply the patch
    const def = CAMPAIGN_LOCATIONS.find((l) => l.id === id);
    if (!def) return NextResponse.json({ error: "Not found" }, { status: 404 });
    stored.push({ ...def });
    idx = stored.length - 1;
  }

  if (body.name !== undefined) stored[idx].name = body.name.trim();
  if (body.description !== undefined) stored[idx].description = body.description;
  if (body.primaryImage !== undefined) stored[idx].primaryImage = body.primaryImage;
  await writeJSON(BLOB_PATH, stored);
  return NextResponse.json(stored[idx]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Campaign default locations cannot be deleted
  if (CAMPAIGN_LOCATIONS.some((l) => l.id === id)) {
    return NextResponse.json({ error: "Campaign locations cannot be deleted." }, { status: 400 });
  }

  const stored = await getStoredLocations();
  const loc = stored.find((l) => l.id === id);
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const att of loc.attachments) {
    await deleteFile(att.url);
  }

  const updated = stored.filter((l) => l.id !== id);
  await writeJSON(BLOB_PATH, updated);
  return NextResponse.json({ ok: true });
}
