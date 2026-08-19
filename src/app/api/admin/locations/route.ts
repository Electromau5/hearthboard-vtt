import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/blob-storage";
import type { Location } from "@/lib/vtt-types";
import { randomUUID } from "crypto";

const BLOB_PATH = "locations/index.json";

async function getLocations(): Promise<Location[]> {
  return readJSON<Location[]>(BLOB_PATH, []);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getLocations());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const locations = await getLocations();
  const newLoc: Location = {
    id: randomUUID(),
    name: name.trim(),
    description: description?.trim() ?? "",
    attachments: [],
  };
  locations.push(newLoc);
  await writeJSON(BLOB_PATH, locations);
  return NextResponse.json(newLoc, { status: 201 });
}
