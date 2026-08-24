import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/blob-storage";

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

const BLOB_PATH = "board/state.json";
const EMPTY: BoardState = { items: [], connections: [], strokes: [] };

async function getBoard(): Promise<BoardState> {
  return readJSON<BoardState>(BLOB_PATH, EMPTY);
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
      // Prevent duplicate connections between same pair
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

  await writeJSON(BLOB_PATH, state);
  return NextResponse.json(state);
}
