import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/redis-storage";
import { parseCustomResource, type Resource } from "@/lib/resources";

/**
 * Resources added after the build, shown in All Resources next to the ones in
 * src/lib/resources.ts. Everyone reads the list; only the gamelord changes it.
 */
export const CUSTOM_PATH = "resources/custom.json";

export async function getCustomResources(): Promise<Resource[]> {
  return readJSON<Resource[]>(CUSTOM_PATH, []);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getCustomResources());
}

/** Body: a Resource without its id — see parseCustomResource for the fields. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id !== "gamelord") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = parseCustomResource(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const resource: Resource = { id: `custom-${randomUUID().slice(0, 8)}`, ...parsed.value } as Resource;
  const all = await getCustomResources();
  all.push(resource);
  await writeJSON(CUSTOM_PATH, all);
  return NextResponse.json(resource, { status: 201 });
}
