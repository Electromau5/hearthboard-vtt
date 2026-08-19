"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.brandMark}>H</div>
          <div style={styles.brandName}>
            Hearth<em style={{ fontStyle: "normal", color: "var(--brass)" }}>board</em>
          </div>
        </div>

        <h2 style={styles.heading}>Welcome back</h2>
        <p style={styles.sub}>Sign in to your table.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={styles.footer}>
          New player?{" "}
          <Link href="/register" style={{ color: "var(--brass)" }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at 20% 20%, rgba(201,148,79,0.08), transparent 50%), var(--ink)",
    padding: 16,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    padding: "36px 32px 28px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 30px 70px -20px rgba(0,0,0,0.6)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "linear-gradient(155deg, var(--brass), var(--brass-dim))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 17,
    color: "var(--ink)",
  },
  brandName: {
    fontFamily: "var(--font-display)",
    fontSize: 20,
    fontWeight: 600,
  },
  heading: {
    fontFamily: "var(--font-display)",
    fontSize: 24,
    fontWeight: 600,
    margin: "0 0 4px",
  },
  sub: {
    color: "var(--ink-text-2)",
    fontSize: 14,
    margin: "0 0 24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  error: {
    color: "var(--blood)",
    fontSize: 13,
    margin: "0 0 10px",
    fontFamily: "var(--font-mono)",
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 13,
    color: "var(--ink-text-2)",
  },
};
