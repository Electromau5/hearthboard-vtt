import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON, deleteFile } from "@/lib/blob-storage";
import type { Asset } from "@/lib/vtt-types";

const BLOB_PATH = "assets/index.json";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const assets = await readJSON<Asset[]>(BLOB_PATH, []);
  const asset = assets.find((a) => a.id === id);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteFile(asset.url);
  await writeJSON(BLOB_PATH, assets.filter((a) => a.id !== id));
  return NextResponse.json({ ok: true });
}
