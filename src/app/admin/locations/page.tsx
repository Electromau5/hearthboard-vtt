"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { Location, Attachment, AttachmentType } from "@/lib/vtt-types";

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [attName, setAttName] = useState("");
  const [attType, setAttType] = useState<AttachmentType>("photograph");
  const fileRef = useRef<HTMLInputElement>(null);
  const [primaryImgLocId, setPrimaryImgLocId] = useState<string | null>(null);
  const [uploadingPrimary, setUploadingPrimary] = useState<string | null>(null);
  const primaryImgRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const load = async () => {
    const res = await fetch("/api/admin/locations");
    if (res.ok) setLocations(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addLocation = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc }),
    });
    if (res.ok) {
      const loc = await res.json();
      setLocations((prev) => [...prev, loc]);
      setNewName(""); setNewDesc(""); setAdding(false);
      notify("Location added.");
    }
  };

  const saveEdit = async (id: string) => {
    const res = await fetch(`/api/admin/locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLocations((prev) => prev.map((l) => l.id === id ? updated : l));
      setEditingId(null);
      notify("Saved.");
    }
  };

  const deleteLocation = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its attachments?`)) return;
    const res = await fetch(`/api/admin/locations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLocations((prev) => prev.filter((l) => l.id !== id));
      notify("Deleted.");
    }
  };

  const uploadAttachment = async (locId: string) => {
    const file = fileRef.current?.files?.[0];
    if (!file) { notify("Select a file first."); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("name", attName.trim() || file.name);
    form.append("type", attType);
    const res = await fetch(`/api/admin/locations/${locId}/attachments`, { method: "POST", body: form });
    if (res.ok) {
      const att = await res.json();
      setLocations((prev) => prev.map((l) => l.id === locId ? { ...l, attachments: [...l.attachments, att] } : l));
      setUploadingId(null);
      setAttName(""); setAttType("photograph");
      if (fileRef.current) fileRef.current.value = "";
      notify("Attachment uploaded.");
    } else {
      notify("Upload failed.");
    }
  };

  const uploadPrimaryImage = async (locId: string) => {
    const file = primaryImgRef.current?.files?.[0];
    if (!file) { notify("Select an image file first."); return; }
    setUploadingPrimary(locId);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", "Primary Image");
      form.append("type", "photograph");
      const uploadRes = await fetch(`/api/admin/locations/${locId}/attachments`, { method: "POST", body: form });
      if (!uploadRes.ok) { notify("Upload failed."); return; }
      const att = await uploadRes.json();
      const patchRes = await fetch(`/api/admin/locations/${locId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryImage: att.url }),
      });
      if (!patchRes.ok) { notify("Failed to set primary image."); return; }
      const updated = await patchRes.json();
      setLocations((prev) => prev.map((l) => l.id === locId
        ? { ...l, primaryImage: updated.primaryImage, attachments: [...l.attachments, att] }
        : l));
      setPrimaryImgLocId(null);
      if (primaryImgRef.current) primaryImgRef.current.value = "";
      notify("Primary image updated.");
    } finally {
      setUploadingPrimary(null);
    }
  };

  const removeAttachment = async (locId: string, attId: string) => {
    const res = await fetch(`/api/admin/locations/${locId}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId: attId }),
    });
    if (res.ok) {
      setLocations((prev) => prev.map((l) => l.id === locId
        ? { ...l, attachments: l.attachments.filter((a) => a.id !== attId) }
        : l));
      notify("Attachment removed.");
    }
  };

  const startEdit = (loc: Location) => {
    setEditingId(loc.id);
    setEditName(loc.name);
    setEditDesc(loc.description);
  };

  return (
    <div style={page}>
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>Admin — Locations</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/characters" className="btn btn-ghost btn-sm">Characters</Link>
          <Link href="/admin/assets" className="btn btn-ghost btn-sm">Assets</Link>
          <Link href="/admin/users" className="btn btn-ghost btn-sm">Users</Link>
          <Link href="/" className="btn btn-ghost btn-sm">← App</Link>
        </div>
      </div>

      <div style={body}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={sectionLabel}>Campaign Locations</div>
            <p style={{ color: "var(--ink-text-2)", fontSize: 13, margin: 0 }}>
              Locations are visible to all players at <Link href="/locations" style={{ color: "var(--brass)" }}>/locations</Link>.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "+ Add Location"}
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <div style={card}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "var(--brass)", marginBottom: 12 }}>New Location</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Name">
                <input style={input} placeholder="e.g. Harrington Estate" value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLocation()} autoFocus />
              </Field>
              <Field label="Description">
                <textarea style={{ ...input, minHeight: 80, resize: "vertical" }} placeholder="Brief description visible to players…" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setNewName(""); setNewDesc(""); }}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={addLocation}>Create</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--ink-text-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>Loading…</p>
        ) : locations.length === 0 ? (
          <div style={emptyState}>No locations yet. Add one above.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {locations.map((loc) => (
              <div key={loc.id} style={card}>
                {editingId === loc.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Field label="Name">
                      <input style={input} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </Field>
                    <Field label="Description">
                      <textarea style={{ ...input, minHeight: 80, resize: "vertical" }} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                    </Field>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(loc.id)}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{loc.name}</div>
                        <div style={{ color: "var(--ink-text-2)", fontSize: 13, lineHeight: 1.5 }}>{loc.description || <em>No description.</em>}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(loc)}>Edit</button>
                        <button className="btn btn-ghost btn-sm btn-danger" onClick={() => deleteLocation(loc.id, loc.name)}>Delete</button>
                      </div>
                    </div>

                    {/* Primary Image */}
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={sectionLabel}>Primary Image</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPrimaryImgLocId(primaryImgLocId === loc.id ? null : loc.id)}>
                          {primaryImgLocId === loc.id ? "Cancel" : "Change Image"}
                        </button>
                      </div>
                      {loc.primaryImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={loc.primaryImage} alt={loc.name} style={{ width: "100%", maxWidth: 320, height: 160, objectFit: "cover", borderRadius: "var(--r-md)", border: "1px solid var(--line)", display: "block" }} />
                      ) : (
                        <div style={{ color: "var(--ink-text-2)", fontSize: 12, fontStyle: "italic" }}>No primary image set.</div>
                      )}
                      {primaryImgLocId === loc.id && (
                        <div style={{ marginTop: 10, background: "var(--surface-3)", borderRadius: "var(--r-md)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                          <Field label="Image File">
                            <input ref={primaryImgRef} type="file" accept="image/*" style={{ ...input, padding: "6px 10px" }} />
                          </Field>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => uploadPrimaryImage(loc.id)}
                              disabled={uploadingPrimary === loc.id}
                            >
                              {uploadingPrimary === loc.id ? "Uploading…" : "Set as Primary Image"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Attachments */}
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={sectionLabel}>Attachments ({loc.attachments.length})</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setUploadingId(uploadingId === loc.id ? null : loc.id)}>
                          {uploadingId === loc.id ? "Cancel Upload" : "+ Upload"}
                        </button>
                      </div>

                      {uploadingId === loc.id && (
                        <div style={{ background: "var(--surface-3)", borderRadius: "var(--r-md)", padding: "14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                            <Field label="Display Name (optional)">
                              <input style={input} placeholder="Leave blank to use filename" value={attName} onChange={(e) => setAttName(e.target.value)} />
                            </Field>
                            <Field label="Type">
                              <select style={input} value={attType} onChange={(e) => setAttType(e.target.value as AttachmentType)}>
                                <option value="map">Map</option>
                                <option value="photograph">Photograph</option>
                                <option value="document">Document</option>
                                <option value="other">Other</option>
                              </select>
                            </Field>
                          </div>
                          <Field label="File">
                            <input ref={fileRef} type="file" style={{ ...input, padding: "6px 10px" }} accept="image/*,.pdf,.txt,.doc,.docx" />
                          </Field>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button className="btn btn-primary btn-sm" onClick={() => uploadAttachment(loc.id)}>Upload</button>
                          </div>
                        </div>
                      )}

                      {loc.attachments.length === 0 ? (
                        <div style={{ color: "var(--ink-text-2)", fontSize: 12, fontStyle: "italic" }}>No attachments yet.</div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {loc.attachments.map((att) => (
                            <AttachmentChip key={att.id} att={att} onRemove={() => removeAttachment(loc.id, att.id)} />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

function AttachmentChip({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const typeColors: Record<string, string> = {
    map: "var(--arcane)",
    photograph: "var(--brass)",
    document: "#5f8fc9",
    other: "var(--ink-text-2)",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-3)", borderRadius: "var(--r-md)", padding: "6px 10px", fontSize: 12 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", color: typeColors[att.type] ?? "var(--ink-text-2)", marginRight: 2 }}>{att.type}</span>
      <a href={att.url} target="_blank" rel="noreferrer" style={{ color: "var(--parchment)", textDecoration: "none" }}>{att.name}</a>
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "var(--blood)", cursor: "pointer", padding: "0 0 0 4px", fontSize: 12, lineHeight: 1 }}>✕</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--ink-text-2)" }}>{label}</label>
      {children}
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: "var(--ink)", display: "flex", flexDirection: "column", overflow: "auto" };
const topbar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid var(--line)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 };
const brandMark: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(155deg, var(--brass), var(--brass-dim))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--ink)" };
const body: React.CSSProperties = { padding: "40px", maxWidth: 900, width: "100%", margin: "0 auto" };
const sectionLabel: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--ink-text-2)" };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: "20px 24px" };
const emptyState: React.CSSProperties = { color: "var(--ink-text-2)", fontSize: 14, textAlign: "center", padding: "40px 0", fontStyle: "italic" };
const input: React.CSSProperties = { background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", color: "var(--parchment)", padding: "8px 10px", fontSize: 13, width: "100%", fontFamily: "inherit" };
const toastStyle: React.CSSProperties = { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--surface-3)", border: "1px solid var(--brass-dim)", color: "var(--parchment)", padding: "10px 20px", borderRadius: "var(--r-md)", fontSize: 13, fontFamily: "var(--font-mono)", zIndex: 50 };
