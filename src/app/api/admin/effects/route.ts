import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/blob-storage";

export type ActiveEffect = {
  id: string;
  label: string;
  duration: number;
  triggeredAt: number;
  targetUserIds: string[] | null;
  data?: Record<string, unknown>;
};

const BLOB_PATH = "effects/current.json";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const effect = await readJSON<ActiveEffect | null>(BLOB_PATH, null);
  return NextResponse.json(effect);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, label, duration, targetUserIds, data } = await req.json();
  const effect: ActiveEffect = {
    id,
    label,
    duration,
    triggeredAt: Date.now(),
    targetUserIds: targetUserIds ?? null,
    ...(data ? { data } : {}),
  };
  await writeJSON(BLOB_PATH, effect);
  return NextResponse.json(effect, { status: 201 });
}

export async function DELETE() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await writeJSON(BLOB_PATH, null);
  return NextResponse.json({ ok: true });
}
