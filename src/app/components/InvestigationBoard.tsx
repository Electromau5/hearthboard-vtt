'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────
interface BoardItem {
  id: string;
  type: 'note' | 'image';
  x: number;
  y: number;
  rotation: number;
  text?: string;
  imageUrl?: string;
  caption?: string;
  color: string;
  author: string;
}
interface BoardConnection { id: string; fromId: string; toId: string; color: string; }
interface BoardStroke { id: string; path: string; color: string; width: number; }
interface BoardState { items: BoardItem[]; connections: BoardConnection[]; strokes: BoardStroke[]; }

const EMPTY: BoardState = { items: [], connections: [], strokes: [] };

type Tool = 'select' | 'note' | 'image' | 'connect' | 'draw';

const NOTE_COLORS = ['#f5f0e0', '#fef3c7', '#fce7e7', '#dbeafe', '#d1fae5'];
const DRAW_COLORS = ['#e63946', '#f4d03f', '#ffffff', '#5dade2', '#52be80'];
const STRING_COLORS = ['#e63946', '#f4d03f', '#f0ece0'];

// ── Component ─────────────────────────────────────────────────────────
export function InvestigationBoard({ username }: { username: string }) {
  const [board, setBoard] = useState<BoardState>(EMPTY);
  const [tool, setTool] = useState<Tool>('select');
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [stringColor, setStringColor] = useState('#e63946');
  const [drawColor, setDrawColor] = useState('#e63946');
  const [noteColor, setNoteColor] = useState('#f5f0e0');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'text' | 'caption' | null>(null);
  const [editingText, setEditingText] = useState('');
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [imageModal, setImageModal] = useState<{ x: number; y: number } | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const dragPosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const livePathRef = useRef<SVGPathElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef('');
  const drawColorRef = useRef('#e63946');

  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { drawColorRef.current = drawColor; }, [drawColor]);

  // ── Polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = () =>
      fetch('/api/board', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then((state: BoardState | null) => {
          if (state && !editingIdRef.current) setBoard(state);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, []);

  // ── Global drag handlers ──────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragRef.current.offsetX;
      const y = e.clientY - rect.top - dragRef.current.offsetY;
      dragPosRef.current = { id: dragRef.current.id, x, y };
      setDragPos({ id: dragRef.current.id, x, y });
    };
    const onUp = () => {
      if (!dragRef.current) return;
      const { id } = dragRef.current;
      const pos = dragPosRef.current;
      if (pos) {
        setBoard(prev => ({
          ...prev,
          items: prev.items.map(i => i.id === id ? { ...i, x: pos.x, y: pos.y } : i),
        }));
        fetch('/api/board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'update-item', id, changes: { x: pos.x, y: pos.y } }),
        }).catch(() => {});
      }
      dragRef.current = null;
      dragPosRef.current = null;
      setDragPos(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ── Fire-and-forget server op ─────────────────────────────────────────
  const serverOp = useCallback((op: object) => {
    fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(op),
    }).catch(() => {});
  }, []);

  // ── Item actions ──────────────────────────────────────────────────────
  const addNote = useCallback((x: number, y: number) => {
    const item: BoardItem = {
      id: 'bi' + Date.now(),
      type: 'note',
      x: x - 80, y: y - 45,
      rotation: (Math.random() - 0.5) * 7,
      color: noteColor,
      text: '',
      author: username,
    };
    setBoard(prev => ({ ...prev, items: [...prev.items, item] }));
    setEditingId(item.id);
    setEditingField('text');
    setEditingText('');
    serverOp({ op: 'add-item', item });
  }, [noteColor, username, serverOp]);

  const addImage = useCallback((x: number, y: number, url: string) => {
    const item: BoardItem = {
      id: 'bi' + Date.now(),
      type: 'image',
      x: x - 90, y: y - 70,
      rotation: (Math.random() - 0.5) * 5,
      color: '#e8e0d0',
      imageUrl: url,
      caption: '',
      author: username,
    };
    setBoard(prev => ({ ...prev, items: [...prev.items, item] }));
    serverOp({ op: 'add-item', item });
  }, [username, serverOp]);

  const deleteItem = useCallback((id: string) => {
    setBoard(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id),
      connections: prev.connections.filter(c => c.fromId !== id && c.toId !== id),
    }));
    serverOp({ op: 'delete-item', id });
  }, [serverOp]);

  const saveEdit = useCallback((id: string, field: 'text' | 'caption', value: string) => {
    setBoard(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, [field]: value } : i),
    }));
    setEditingId(null);
    setEditingField(null);
    serverOp({ op: 'update-item', id, changes: { [field]: value } });
  }, [serverOp]);

  const startEdit = useCallback((id: string, field: 'text' | 'caption', value: string) => {
    setEditingId(id);
    setEditingField(field);
    setEditingText(value);
  }, []);

  const handleItemConnect = useCallback((itemId: string) => {
    if (!connectingFrom) {
      setConnectingFrom(itemId);
      return;
    }
    if (connectingFrom === itemId) {
      setConnectingFrom(null);
      return;
    }
    const conn: BoardConnection = {
      id: 'bc' + Date.now(),
      fromId: connectingFrom,
      toId: itemId,
      color: stringColor,
    };
    setBoard(prev => ({ ...prev, connections: [...prev.connections, conn] }));
    setConnectingFrom(null);
    serverOp({ op: 'add-connection', connection: conn });
  }, [connectingFrom, stringColor, serverOp]);

  const deleteConnection = useCallback((id: string) => {
    setBoard(prev => ({ ...prev, connections: prev.connections.filter(c => c.id !== id) }));
    serverOp({ op: 'delete-connection', id });
  }, [serverOp]);

  // ── Drag start ────────────────────────────────────────────────────────
  const startDrag = useCallback((e: React.MouseEvent, item: BoardItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const liveX = (dragPos?.id === item.id ? dragPos.x : item.x);
    const liveY = (dragPos?.id === item.id ? dragPos.y : item.y);
    dragRef.current = {
      id: item.id,
      offsetX: e.clientX - rect.left - liveX,
      offsetY: e.clientY - rect.top - liveY,
    };
  }, [dragPos]);

  // ── Drawing ───────────────────────────────────────────────────────────
  const handleDrawStart = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const svgEl = e.currentTarget.closest('svg') as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const x = (e.clientX - rect.left).toFixed(1);
    const y = (e.clientY - rect.top).toFixed(1);
    currentPathRef.current = `M ${x} ${y}`;
    livePathRef.current?.setAttribute('d', currentPathRef.current);
    livePathRef.current?.setAttribute('stroke', drawColorRef.current);
  }, []);

  const handleDrawMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!isDrawingRef.current) return;
    const svgEl = e.currentTarget.closest('svg') as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const x = (e.clientX - rect.left).toFixed(1);
    const y = (e.clientY - rect.top).toFixed(1);
    currentPathRef.current += ` L ${x} ${y}`;
    livePathRef.current?.setAttribute('d', currentPathRef.current);
  }, []);

  const handleDrawEnd = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const path = currentPathRef.current;
    currentPathRef.current = '';
    livePathRef.current?.setAttribute('d', '');
    if (!path || !path.includes('L')) return;
    const stroke: BoardStroke = {
      id: 'bs' + Date.now(),
      path,
      color: drawColorRef.current,
      width: 2,
    };
    setBoard(prev => ({ ...prev, strokes: [...prev.strokes, stroke] }));
    serverOp({ op: 'add-stroke', stroke });
  }, [serverOp]);

  // ── Board background click ────────────────────────────────────────────
  const handleBoardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isBg = target === boardRef.current || target.classList.contains('board-bg-layer');
    if (!isBg) return;
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === 'note') addNote(x, y);
    else if (tool === 'image') { setImageModal({ x, y }); setImageUrl(''); }
    else if (tool === 'connect') setConnectingFrom(null);
  }, [tool, addNote]);

  // ── Connection centre estimate ────────────────────────────────────────
  const centre = (item: BoardItem) => ({ x: item.x + 80, y: item.y + 55 });

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="board-wrap" ref={boardRef} onClick={handleBoardClick}>
      <div className="board-bg-layer" />

      {/* ── Toolbar ── */}
      <div className="board-toolbar" onClick={e => e.stopPropagation()}>
        <div className="board-tool-group">
          {([
            { id: 'select' as Tool, icon: '↖', label: 'Select' },
            { id: 'note'   as Tool, icon: '📋', label: 'Note' },
            { id: 'image'  as Tool, icon: '🖼', label: 'Photo' },
            { id: 'connect'as Tool, icon: '⌇', label: 'String' },
            { id: 'draw'   as Tool, icon: '✏', label: 'Mark' },
          ]).map(t => (
            <button
              key={t.id}
              className={`board-tool-btn${tool === t.id ? ' active' : ''}`}
              onClick={() => { setTool(t.id); setConnectingFrom(null); }}
              title={t.label}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {tool === 'note' && (
          <div className="board-tool-group">
            <span className="board-tool-label">Color</span>
            {NOTE_COLORS.map(c => (
              <button
                key={c}
                className={`board-color-swatch${noteColor === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => setNoteColor(c)}
              />
            ))}
          </div>
        )}

        {tool === 'connect' && (
          <div className="board-tool-group">
            <span className="board-tool-label">String</span>
            {STRING_COLORS.map(c => (
              <button
                key={c}
                className={`board-color-swatch${stringColor === c ? ' active' : ''}`}
                style={{ background: c, border: c === '#f0ece0' ? '1px solid #aaa' : 'none' }}
                onClick={() => setStringColor(c)}
              />
            ))}
            {connectingFrom && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#e63946', marginLeft: 6 }}>
                ● Click another card to connect
              </span>
            )}
          </div>
        )}

        {tool === 'draw' && (
          <div className="board-tool-group">
            <span className="board-tool-label">Marker</span>
            {DRAW_COLORS.map(c => (
              <button
                key={c}
                className={`board-color-swatch${drawColor === c ? ' active' : ''}`}
                style={{ background: c, border: c === '#ffffff' ? '1px solid #aaa' : 'none' }}
                onClick={() => setDrawColor(c)}
              />
            ))}
            <button
              className="board-tool-btn"
              style={{ marginLeft: 4 }}
              onClick={() => {
                setBoard(prev => ({ ...prev, strokes: [] }));
                serverOp({ op: 'clear-strokes' });
              }}
            >
              Clear marks
            </button>
          </div>
        )}
      </div>

      {/* ── SVG: connections + strokes + live draw hit area ── */}
      <svg
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          overflow: 'visible',
          zIndex: tool === 'draw' ? 15 : 5,
          pointerEvents: 'none',
        }}
      >
        {/* Connection strings */}
        {board.connections.map(conn => {
          const f = board.items.find(i => i.id === conn.fromId);
          const t = board.items.find(i => i.id === conn.toId);
          if (!f || !t) return null;
          const fc = centre(f);
          const tc = centre(t);
          const mx = (fc.x + tc.x) / 2;
          const my = (fc.y + tc.y) / 2 + Math.min(40, Math.hypot(tc.x - fc.x, tc.y - fc.y) * 0.12);
          const d = `M ${fc.x} ${fc.y} Q ${mx} ${my} ${tc.x} ${tc.y}`;
          return (
            <g key={conn.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => deleteConnection(conn.id)}>
              <path d={d} stroke="transparent" strokeWidth={14} fill="none" />
              <path d={d} stroke={conn.color} strokeWidth={1.5} fill="none" opacity={0.88} strokeLinecap="round" />
            </g>
          );
        })}

        {/* Committed strokes */}
        {board.strokes.map(s => (
          <path key={s.id} d={s.path} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Live drawing preview (imperatively updated) */}
        <path ref={livePathRef} d="" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />

        {/* Draw hit area — only in draw mode */}
        {tool === 'draw' && (
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="transparent"
            style={{ cursor: 'crosshair', pointerEvents: 'all' }}
            onPointerDown={handleDrawStart}
            onPointerMove={handleDrawMove}
            onPointerUp={handleDrawEnd}
            onPointerLeave={handleDrawEnd}
          />
        )}
      </svg>

      {/* ── Board items ── */}
      {board.items.map(item => {
        const live = dragPos?.id === item.id ? dragPos : null;
        const x = live ? live.x : item.x;
        const y = live ? live.y : item.y;
        const isEditing = editingId === item.id;

        return (
          <div
            key={item.id}
            className={`board-item${connectingFrom === item.id ? ' board-item-active' : ''}`}
            style={{ left: x, top: y, transform: `rotate(${item.rotation}deg)`, zIndex: live ? 30 : 10 }}
            onClick={e => {
              e.stopPropagation();
              if (tool === 'connect') handleItemConnect(item.id);
            }}
          >
            {/* Thumbtack */}
            <div className="board-pin" style={{ background: connectingFrom === item.id ? '#f4d03f' : '#c0392b' }} />

            {/* Delete button */}
            <button
              className="board-item-del"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
            >✕</button>

            {/* Author */}
            <div className="board-item-author">{item.author}</div>

            {/* ── Note card ── */}
            {item.type === 'note' && (
              <div
                className="board-note"
                style={{ background: item.color }}
                onMouseDown={e => { if (tool === 'select' && !isEditing) startDrag(e, item); }}
              >
                {isEditing && editingField === 'text' ? (
                  <textarea
                    className="board-note-textarea"
                    autoFocus
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={() => saveEdit(item.id, 'text', editingText)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') saveEdit(item.id, 'text', editingText);
                      e.stopPropagation();
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className="board-note-text"
                    onClick={e => {
                      e.stopPropagation();
                      if (tool === 'select') startEdit(item.id, 'text', item.text ?? '');
                    }}
                    onMouseDown={e => { if (tool === 'select') e.stopPropagation(); }}
                  >
                    {item.text || <span className="board-placeholder">Click to write…</span>}
                  </p>
                )}
              </div>
            )}

            {/* ── Image card ── */}
            {item.type === 'image' && (
              <div className="board-image-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.caption ?? ''}
                  className="board-image-img"
                  onMouseDown={e => { if (tool === 'select') startDrag(e, item); }}
                  draggable={false}
                />
                {isEditing && editingField === 'caption' ? (
                  <input
                    className="board-caption-input"
                    autoFocus
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={() => saveEdit(item.id, 'caption', editingText)}
                    onKeyDown={e => {
                      if (e.key === 'Escape' || e.key === 'Enter') saveEdit(item.id, 'caption', editingText);
                      e.stopPropagation();
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="board-caption"
                    onClick={e => {
                      e.stopPropagation();
                      if (tool === 'select') startEdit(item.id, 'caption', item.caption ?? '');
                    }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    {item.caption || <span className="board-placeholder">Add caption…</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Image URL modal ── */}
      {imageModal && (
        <div
          className="board-url-modal"
          style={{ left: imageModal.x, top: imageModal.y }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink-text-2)', marginBottom: 6 }}>
            Pin a photo
          </div>
          <input
            autoFocus
            className="board-url-input"
            placeholder="Paste image URL…"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && imageUrl.trim()) {
                addImage(imageModal.x, imageModal.y, imageUrl.trim());
                setImageModal(null);
              }
              if (e.key === 'Escape') setImageModal(null);
              e.stopPropagation();
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              className="btn btn-sm btn-primary"
              style={{ flex: 1, fontSize: 11 }}
              onClick={() => {
                if (imageUrl.trim()) {
                  addImage(imageModal.x, imageModal.y, imageUrl.trim());
                  setImageModal(null);
                }
              }}
            >
              Pin
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ fontSize: 11 }}
              onClick={() => setImageModal(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
