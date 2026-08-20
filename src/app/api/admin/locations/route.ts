import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/blob-storage";
import type { Location } from "@/lib/vtt-types";
import { CAMPAIGN_LOCATIONS } from "@/lib/campaign-defaults";
import { randomUUID } from "crypto";

const BLOB_PATH = "locations/index.json";

export async function getStoredLocations(): Promise<Location[]> {
  return readJSON<Location[]>(BLOB_PATH, []);
}

// Campaign defaults always present; stored customisations (primaryImage etc.) are overlaid.
function mergeWithDefaults(stored: Location[]): Location[] {
  const storedMap = new Map(stored.map((l) => [l.id, l]));
  const campaignLocs = CAMPAIGN_LOCATIONS.map((def) => ({
    ...def,
    ...(storedMap.get(def.id) ?? {}),
    attachments: storedMap.get(def.id)?.attachments ?? def.attachments,
  }));
  const extras = stored.filter((l) => !CAMPAIGN_LOCATIONS.some((d) => d.id === l.id));
  return [...campaignLocs, ...extras];
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stored = await getStoredLocations();
  return NextResponse.json(mergeWithDefaults(stored));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const stored = await getStoredLocations();
  const newLoc: Location = {
    id: randomUUID(),
    name: name.trim(),
    description: description?.trim() ?? "",
    attachments: [],
  };
  stored.push(newLoc);
  await writeJSON(BLOB_PATH, stored);
  return NextResponse.json(newLoc, { status: 201 });
}
