import { put, list, del } from "@vercel/blob";
import fs from "fs";
import path from "path";

// On Vercel without a blob token, fall back to /tmp (the only writable path)
const LOCAL_DATA = process.env.VERCEL
  ? "/tmp/data"
  : path.join(process.cwd(), "data");
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// ── JSON helpers ─────────────────────────────────────────────────────

// Strip file extension to use as list() prefix so it matches addRandomSuffix filenames.
// e.g. "effects/current.json" -> "effects/current" matches "effects/current-abc123.json"
function blobPrefix(blobPath: string): string {
  return blobPath.replace(/\.[^./]+$/, "");
}

export async function readJSON<T>(blobPath: string, fallback: T): Promise<T> {
  if (!useBlob) {
    const localPath = path.join(LOCAL_DATA, blobPath);
    try {
      if (fs.existsSync(localPath)) {
        return JSON.parse(fs.readFileSync(localPath, "utf8"));
      }
    } catch {}
    return fallback;
  }
  try {
    const { blobs } = await list({ prefix: blobPrefix(blobPath), limit: 1 });
    if (blobs.length === 0) return fallback;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export async function writeJSON(blobPath: string, data: unknown): Promise<void> {
  if (!useBlob) {
    const localPath = path.join(LOCAL_DATA, blobPath);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2));
    return;
  }
  // Delete any existing blobs at this path before writing so reads always
  // get the latest version via list(). addRandomSuffix:true gives each write
  // a unique CDN URL, preventing stale CDN cache from masking updates.
  const { blobs } = await list({ prefix: blobPrefix(blobPath), limit: 5 });
  if (blobs.length > 0) await del(blobs.map((b) => b.url));
  await put(blobPath, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
    cacheControlMaxAge: 0,
  });
}

export async function deleteByPrefix(prefix: string): Promise<void> {
  if (!useBlob) return;
  const { blobs } = await list({ prefix, limit: 100 });
  if (blobs.length > 0) await del(blobs.map((b) => b.url));
}

// ── File upload ──────────────────────────────────────────────────────

export async function uploadFile(
  blobPath: string,
  file: Blob,
  contentType: string
): Promise<string> {
  if (!useBlob) {
    // Dev: save to local data directory, return a fake local URL
    const localPath = path.join(LOCAL_DATA, blobPath);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(localPath, buf);
    return `/api/dev-assets/${blobPath}`;
  }
  const blob = await put(blobPath, file, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

export async function deleteFile(url: string): Promise<void> {
  if (!useBlob || url.startsWith("/api/dev-assets/")) return;
  await del(url);
}

export function blobAvailable(): boolean {
  return useBlob || process.env.NODE_ENV === "development";
}
