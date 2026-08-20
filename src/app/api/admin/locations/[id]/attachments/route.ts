import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeJSON, uploadFile, deleteFile } from "@/lib/blob-storage";
import type { Attachment, AttachmentType } from "@/lib/vtt-types";
import { CAMPAIGN_LOCATIONS } from "@/lib/campaign-defaults";
import { getStoredLocations } from "@/app/api/admin/locations/route";
import { randomUUID } from "crypto";

const BLOB_PATH = "locations/index.json";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const locations = await getStoredLocations();
  let idx = locations.findIndex((l) => l.id === id);
  if (idx === -1) {
    const def = CAMPAIGN_LOCATIONS.find((l) => l.id === id);
    if (!def) return NextResponse.json({ error: "Location not found" }, { status: 404 });
    locations.push({ ...def });
    idx = locations.length - 1;
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const name = (form.get("name") as string | null)?.trim() || file?.name || "Attachment";
  const type = ((form.get("type") as string | null) ?? "other") as AttachmentType;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const attId = randomUUID();
  const ext = file.name.split(".").pop() ?? "";
  const blobPath = `uploads/locations/${id}/${attId}${ext ? "." + ext : ""}`;
  const url = await uploadFile(blobPath, file, file.type || "application/octet-stream");

  const attachment: Attachment = { id: attId, name, url, type };
  locations[idx].attachments.push(attachment);
  await writeJSON(BLOB_PATH, locations);

  return NextResponse.json(attachment, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { attachmentId } = await req.json();
  if (!attachmentId) return NextResponse.json({ error: "attachmentId required" }, { status: 400 });

  const locations = await getStoredLocations();
  const idx = locations.findIndex((l) => l.id === id);
  if (idx === -1) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  const att = locations[idx].attachments.find((a) => a.id === attachmentId);
  if (att) await deleteFile(att.url);
  locations[idx].attachments = locations[idx].attachments.filter((a) => a.id !== attachmentId);

  await writeJSON(BLOB_PATH, locations);
  return NextResponse.json({ ok: true });
}
