"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import type { Location, Attachment } from "@/lib/vtt-types";

export default function LocationsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/locations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setLocations(data); setLoading(false); });
  }, []);

  const typeIcon: Record<string, string> = { map: "🗺", photograph: "📸", document: "📄", other: "📎" };
  const typeColor: Record<string, string> = { map: "var(--arcane)", photograph: "var(--brass)", document: "#5f8fc9", other: "var(--ink-text-2)" };

  return (
    <div style={page}>
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <Link href="/" style={{ color: "var(--ink-text-2)", fontSize: 13, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: "var(--ink-text-2)", fontSize: 13 }}>›</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>Locations</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/characters" className="btn btn-ghost btn-sm">Dossiers</Link>
          {isAdmin && <Link href="/admin/locations" className="btn btn-ghost btn-sm">Manage</Link>}
          <span style={{ fontSize: 13, color: "var(--ink-text-2)" }}>{session?.user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
        </div>
      </div>

      <div style={body}>
        <div style={hero}>
          <span style={eyebrow}>Echoes of Darkness</span>
          <h1 style={heroTitle}>Campaign Locations</h1>
          <p style={heroSub}>Sites, structures, and points of interest encountered during the investigation.</p>
        </div>

        {loading ? (
          <p style={{ color: "var(--ink-text-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>Loading…</p>
        ) : locations.length === 0 ? (
          <div style={emptyState}>
            <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>🏛</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 6 }}>No locations yet</div>
            <div style={{ fontSize: 13, color: "var(--ink-text-2)" }}>
              {isAdmin ? (
                <>The game master hasn't added any locations. <Link href="/admin/locations" style={{ color: "var(--brass)" }}>Add one now →</Link></>
              ) : (
                "The game master hasn't added any locations yet."
              )}
            </div>
          </div>
        ) : (
          <div style={grid}>
            {locations.map((loc) => {
              const open = expanded === loc.id;
              const images = loc.attachments.filter((a) => a.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i));
              const firstImage = images[0];
              return (
                <div key={loc.id} style={{ ...card, ...(open ? cardOpen : {}) }}
                  onClick={() => setExpanded(open ? null : loc.id)}>
                  {firstImage && (
                    <div style={cardThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={firstImage.url} alt={firstImage.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={cardContent}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={cardTitle}>{loc.name}</div>
                        <div style={cardDesc}>{loc.description || <em style={{ opacity: 0.5 }}>No description.</em>}</div>
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-text-2)", flexShrink: 0, marginTop: 4 }}>
                        {loc.attachments.length > 0 && `${loc.attachments.length} file${loc.attachments.length !== 1 ? "s" : ""}`}
                        <span style={{ marginLeft: 6 }}>{open ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {open && loc.attachments.length > 0 && (
                      <div style={attSection} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: "var(--ink-text-2)", marginBottom: 10 }}>Attachments</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {loc.attachments.map((att) => (
                            <AttachmentRow key={att.id} att={att} typeIcon={typeIcon} typeColor={typeColor} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentRow({ att, typeIcon, typeColor }: {
  att: Attachment;
  typeIcon: Record<string, string>;
  typeColor: Record<string, string>;
}) {
  const isImage = att.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <a href={att.url} target="_blank" rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-3)", borderRadius: "var(--r-md)", textDecoration: "none", color: "var(--parchment)" }}>
        <span style={{ fontSize: 14 }}>{typeIcon[att.type] ?? "📎"}</span>
        <span style={{ flex: 1, fontSize: 13 }}>{att.name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", color: typeColor[att.type] ?? "var(--ink-text-2)" }}>{att.type}</span>
      </a>
      {isImage && (
        <div style={{ borderRadius: "var(--r-md)", overflow: "hidden", maxHeight: 240 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={att.url} alt={att.name} style={{ width: "100%", objectFit: "cover", maxHeight: 240, display: "block" }} />
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: "var(--ink)", display: "flex", flexDirection: "column", overflow: "auto" };
const topbar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid var(--line)", background: "rgba(18,21,27,0.9)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10 };
const brandMark: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(155deg, var(--brass), var(--brass-dim))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--ink)" };
const body: React.CSSProperties = { padding: "40px 48px 80px", maxWidth: 1100, width: "100%", margin: "0 auto" };
const hero: React.CSSProperties = { marginBottom: 40 };
const eyebrow: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--arcane)", display: "block", marginBottom: 8 };
const heroTitle: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 600, margin: "0 0 8px" };
const heroSub: React.CSSProperties = { color: "var(--ink-text)", fontSize: 14, margin: 0 };
const emptyState: React.CSSProperties = { textAlign: "center", padding: "60px 0", color: "var(--parchment)" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", cursor: "pointer", transition: "border-color .15s, box-shadow .15s" };
const cardOpen: React.CSSProperties = { borderColor: "var(--brass-dim)", boxShadow: "0 0 0 1px var(--brass-dim)" };
const cardThumb: React.CSSProperties = { height: 140, overflow: "hidden" };
const cardContent: React.CSSProperties = { padding: "16px 18px" };
const cardTitle: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginBottom: 6 };
const cardDesc: React.CSSProperties = { fontSize: 13, color: "var(--ink-text-2)", lineHeight: 1.5 };
const attSection: React.CSSProperties = { marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" };
