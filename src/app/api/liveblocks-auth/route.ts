import { NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { auth } from "@/auth";
import { getHardcodedAssignments } from "@/lib/users";
import { CHARACTERS } from "@/lib/characters";

/**
 * Issues Liveblocks tokens for the walkthrough levels, where investigators
 * see each other's avatars (src/app/components/presence.ts). Access is limited
 * to the walkthrough rooms; the token carries who the user is playing so the
 * others can dress their avatar and label it.
 *
 * With no LIVEBLOCKS_SECRET_KEY this answers 403 — a terminal refusal — so the
 * client gives up at once and the levels simply run single-player.
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Live presence is not configured" }, { status: 403 });

  const userId = session.user.id;
  // The hardcoded binding wins, as it does for sheet editing.
  const slug = Object.entries(getHardcodedAssignments()).find(([, u]) => u === userId)?.[0];
  const character = CHARACTERS.find(c => c.slug === slug);

  const liveblocks = new Liveblocks({ secret });
  const lbSession = liveblocks.prepareSession(userId, {
    userInfo: { name: character?.name ?? session.user.name ?? userId, slug: slug ?? null },
  });
  lbSession.allow("hearthboard:walk:*", lbSession.FULL_ACCESS);
  const { status, body } = await lbSession.authorize();
  return new NextResponse(body, { status, headers: { "Content-Type": "application/json" } });
}

/** Whether live presence is set up, so a level can skip connecting when it is not. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: !!process.env.LIVEBLOCKS_SECRET_KEY });
}
