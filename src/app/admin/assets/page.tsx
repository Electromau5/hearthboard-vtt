"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { Asset } from "@/lib/vtt-types";

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [assetName, setAssetName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const load = async () => {
    const res = await fetch("/api/admin/assets");
    if (res.ok) setAssets(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      if (assetName.trim()) form.append("name", assetName.trim());
      const res = await fetch("/api/admin/assets", { method: "POST", body: form });
      if (res.ok) {
        const asset = await res.json();
        setAssets((prev) => [asset, ...prev]);
      }
    }
    setUploading(false);
    setAssetName("");
    if (fileRef.current) fileRef.current.value = "";
    notify("Upload complete.");
  };

  const deleteAsset = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    const res = await fetch(`/api/admin/assets/${asset.id}`, { method: "DELETE" });
    if (res.ok) {
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      notify("Deleted.");
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    notify("URL copied.");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={page}>
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={brandMark}>H</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>Admin — Assets</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/characters" className="btn btn-ghost btn-sm">Characters</Link>
          <Link href="/admin/locations" className="btn btn-ghost btn-sm">Locations</Link>
          <Link href="/admin/users" className="btn btn-ghost btn-sm">Users</Link>
          <Link href="/" className="btn btn-ghost btn-sm">← App</Link>
        </div>
      </div>

      <div style={body}>
        <div style={{ marginBottom: 28 }}>
          <div style={sectionLabel}>Asset Library</div>
          <p style={{ color: "var(--ink-text-2)", fontSize: 13, margin: "4px 0 0" }}>
            Upload images, documents, and other files. Use the URL to embed in location descriptions or share with players.
          </p>
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          style={dropZone}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => { if (dropRef.current) dropRef.current.style.borderColor = "var(--brass)"; }}
          onDragLeave={() => { if (dropRef.current) dropRef.current.style.borderColor = "var(--line)"; }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>📁</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-text-2)", marginBottom: 14 }}>
              {uploading ? "Uploading…" : "Drag & drop files here, or choose below"}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={fileRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => uploadFiles(e.target.files)}
              />
              <input
                style={{ ...input, maxWidth: 200 }}
                placeholder="Custom name (optional)"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Choose Files"}
              </button>
            </div>
          </div>
        </div>

        {/* Asset grid */}
        {loading ? (
          <p style={{ color: "var(--ink-text-2)", fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 24 }}>Loading…</p>
        ) : assets.length === 0 ? (
          <div style={emptyState}>No assets uploaded yet.</div>
        ) : (
          <>
            <div style={{ ...sectionLabel, marginBottom: 14 }}>{assets.length} file{assets.length !== 1 ? "s" : ""}</div>
            <div style={grid}>
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onDelete={() => deleteAsset(asset)} onCopy={() => copyUrl(asset.url)} formatSize={formatSize} formatDate={formatDate} />
              ))}
            </div>
          </>
        )}
      </div>

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

function AssetCard({ asset, onDelete, onCopy, formatSize, formatDate }: {
  asset: Asset;
  onDelete: () => void;
  onCopy: () => void;
  formatSize: (b: number) => string;
  formatDate: (s: string) => string;
}) {
  const isImage = asset.type === "image";
  const typeColor: Record<string, string> = { image: "var(--arcane)", document: "#5f8fc9", other: "var(--ink-text-2)" };

  return (
    <div style={cardStyle}>
      {isImage ? (
        <div style={thumb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <div style={{ ...thumb, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 28 }}>{asset.type === "document" ? "📄" : "📎"}</span>
        </div>
      )}
      <div style={cardBody}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, wordBreak: "break-word" }}>{asset.name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: typeColor[asset.type] ?? "var(--ink-text-2)", textTransform: "uppercase", marginBottom: 4 }}>{asset.type}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-text-2)" }}>
          {formatSize(asset.size)} · {formatDate(asset.uploadedAt)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <a href={asset.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Open</a>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onCopy}>Copy URL</button>
          <button className="btn btn-ghost btn-sm btn-danger" style={{ fontSize: 11 }} onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: "var(--ink)", display: "flex", flexDirection: "column", overflow: "auto" };
const topbar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid var(--line)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 };
const brandMark: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(155deg, var(--brass), var(--brass-dim))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--ink)" };
const body: React.CSSProperties = { padding: "40px", maxWidth: 1000, width: "100%", margin: "0 auto" };
const sectionLabel: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--ink-text-2)" };
const dropZone: React.CSSProperties = { border: "2px dashed var(--line)", borderRadius: "var(--r-lg)", padding: "36px 24px", marginBottom: 32, cursor: "pointer", transition: "border-color .2s" };
const input: React.CSSProperties = { background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", color: "var(--parchment)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit" };
const emptyState: React.CSSProperties = { color: "var(--ink-text-2)", fontSize: 14, textAlign: "center", padding: "40px 0", fontStyle: "italic" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 };
const cardStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" };
const thumb: React.CSSProperties = { height: 120, overflow: "hidden" };
const cardBody: React.CSSProperties = { padding: "12px 14px" };
const toastStyle: React.CSSProperties = { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--surface-3)", border: "1px solid var(--brass-dim)", color: "var(--parchment)", padding: "10px 20px", borderRadius: "var(--r-md)", fontSize: 13, fontFamily: "var(--font-mono)", zIndex: 50 };
