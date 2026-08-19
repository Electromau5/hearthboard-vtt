import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  // Admin-only routes
  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Protect every route except NextAuth internals, static assets, and the
  // public /login and /register pages.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|login|register).*)"],
};
