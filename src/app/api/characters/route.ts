import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CHARACTERS } from "@/lib/characters";
import { readCharacterOverrides } from "@/lib/character-storage";
import { mergeCharacterForClient } from "@/lib/character-merge";

/**
 * GET /api/characters — every investigator with stored overrides applied.
 *
 * The dossier grid, the admin list and the VTT board all read from here so a
 * rename made on a character sheet propagates to every view.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json([], { status: 401 });

  const merged = await Promise.all(
    CHARACTERS.map(async (base) =>
      mergeCharacterForClient(base, await readCharacterOverrides(base.slug))
    )
  );
  return NextResponse.json(merged);
}
