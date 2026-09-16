import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

/**
 * JSON state store backed by Upstash Redis in production and the filesystem in
 * local dev — the same split `character-storage.ts` uses.
 *
 * This deliberately mirrors the `readJSON`/`writeJSON` signature of
 * `blob-storage.ts` so a route migrates with a one-line import change. Prefer
 * this module for any state that must be shared between players: the blob
 * store is no longer provisioned, and without `BLOB_READ_WRITE_TOKEN` the blob
 * helpers silently fall back to `/tmp`, which on Vercel is private to a single
 * serverless instance (so every player ends up with their own copy).
 */

const redisAvailable =
  !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) &&
  process.env.NODE_ENV !== "development";

const redis = redisAvailable
  ? new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! })
  : null;

const LOCAL_DATA = process.env.VERCEL ? "/tmp/data" : path.join(process.cwd(), "data");

/** "chat/feed.json" -> redis key "chat:feed" */
function redisKey(statePath: string): string {
  return statePath.replace(/\.[^./]+$/, "").replace(/\//g, ":");
}

export async function readJSON<T>(statePath: string, fallback: T): Promise<T> {
  if (redis) {
    const data = await redis.get<T>(redisKey(statePath));
    return data ?? fallback;
  }
  try {
    const p = path.join(LOCAL_DATA, statePath);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {}
  return fallback;
}

export async function writeJSON(statePath: string, data: unknown): Promise<void> {
  if (redis) {
    await redis.set(redisKey(statePath), data);
    return;
  }
  const p = path.join(LOCAL_DATA, statePath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

/** True when shared state actually persists across instances. */
export function sharedStoreAvailable(): boolean {
  return !!redis;
}
