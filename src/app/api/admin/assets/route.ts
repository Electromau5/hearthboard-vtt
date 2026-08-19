import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON, uploadFile } from "@/lib/blob-storage";
import type { Asset, AssetType } from "@/lib/vtt-types";
import { randomUUID } from "crypto";

const BLOB_PATH = "assets/index.json";

async function getAssets(): Promise<Asset[]> {
  return readJSON<Asset[]>(BLOB_PATH, []);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getAssets());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const name = (form.get("name") as string | null)?.trim() || file.name;
  const id = randomUUID();
  const ext = file.name.split(".").pop() ?? "";
  const blobPath = `uploads/assets/${id}${ext ? "." + ext : ""}`;

  const mime = file.type || "application/octet-stream";
  const assetType: AssetType = mime.startsWith("image/")
    ? "image"
    : mime === "application/pdf" || mime.startsWith("text/")
    ? "document"
    : "other";

  const url = await uploadFile(blobPath, file, mime);
  const asset: Asset = {
    id,
    name,
    url,
    type: assetType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };

  const assets = await getAssets();
  assets.unshift(asset);
  await writeJSON(BLOB_PATH, assets);
  return NextResponse.json(asset, { status: 201 });
}
