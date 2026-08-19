import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { path: segments } = await params;
  const filePath = path.join(process.cwd(), "data", ...segments);

  // Guard against path traversal
  const dataDir = path.join(process.cwd(), "data");
  if (!filePath.startsWith(dataDir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  return new NextResponse(buf, { headers: { "Content-Type": contentType } });
}
