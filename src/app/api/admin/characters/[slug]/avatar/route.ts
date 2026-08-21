import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCharacter } from "@/lib/characters";
import type { Character } from "@/lib/characters";
import { readJSON, writeJSON, uploadFile } from "@/lib/blob-storage";
import { put, del } from "@vercel/blob";
import { getAssignments } from "@/app/api/characters/assignments/route";

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV !== "development";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const base = getCharacter(slug);
  if (!base) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  const isAssignedInToken = session.user.assignedSlug === slug;
  const isAssignedPlayer = isAssignedInToken || (await getAssignments())[slug] === session.user.id;

  if (!isAdmin && !isAssignedPlayer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("avatar") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const contentType = file.type || "image/jpeg";
  const rawExt = (contentType.split("/")[1] || "jpg").split("+")[0];
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;

  const blobPath = `characters/${slug}.json`;
  const existing = await readJSON<Partial<Character>>(blobPath, {});

  let avatarUrl: string;

  if (useBlob) {
    // Delete previous avatar blob to avoid orphaned blobs
    const oldUrl = existing.avatar;
    if (oldUrl && oldUrl.startsWith("https://")) {
      try { await del(oldUrl); } catch {}
    }
    const blob = await put(`avatars/${slug}.${ext}`, file, {
      access: "private",
      contentType,
      addRandomSuffix: true,
    });
    avatarUrl = blob.url; // permanent URL (not expiring downloadUrl)
  } else {
    // Dev: save locally via uploadFile, returns /api/dev-assets/... URL
    avatarUrl = await uploadFile(`avatars/${slug}.${ext}`, file, contentType);
  }

  await writeJSON(blobPath, { ...existing, avatar: avatarUrl });

  return NextResponse.json({ avatar: `/api/characters/${slug}/avatar` });
}
