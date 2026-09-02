import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

export interface BoardItem {
  id: string;
  type: "note" | "image";
  x: number;
  y: number;
  rotation: number;
  text?: string;
  imageUrl?: string;
  caption?: string;
  color: string;
  author: string;
}

export interface BoardConnection {
  id: string;
  fromId: string;
  toId: string;
  color: string;
}

export interface BoardStroke {
  id: string;
  path: string;
  color: string;
  width: number;
}

export interface BoardState {
  items: BoardItem[];
  connections: BoardConnection[];
  strokes: BoardStroke[];
}

const EMPTY: BoardState = { items: [], connections: [], strokes: [] };
const BOARD_KEY = "board:state";

const redisAvailable =
  !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) &&
  process.env.NODE_ENV !== "development";

const redis = redisAvailable
  ? new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! })
  : null;

const LOCAL_PATH = path.join(
  process.env.VERCEL ? "/tmp/data" : path.join(process.cwd(), "data"),
  "board/state.json"
);

async function getBoard(): Promise<BoardState> {
  if (redis) {
    const data = await redis.get<BoardState>(BOARD_KEY);
    return data ?? EMPTY;
  }
  try {
    if (fs.existsSync(LOCAL_PATH)) return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8"));
  } catch {}
  return EMPTY;
}

async function saveBoard(state: BoardState): Promise<void> {
  if (redis) {
    await redis.set(BOARD_KEY, state);
    return;
  }
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(state, null, 2));
}

type BoardOp =
  | { op: "add-item"; item: BoardItem }
  | { op: "update-item"; id: string; changes: Partial<BoardItem> }
  | { op: "delete-item"; id: string }
  | { op: "add-connection"; connection: BoardConnection }
  | { op: "delete-connection"; id: string }
  | { op: "add-stroke"; stroke: BoardStroke }
  | { op: "clear-strokes" };

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json(EMPTY, { status: 401 });
  return NextResponse.json(await getBoard());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const op = (await req.json()) as BoardOp;
  const state = await getBoard();

  switch (op.op) {
    case "add-item":
      state.items.push(op.item);
      break;
    case "update-item": {
      const idx = state.items.findIndex((i) => i.id === op.id);
      if (idx !== -1) state.items[idx] = { ...state.items[idx], ...op.changes };
      break;
    }
    case "delete-item":
      state.items = state.items.filter((i) => i.id !== op.id);
      state.connections = state.connections.filter(
        (c) => c.fromId !== op.id && c.toId !== op.id
      );
      break;
    case "add-connection":
      if (!state.connections.some(
        (c) => (c.fromId === op.connection.fromId && c.toId === op.connection.toId) ||
               (c.fromId === op.connection.toId && c.toId === op.connection.fromId)
      )) {
        state.connections.push(op.connection);
      }
      break;
    case "delete-connection":
      state.connections = state.connections.filter((c) => c.id !== op.id);
      break;
    case "add-stroke":
      state.strokes.push(op.stroke);
      break;
    case "clear-strokes":
      state.strokes = [];
      break;
  }

  await saveBoard(state);
  return NextResponse.json(state);
}
