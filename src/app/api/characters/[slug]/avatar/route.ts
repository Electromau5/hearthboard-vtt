import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCharacter } from "@/lib/characters";
import { readCharacterOverrides } from "@/lib/character-storage";
import { get } from "@vercel/blob";

const EXT_TO_CT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", gif: "image/gif",
  webp: "image/webp", avif: "image/avif",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse(null, { status: 401 });

  const { slug } = await params;
  if (!getCharacter(slug)) return new NextResponse(null, { status: 404 });

  const overrides = await readCharacterOverrides(slug);
  const storedAvatar = overrides.avatar;
  if (!storedAvatar) return new NextResponse(null, { status: 404 });

  // Dev mode: storedAvatar is a local URL (/api/dev-assets/...) — redirect to it
  if (!process.env.BLOB_READ_WRITE_TOKEN || process.env.NODE_ENV === "development") {
    return NextResponse.redirect(new URL(storedAvatar, req.url));
  }

  // Production: fetch from private blob store using SDK
  try {
    const result = await get(storedAvatar, { access: "private", useCache: false });
    if (!result || !result.stream) return new NextResponse(null, { status: 404 });

    const ext = storedAvatar.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
    const ct = EXT_TO_CT[ext] ?? "image/jpeg";

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
