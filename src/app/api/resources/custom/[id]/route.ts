import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeJSON } from "@/lib/redis-storage";
import { parseCustomResource, type Resource } from "@/lib/resources";
import { CUSTOM_PATH, getCustomResources } from "../route";

/** Body: any of the Resource fields to change; the rest are kept. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id !== "gamelord") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const all = await getCustomResources();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch = await req.json().catch(() => null);
  const parsed = parseCustomResource({ ...all[idx], ...(patch ?? {}) });
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  all[idx] = { ...parsed.value, id } as Resource;
  await writeJSON(CUSTOM_PATH, all);
  return NextResponse.json(all[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id !== "gamelord") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const all = await getCustomResources();
  if (!all.some((r) => r.id === id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await writeJSON(CUSTOM_PATH, all.filter((r) => r.id !== id));
  return NextResponse.json({ ok: true });
}
