import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Node.js imports (no fs, path, bcrypt, crypto).
// Used by the proxy (Edge Runtime) to verify JWTs without touching the user store.
export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: "admin" | "user" }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "admin" | "user";
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};
