import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { getAllUsers, setRole } from "@/lib/users";

function adminOnly(session: Session | null) {
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const denied = adminOnly(session);
  if (denied) return denied;
  return NextResponse.json({ users: getAllUsers() });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const denied = adminOnly(session);
  if (denied) return denied;

  const { id, role } = await req.json();
  if (!id || !["admin", "user"].includes(role)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  if (id === session!.user.id && role === "user") {
    return NextResponse.json(
      { error: "You cannot remove your own admin privileges." },
      { status: 400 }
    );
  }
  setRole(id, role);
  return NextResponse.json({ ok: true });
}
