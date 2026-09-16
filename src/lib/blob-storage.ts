import { put, list, del, get } from "@vercel/blob";
import fs from "fs";
import path from "path";

// On Vercel without a blob token, fall back to /tmp (the only writable path)
const LOCAL_DATA = process.env.VERCEL
  ? "/tmp/data"
  : path.join(process.cwd(), "data");
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV !== "development";

// Short CDN cache TTL (seconds) for JSON state. Long enough that frequent poll
// reads are served as free cache HITs, short enough that edits still propagate
// within a couple of seconds.
const BLOB_CACHE_MAX_AGE = 2;

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
  // Fast path: read the fixed pathname straight from the CDN cache. No list()
  // call, so reads no longer spend an Advanced Operation each — and cache HITs
  // cost no Simple Op and no origin transfer. get() resolves the URL from
  // BLOB_STORE_ID and returns null when the blob doesn't exist.
  try {
    const result = await get(blobPath, { access: "private" });
    if (result?.stream) {
      return JSON.parse(await new Response(result.stream).text()) as T;
    }
  } catch {}
  // Legacy fallback: blobs written before the fixed-pathname migration live at
  // "<path>-<randomsuffix>.json". Locate one once; the next writeJSON re-saves
  // it to the fixed pathname, after which the fast path takes over and this
  // list() stops firing for that path.
  try {
    const { blobs } = await list({ prefix: blobPrefix(blobPath), limit: 1 });
    if (blobs.length === 0) return fallback;
    const legacy = await get(blobs[0].url, { access: "private", useCache: false });
    if (!legacy?.stream) return fallback;
    return JSON.parse(await new Response(legacy.stream).text()) as T;
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
  // Overwrite a fixed pathname in place. The stable URL lets reads be served
  // from the CDN cache (see readJSON), and the short TTL keeps edits fresh.
  // No list()/del() churn per write.
  await put(blobPath, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: BLOB_CACHE_MAX_AGE,
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
    access: "private",
    contentType,
    addRandomSuffix: true,
  });
  return blob.downloadUrl;
}

export async function deleteFile(url: string): Promise<void> {
  if (!useBlob || url.startsWith("/api/dev-assets/")) return;
  await del(url);
}

export function blobAvailable(): boolean {
  return useBlob || process.env.NODE_ENV === "development";
}
