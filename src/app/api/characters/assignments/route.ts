import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readJSON, writeJSON } from "@/lib/blob-storage";
import { getCharacter } from "@/lib/characters";

export type Assignments = Record<string, string>; // slug → userId

const BLOB_PATH = "assignments.json";

export async function getAssignments(): Promise<Assignments> {
  return readJSON<Assignments>(BLOB_PATH, {});
}

// GET — any authenticated user can see assignments
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getAssignments());
}

// POST — authenticated user claims a character for themselves
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { slug } = body as { slug?: string };
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
    if (!getCharacter(slug)) return NextResponse.json({ error: "Character not found" }, { status: 404 });

    const assignments = await getAssignments();

    if (assignments[slug]) {
      return NextResponse.json({ error: "This character has already been claimed." }, { status: 409 });
    }

    const userId = session.user.id;
    const alreadyOwns = Object.values(assignments).includes(userId);
    if (alreadyOwns) {
      return NextResponse.json(
        { error: "You have already chosen a character for this campaign." },
        { status: 409 }
      );
    }

    assignments[slug] = userId;
    await writeJSON(BLOB_PATH, assignments);
    return NextResponse.json({ ok: true, slug, userId });
  } catch (err) {
    console.error("[assignments POST]", err);
    return NextResponse.json({ error: "Internal server error. Please try again." }, { status: 500 });
  }
}

// DELETE — admin unassigns a character
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const assignments = await getAssignments();
  delete assignments[slug];
  await writeJSON(BLOB_PATH, assignments);
  return NextResponse.json({ ok: true });
}
