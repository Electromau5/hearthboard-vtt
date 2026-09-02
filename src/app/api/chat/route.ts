import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/blob-storage";

export type ChatEvent = {
  id: string;
  type: "roll";
  who: string;
  formula: string;
  rolls: number[];
  total: number;
  sides: number;
  n: number;
  ts: number;
};

const BLOB_PATH = "chat/feed.json";
const MAX_EVENTS = 100;

async function getFeed(): Promise<ChatEvent[]> {
  return readJSON<ChatEvent[]>(BLOB_PATH, []);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json([], { status: 401 });
  return NextResponse.json(await getFeed());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = (await req.json()) as ChatEvent;
  if (!event.id || !event.who || event.type !== "roll") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const feed = await getFeed();
  if (!feed.some((e) => e.id === event.id)) {
    feed.push(event);
    if (feed.length > MAX_EVENTS) feed.splice(0, feed.length - MAX_EVENTS);
    try {
      await writeJSON(BLOB_PATH, feed);
    } catch {
      // Blob unavailable (e.g. store suspended) — event still shown locally
    }
  }

  return NextResponse.json({ ok: true });
}
