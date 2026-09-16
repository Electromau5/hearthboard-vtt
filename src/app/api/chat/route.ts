import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";

export type ChatEvent = {
  id: string;
  type: "roll" | "text";
  /** Display name of the author, resolved client-side (character name, or GM). */
  who: string;
  /** Author's account id, stamped server-side — clients cannot spoof it. */
  userId: string;
  /** Stamped server-side so every client compares timestamps from one clock. */
  ts: number;
  // Roll events
  formula?: string;
  rolls?: number[];
  total?: number;
  sides?: number;
  n?: number;
  /** Set when the roll was a skill/characteristic check: the roll-under target
   *  and the Call of Cthulhu success level it produced. */
  target?: number;
  level?: string;
  // Text events
  text?: string;
};

const STATE_PATH = "chat/feed.json";
const MAX_EVENTS = 100;
const MAX_TEXT_LEN = 500;

async function getFeed(): Promise<ChatEvent[]> {
  return readJSON<ChatEvent[]>(STATE_PATH, []);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json([], { status: 401 });
  return NextResponse.json(await getFeed());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Partial<ChatEvent>;
  if (!body.id || !body.who || (body.type !== "roll" && body.type !== "text")) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  if (body.type === "roll" && (!body.formula || !Array.isArray(body.rolls))) {
    return NextResponse.json({ error: "Invalid roll" }, { status: 400 });
  }
  if (body.type === "text" && !body.text?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const event: ChatEvent = {
    id: body.id,
    type: body.type,
    who: String(body.who).slice(0, 80),
    userId: session.user.id,
    ts: Date.now(),
    ...(body.type === "roll"
      ? {
          formula: body.formula,
          rolls: body.rolls,
          total: body.total,
          sides: body.sides,
          n: body.n,
          ...(typeof body.target === "number" ? { target: body.target } : {}),
          ...(body.level ? { level: String(body.level).slice(0, 20) } : {}),
        }
      : { text: body.text!.trim().slice(0, MAX_TEXT_LEN) }),
  };

  const feed = await getFeed();
  if (!feed.some((e) => e.id === event.id)) {
    feed.push(event);
    if (feed.length > MAX_EVENTS) feed.splice(0, feed.length - MAX_EVENTS);
    try {
      await writeJSON(STATE_PATH, feed);
    } catch (err) {
      // Surface the failure instead of pretending the broadcast succeeded —
      // a silently dropped write is what made rolls look player-local.
      console.error("[chat POST] write failed:", err);
      return NextResponse.json(
        { error: "Could not broadcast — shared storage unavailable." },
        { status: 503 }
      );
    }
  }

  return NextResponse.json(event);
}
