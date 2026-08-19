"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface UserRow {
  id: string;
  username: string;
  role: "admin" | "user";
  protected: boolean;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers((await res.json()).users);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const toggleRole = async (user: UserRow) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, role: newRole }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
      notify(`${user.username} is now ${newRole === "admin" ? "an Admin" : "a Player"}.`);
    } else {
      const data = await res.json();
      notify(data.error ?? "Failed.");
    }
  };

  return (
    <div style={page}>
      {/* Topbar */}
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
            Admin — Users
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/characters" className="btn btn-ghost btn-sm">Characters</Link>
          <Link href="/admin/locations" className="btn btn-ghost btn-sm">Locations</Link>
          <Link href="/admin/assets" className="btn btn-ghost btn-sm">Assets</Link>
          <Link href="/" className="btn btn-ghost btn-sm">← App</Link>
        </div>
      </div>

      <div style={body}>
        <div style={sectionHeader}>
          <span style={sectionTitle}>All accounts</span>
          <span style={sectionCount}>{users.length} total</span>
        </div>

        {loading ? (
          <p style={{ color: "var(--ink-text-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>Loading…</p>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  {["Username", "Role", "Actions"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === session?.user?.id;
                  const locked = user.protected || isSelf;
                  return (
                    <tr key={user.id} style={tr}>
                      <td style={td}>
                        <span style={{ fontWeight: 600 }}>{user.username}</span>
                        {isSelf && <span style={selfBadge}>you</span>}
                        {user.protected && <span style={lockedBadge}>fixed</span>}
                      </td>
                      <td style={td}>
                        <span style={user.role === "admin" ? adminBadge : playerBadge}>
                          {user.role === "admin" ? "Admin" : "Player"}
                        </span>
                      </td>
                      <td style={{ ...td, display: "flex", gap: 8 }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => toggleRole(user)}
                          disabled={locked}
                          title={
                            user.protected
                              ? "This account's role cannot be changed"
                              : isSelf
                              ? "Cannot change your own role"
                              : undefined
                          }
                          style={locked ? { opacity: 0.4 } : {}}
                        >
                          {user.role === "admin" ? "Make Player" : "Make Admin"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div style={toastStyle} className="toast show">{toast}</div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--ink)",
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
};
const topbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 40px",
  borderBottom: "1px solid var(--line)",
  background: "var(--surface)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};
const brandMark: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: "linear-gradient(155deg, var(--brass), var(--brass-dim))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 16,
  color: "var(--ink)",
};
const body: React.CSSProperties = {
  padding: "40px",
  maxWidth: 700,
  width: "100%",
  margin: "0 auto",
};
const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 12,
  marginBottom: 20,
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: "var(--ink-text-2)",
};
const sectionCount: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--brass)",
};
const tableWrap: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  overflow: "hidden",
};
const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.8px",
  textTransform: "uppercase",
  color: "var(--ink-text-2)",
  background: "var(--surface-2)",
  borderBottom: "1px solid var(--line)",
};
const tr: React.CSSProperties = {
  borderBottom: "1px solid var(--line)",
};
const td: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 14,
  verticalAlign: "middle",
};
const adminBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  padding: "3px 8px",
  borderRadius: 20,
  border: "1px solid var(--brass-dim)",
  color: "var(--brass)",
  background: "rgba(201,148,79,0.1)",
};
const playerBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  padding: "3px 8px",
  borderRadius: 20,
  border: "1px solid var(--line)",
  color: "var(--ink-text-2)",
};
const selfBadge: React.CSSProperties = {
  marginLeft: 8,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 20,
  border: "1px solid var(--arcane-dim)",
  color: "var(--arcane)",
};
const lockedBadge: React.CSSProperties = {
  marginLeft: 8,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 20,
  border: "1px solid var(--line)",
  color: "var(--ink-text-2)",
};
const toastStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 22,
  left: "50%",
  transform: "translateX(-50%)",
};
