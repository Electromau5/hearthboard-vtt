import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCharacter } from "@/lib/characters";
import type { Character } from "@/lib/characters";
import { readJSON, writeJSON } from "@/lib/blob-storage";
import { getAssignments } from "@/app/api/characters/assignments/route";

function blobPath(slug: string) {
  return `characters/${slug}.json`;
}

function mergeCharacter(base: Character, overrides: Partial<Character>): Character {
  return {
    ...base,
    ...overrides,
    vitals: { ...base.vitals, ...(overrides.vitals || {}) },
    characteristics: { ...base.characteristics, ...(overrides.characteristics || {}) },
    skills: overrides.skills ?? base.skills,
    abilities: overrides.abilities ?? base.abilities,
    hooks: overrides.hooks ?? base.hooks,
    equipment: overrides.equipment ?? base.equipment,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const base = getCharacter(slug);
  if (!base) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const overrides = await readJSON<Partial<Character>>(blobPath(slug), {});
  const merged = mergeCharacter(base, overrides);
  return NextResponse.json(merged);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const base = getCharacter(slug);

  const isAdmin = session.user.role === "admin";
  const assignments = await getAssignments();
  const isAssignedPlayer = assignments[slug] === session.user.id;

  if (!isAdmin && !isAssignedPlayer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!base) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as Partial<Character>;

  // Merge with existing overrides before saving so partial updates compose
  const existing = await readJSON<Partial<Character>>(blobPath(slug), {});
  const merged: Partial<Character> = {
    ...existing,
    ...body,
    ...(existing.vitals || body.vitals ? {
      vitals: { ...(existing.vitals ?? {}), ...(body.vitals ?? {}) } as Character["vitals"],
    } : {}),
    ...(existing.characteristics || body.characteristics ? {
      characteristics: { ...(existing.characteristics ?? {}), ...(body.characteristics ?? {}) } as Character["characteristics"],
    } : {}),
  };
  if (body.skills !== undefined) merged.skills = body.skills;
  if (body.abilities !== undefined) merged.abilities = body.abilities;
  if (body.hooks !== undefined) merged.hooks = body.hooks;
  if (body.equipment !== undefined) merged.equipment = body.equipment;

  await writeJSON(blobPath(slug), merged);
  return NextResponse.json(mergeCharacter(base, merged));
}
