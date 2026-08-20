import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Node.js imports (no fs, path, bcrypt, crypto).
// Used by the proxy (Edge Runtime) to verify JWTs without touching the user store.
export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: "admin" | "user" }).role;
        token.username = (user as { username: string }).username;
      }
      // Allow client update() to write assignedSlug into the token
      if (trigger === "update" && (session as { assignedSlug?: string })?.assignedSlug !== undefined) {
        token.assignedSlug = (session as { assignedSlug?: string }).assignedSlug;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "admin" | "user";
      session.user.username = token.username as string;
      session.user.name = token.username as string;
      if (token.assignedSlug) session.user.assignedSlug = token.assignedSlug;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};
