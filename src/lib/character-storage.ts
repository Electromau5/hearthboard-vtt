import { Redis } from "@upstash/redis";
import type { Character } from "@/lib/characters";
import fs from "fs";
import path from "path";

const redisAvailable = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) && process.env.NODE_ENV !== "development";

const redis = redisAvailable
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

const LOCAL_DATA = process.env.VERCEL
  ? "/tmp/data"
  : path.join(process.cwd(), "data");

function localPath(slug: string) {
  return path.join(LOCAL_DATA, "characters", `${slug}.json`);
}

export async function readCharacterOverrides(slug: string): Promise<Partial<Character>> {
  if (redis) {
    const data = await redis.get<Partial<Character>>(`character:${slug}`);
    return data ?? {};
  }
  try {
    const p = localPath(slug);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {}
  return {};
}

export async function writeCharacterOverrides(slug: string, data: Partial<Character>): Promise<void> {
  if (redis) {
    await redis.set(`character:${slug}`, data);
    return;
  }
  const p = localPath(slug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}
