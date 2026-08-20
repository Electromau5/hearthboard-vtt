import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON } from "@/lib/blob-storage";
import type { ActiveEffect } from "@/app/api/admin/effects/route";

const BLOB_PATH = "effects/current.json";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json(null, { status: 401 });

  const effect = await readJSON<ActiveEffect | null>(BLOB_PATH, null);
  if (!effect) return NextResponse.json(null);

  // Expired
  if (Date.now() > effect.triggeredAt + effect.duration) {
    return NextResponse.json(null);
  }

  // Not targeted at this user
  if (effect.targetUserIds && !effect.targetUserIds.includes(session.user.id)) {
    return NextResponse.json(null);
  }

  return NextResponse.json(effect);
}
