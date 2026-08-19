"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Registration failed.");
      setLoading(false);
      return;
    }

    // Auto sign-in after registration.
    await signIn("credentials", { email, password, redirect: false });
    router.push("/");
    router.refresh();
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

        <h2 style={styles.heading}>Join the table</h2>
        <p style={styles.sub}>Create your player account.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="field">
            <label htmlFor="name">Display name</label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fenwick Ashgrove"
            />
          </div>
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
            <label htmlFor="password">Password <span style={{ color: "var(--ink-text-2)", fontWeight: 400 }}>(min 8 characters)</span></label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--brass)" }}>
            Sign in
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
