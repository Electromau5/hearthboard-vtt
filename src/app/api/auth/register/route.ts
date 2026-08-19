import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/users";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const user = await createUser(email, password, name);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
