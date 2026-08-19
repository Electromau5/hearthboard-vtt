'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

// ── Constants ────────────────────────────────────────────────────────
const TOKEN_COLORS = ['#c9944f', '#4f9b92', '#b1483f', '#8a72c9', '#5f8fc9', '#c9b04f'];
const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];

const INITIAL_GAMES = [
  { id: 'g1', name: 'The Sunken Reliquary', system: 'D&D 5e', description: 'A drowned temple, a sea-mad cult, and a relic that breathes.', art: 'art-sea', lastPlayed: '3 days ago' },
  { id: 'g2', name: 'Ashes of Blackmoor', system: 'Pathfinder 2e', description: 'A border war fought in the shadow of a dead god.', art: 'art-forest', lastPlayed: '1 week ago' },
  { id: 'g3', name: 'The Hollow Choir', system: 'Call of Cthulhu', description: 'Something in the mine sings, and the town has started humming along.', art: 'art-void', lastPlayed: '2 weeks ago' },
];

const SCENES = [
  { id: 's1', name: 'The Drowned Nave', bg: 'radial-gradient(circle at 30% 20%, #1c3a44, #0b1216 70%)' },
  { id: 's2', name: 'Blackmoor Ridge', bg: 'radial-gradient(circle at 60% 30%, #1e3b2f, #0c1210 70%)' },
  { id: 's3', name: 'The Tavern Cellar', bg: 'radial-gradient(circle at 40% 60%, #3a2a1f, #100b08 70%)' },
];

const COMPENDIUM = [
  { name: 'Goblin Skirmisher', type: 'Small humanoid', cr: 'CR 1/4', hp: 7 as number | null, ac: 15 as number | null, color: '#7a9b4f' },
  { name: 'Dire Wolf', type: 'Large beast', cr: 'CR 1', hp: 37 as number | null, ac: 14 as number | null, color: '#6b6b70' },
  { name: 'Cultist Adept', type: 'Medium humanoid', cr: 'CR 2', hp: 27 as number | null, ac: 13 as number | null, color: '#8a2f2f' },
  { name: 'Stone Gargoyle', type: 'Medium construct', cr: 'CR 2', hp: 52 as number | null, ac: 15 as number | null, color: '#8a8a8a' },
  { name: 'Drowned Revenant', type: 'Medium undead', cr: 'CR 4', hp: 68 as number | null, ac: 14 as number | null, color: '#3f6b6b' },
  { name: 'Young Wyrmling', type: 'Large dragon', cr: 'CR 6', hp: 97 as number | null, ac: 17 as number | null, color: '#b1483f' },
  { name: 'Lantern of Tides', type: 'Wondrous item', cr: '—', hp: null as number | null, ac: null as number | null, color: '#c9944f' },
  { name: 'Vial of Still Water', type: 'Consumable', cr: '—', hp: null as number | null, ac: null as number | null, color: '#4f9b92' },
];

const CHARACTERS = [
  { id: 'c1', name: 'Fenwick Ashgrove', cls: 'Half-Elf Ranger, Lvl 5', hp: 38, maxHp: 44, ac: 15, abilities: { STR: 14, DEX: 18, CON: 13, INT: 10, WIS: 16, CHA: 8 }, inventory: [{ name: 'Longbow', qty: 1 }, { name: 'Arrows', qty: 20 }, { name: "Traveler's cloak", qty: 1 }, { name: 'Rations', qty: 6 }] },
  { id: 'c2', name: 'Brother Ovid', cls: 'Human Cleric, Lvl 5', hp: 41, maxHp: 41, ac: 17, abilities: { STR: 12, DEX: 10, CON: 14, INT: 11, WIS: 18, CHA: 13 }, inventory: [{ name: 'Mace', qty: 1 }, { name: 'Holy symbol', qty: 1 }, { name: "Healer's kit", qty: 1 }, { name: 'Prayer book', qty: 1 }] },
  { id: 'c3', name: 'Nix Quickfingers', cls: 'Tiefling Rogue, Lvl 5', hp: 29, maxHp: 35, ac: 16, abilities: { STR: 9, DEX: 19, CON: 12, INT: 14, WIS: 11, CHA: 15 }, inventory: [{ name: 'Daggers', qty: 2 }, { name: "Thieves' tools", qty: 1 }, { name: 'Smoke bomb', qty: 3 }] },
];

// ── Types ────────────────────────────────────────────────────────────
interface Game { id: string; name: string; system: string; description: string; art: string; lastPlayed: string; }
interface Token { id: string; label: string; fullName: string; color: string; x: number; y: number; hp: number; maxHp: number; }
interface InitEntry { tokenId: string; name: string; color: string; value: number; }
type RollResult = { formula: string; rolls: number[]; mod: number; sides: number; total: number; n: number; };
type ChatItem =
  | { type: 'system'; text: string }
  | { type: 'chat'; who: string; text: string }
  | { type: 'roll'; who: string; res: RollResult; crit: boolean; fumble: boolean; ts: number };

// ── Helpers ──────────────────────────────────────────────────────────
function artForSystem(sys: string) {
  if (sys === 'D&D 5e') return 'art-sea';
  if (sys === 'Pathfinder 2e') return 'art-forest';
  if (sys === 'Call of Cthulhu') return 'art-void';
  return 'art-dungeon';
}

function abilityMod(score: number) {
  const m = Math.floor((score - 10) / 2);
  return (m >= 0 ? '+' : '') + m;
}

function rollFormula(formula: string): RollResult | null {
  const m = formula.replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const n = parseInt(m[1] || '1', 10);
  const sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3], 10) : 0;
  if (n < 1 || n > 50 || sides < 2) return null;
  const rolls: number[] = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  const sum = rolls.reduce((a, b) => a + b, 0) + mod;
  return { formula: `${n}d${sides}${mod ? (mod > 0 ? '+' : '') + mod : ''}`, rolls, mod, sides, total: sum, n };
}

// ── Component ────────────────────────────────────────────────────────
export default function HearthboardPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [games, setGames] = useState<Game[]>(INITIAL_GAMES);
  const [view, setView] = useState<'dashboard' | 'game'>('dashboard');
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState('s1');
  const [tool, setToolState] = useState('select');
  const [gridOn, setGridOn] = useState(true);
  const [tokensByScene, setTokensByScene] = useState<Record<string, Token[]>>({ s1: [], s2: [], s3: [] });
  const [initiative, setInitiative] = useState<InitEntry[]>([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [activePane, setActivePane] = useState('chat');
  const [activeCharId, setActiveCharId] = useState('c1');
  const [rollCount, setRollCount] = useState(238);
  const [chatItems, setChatItems] = useState<ChatItem[]>([{ type: 'system', text: 'Session opened.' }]);
  const [journals, setJournals] = useState<Record<string, string>>({});
  const [pickedSystem, setPickedSystem] = useState('D&D 5e');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [newGameDesc, setNewGameDesc] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [compSearch, setCompSearch] = useState('');
  const [journalSaved, setJournalSaved] = useState('Autosaves as you type');
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

  // Refs
  const dragPayloadRef = useRef<{ kind: 'tray'; color: string; label: string } | { kind: 'compendium'; idx: number } | null>(null);
  const dragTokRef = useRef<{ id: string; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const dragPosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const tokenSeqRef = useRef(1);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const currentSceneIdRef = useRef(currentSceneId);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { currentSceneIdRef.current = currentSceneId; }, [currentSceneId]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [chatItems]);

  // Global mouse handlers for token dragging
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragTokRef.current || !mapWrapRef.current) return;
      dragTokRef.current.moved = true;
      const rect = mapWrapRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragTokRef.current.offsetX;
      const y = e.clientY - rect.top - dragTokRef.current.offsetY;
      const pos = { id: dragTokRef.current.id, x, y };
      dragPosRef.current = pos;
      setDragPos({ ...pos });
    };
    const onMouseUp = () => {
      if (!dragTokRef.current) return;
      const { id, moved } = dragTokRef.current;
      const pos = dragPosRef.current;
      if (pos && moved) {
        setTokensByScene(prev => {
          const scene = currentSceneIdRef.current;
          return { ...prev, [scene]: prev[scene].map(t => t.id === id ? { ...t, x: pos.x, y: pos.y } : t) };
        });
      }
      dragPosRef.current = null;
      dragTokRef.current = null;
      setDragPos(null);
      if (!moved) setSelectedTokenId(id);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2200);
  }, []);

  const openGame = (id: string) => {
    setCurrentGameId(id);
    setView('game');
    setActivePane('chat');
    setSelectedTokenId(null);
  };

  const backToDashboard = () => {
    setView('dashboard');
    setCurrentGameId(null);
  };

  const openCreateModal = () => {
    setNewGameName('');
    setNewGameDesc('');
    setPickedSystem('D&D 5e');
    setCreateModalOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const createGame = () => {
    const name = newGameName.trim();
    if (!name) { nameInputRef.current?.focus(); return; }
    const g: Game = { id: 'g' + Date.now(), name, system: pickedSystem, description: newGameDesc.trim(), art: artForSystem(pickedSystem), lastPlayed: 'just now' };
    setGames(prev => [g, ...prev]);
    setCreateModalOpen(false);
    showToast('Table created — welcome, GM');
    openGame(g.id);
  };

  const addToken = (t: { label: string; color: string; x: number; y: number; hp: number; maxHp: number; fullName?: string }) => {
    const id = 't' + tokenSeqRef.current++;
    const tok: Token = { id, label: t.label, fullName: t.fullName || t.label, color: t.color, x: t.x, y: t.y, hp: t.hp, maxHp: t.maxHp };
    setTokensByScene(prev => {
      const scene = currentSceneIdRef.current;
      return { ...prev, [scene]: [...(prev[scene] || []), tok] };
    });
  };

  const handleMapDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragPayloadRef.current || !mapWrapRef.current) return;
    const rect = mapWrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const payload = dragPayloadRef.current;
    if (payload.kind === 'tray') {
      addToken({ label: payload.label, color: payload.color, x, y, hp: 20, maxHp: 20 });
    } else {
      const item = COMPENDIUM[payload.idx];
      const initials = item.name.split(' ').map(w => w[0]).slice(0, 2).join('');
      addToken({ label: initials, color: item.color, x, y, hp: item.hp ?? 10, maxHp: item.hp ?? 10, fullName: item.name });
    }
    dragPayloadRef.current = null;
  };

  const handleTokenMouseDown = (e: React.MouseEvent<HTMLDivElement>, tok: Token) => {
    e.preventDefault();
    if (!mapWrapRef.current) return;
    const rect = mapWrapRef.current.getBoundingClientRect();
    const effectiveX = (dragPos && dragPos.id === tok.id) ? dragPos.x : tok.x;
    const effectiveY = (dragPos && dragPos.id === tok.id) ? dragPos.y : tok.y;
    dragTokRef.current = {
      id: tok.id,
      offsetX: e.clientX - rect.left - effectiveX,
      offsetY: e.clientY - rect.top - effectiveY,
      moved: false,
    };
  };

  const adjustHp = (tokenId: string, delta: number) => {
    setTokensByScene(prev => {
      const scene = currentSceneIdRef.current;
      return { ...prev, [scene]: prev[scene].map(t => t.id === tokenId ? { ...t, hp: Math.max(0, Math.min(t.maxHp, t.hp + delta)) } : t) };
    });
  };

  const removeToken = (tokenId: string) => {
    setTokensByScene(prev => {
      const scene = currentSceneIdRef.current;
      return { ...prev, [scene]: prev[scene].filter(t => t.id !== tokenId) };
    });
    setInitiative(prev => prev.filter(i => i.tokenId !== tokenId));
    setSelectedTokenId(null);
  };

  const addToInitiative = (tokenId: string) => {
    const tok = currentTokens.find(t => t.id === tokenId);
    if (!tok) return;
    if (initiative.find(i => i.tokenId === tokenId)) { showToast('Already in the order'); return; }
    const roll = 1 + Math.floor(Math.random() * 20);
    setInitiative(prev => [...prev, { tokenId, name: tok.fullName, color: tok.color, value: roll }].sort((a, b) => b.value - a.value));
    setCurrentTurnIdx(0);
    showToast(`${tok.fullName} rolled ${roll} for initiative`);
  };

  const nextTurn = () => {
    if (initiative.length === 0) { showToast('No one in the initiative order yet'); return; }
    const next = (currentTurnIdx + 1) % initiative.length;
    setCurrentTurnIdx(next);
    showToast(`${initiative[next].name}'s turn`);
  };

  const pushRollToChat = useCallback((who: string, res: RollResult) => {
    setRollCount(c => c + 1);
    const isCrit = res.sides === 20 && res.n === 1 && res.rolls[0] === 20;
    const isFumble = res.sides === 20 && res.n === 1 && res.rolls[0] === 1;
    setChatItems(prev => [...prev, { type: 'roll', who, res, crit: isCrit, fumble: isFumble, ts: Date.now() }]);
  }, []);

  const rollDie = (sides: number) => {
    const res = rollFormula('1d' + sides);
    if (res) pushRollToChat('You', res);
  };

  const handleChatSubmit = () => {
    const input = chatInputRef.current;
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    const res = rollFormula(val);
    if (res) {
      pushRollToChat('You', res);
    } else {
      setChatItems(prev => [...prev, { type: 'chat', who: 'You', text: val }]);
    }
    input.value = '';
  };

  const rollAbility = (charName: string, ability: string, score: number) => {
    const mod = Math.floor((score - 10) / 2);
    const res = rollFormula('1d20' + (mod !== 0 ? (mod > 0 ? '+' : '') + mod : ''));
    if (res) pushRollToChat(`${charName} (${ability})`, res);
    setActivePane('chat');
  };

  const saveJournal = (value: string) => {
    if (!currentGameId) return;
    setJournals(prev => ({ ...prev, [currentGameId]: value }));
    setJournalSaved('Saved just now');
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current);
    journalTimerRef.current = setTimeout(() => setJournalSaved('Autosaves as you type'), 1500);
  };

  // ── Derived ──────────────────────────────────────────────────────────
  const currentGame = games.find(g => g.id === currentGameId) ?? null;
  const currentTokens = tokensByScene[currentSceneId] ?? [];
  const currentScene = SCENES.find(s => s.id === currentSceneId)!;
  const selectedToken = currentTokens.find(t => t.id === selectedTokenId) ?? null;
  const filteredCompendium = COMPENDIUM.filter(c => {
    const q = compSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
  });
  const activeChar = CHARACTERS.find(c => c.id === activeCharId) ?? CHARACTERS[0];

  const getTokenPos = (tok: Token) =>
    (dragPos && dragPos.id === tok.id) ? { x: dragPos.x, y: dragPos.y } : { x: tok.x, y: tok.y };

  const popoverPos = selectedToken ? (() => {
    const pos = getTokenPos(selectedToken);
    return { left: pos.x + 34, top: pos.y - 10 };
  })() : null;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ============ DASHBOARD ============ */}
      <div className={`view${view === 'dashboard' ? ' active' : ''}`} id="view-dashboard">
        <div className="dash-topbar">
          <div className="brand">
            <div className="brand-mark">H</div>
            <div className="brand-name">Hearth<em>board</em></div>
          </div>
          <div className="dash-actions">
            {isAdmin && (
              <Link href="/admin/users" className="btn btn-ghost btn-sm">Admin</Link>
            )}
            <span style={{ fontSize: 13, color: 'var(--ink-text-2)' }}>{session?.user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button>
            <button className="btn btn-primary" onClick={openCreateModal}>＋ Create Game</button>
          </div>
        </div>

        <div className="dash-body">
          <div className="dash-hero">
            <span className="eyebrow">Session Zero</span>
            <h1>Your tables, ready when you are.</h1>
            <p>Jump back into a running campaign, or set a new one on the map.</p>
          </div>

          <div className="stat-row">
            <div className="stat-card"><div className="stat-num">{games.length}</div><div className="stat-label">Active campaigns</div></div>
            <div className="stat-card"><div className="stat-num">14</div><div className="stat-label">Sessions logged</div></div>
            <div className="stat-card"><div className="stat-num">{rollCount}</div><div className="stat-label">Dice rolled all-time</div></div>
          </div>

          <div className="section-label">My Games</div>
          <div className="game-grid">
            {games.length === 0 ? (
              <div className="empty-slate" style={{ gridColumn: '1 / -1' }}>
                <h3>No games yet</h3>
                <p>Create your first table to get the party together.</p>
                <button className="btn btn-primary" onClick={openCreateModal}>＋ Create Game</button>
              </div>
            ) : games.map(g => (
              <div key={g.id} className="game-card" onClick={() => openGame(g.id)}>
                <div className={`game-card-art ${g.art}`}><span className="sys-tag">{g.system}</span></div>
                <div className="game-card-body">
                  <h3>{g.name}</h3>
                  <p>{g.description || 'No description yet.'}</p>
                  <div className="game-card-meta"><span>Last played {g.lastPlayed}</span><span>Enter →</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ CREATE GAME MODAL ============ */}
      <div
        className={`modal-veil${createModalOpen ? ' active' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) setCreateModalOpen(false); }}
      >
        <div className="modal">
          <div className="modal-head">
            <h2>Set a new table</h2>
            <p>Give the campaign a name and pick the rules you&apos;re playing under.</p>
          </div>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="ng-name">Game name</label>
              <input
                ref={nameInputRef}
                type="text"
                id="ng-name"
                placeholder="e.g. The Sunken Reliquary"
                maxLength={60}
                value={newGameName}
                onChange={e => setNewGameName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createGame(); }}
              />
            </div>
            <div className="field">
              <label>System</label>
              <div className="system-pick">
                {[
                  { label: 'D&D 5th Edition', value: 'D&D 5e' },
                  { label: 'Pathfinder 2e', value: 'Pathfinder 2e' },
                  { label: 'Call of Cthulhu', value: 'Call of Cthulhu' },
                  { label: 'Custom / Homebrew', value: 'Custom' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`system-opt${pickedSystem === opt.value ? ' selected' : ''}`}
                    onClick={() => setPickedSystem(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="ng-desc">
                Description{' '}
                <span style={{ color: 'var(--ink-text-2)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="ng-desc"
                placeholder="What's the pitch for this campaign?"
                value={newGameDesc}
                onChange={e => setNewGameDesc(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={() => setCreateModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createGame}>Create game</button>
          </div>
        </div>
      </div>

      {/* ============ GAME / VTT VIEW ============ */}
      <div className={`view${view === 'game' ? ' active' : ''}`} id="view-game">
        <div className="game-topbar">
          <button className="btn btn-ghost btn-sm" onClick={backToDashboard}>← Games</button>
          <span className="gt-title">{currentGame?.name ?? '—'}</span>
          <span className="gt-sys">{currentGame?.system ?? '—'}</span>
          <div className="scene-switch">
            {SCENES.map(s => (
              <button
                key={s.id}
                className={`scene-chip${s.id === currentSceneId ? ' active' : ''}`}
                onClick={() => { setCurrentSceneId(s.id); setSelectedTokenId(null); }}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => showToast('Invite link copied')}>
            Invite players
          </button>
        </div>

        <div className="game-main">
          {/* Left rail */}
          <div className="left-rail">
            <div className="rail-section">
              <div className="rail-title">Tools</div>
              <div className="tool-row">
                {[
                  { id: 'select', icon: '↖', label: 'Select' },
                  { id: 'ping', icon: '◎', label: 'Ping' },
                  { id: 'measure', icon: '📏', label: 'Measure' },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`tool-btn${tool === t.id ? ' active' : ''}`}
                    onClick={() => setToolState(t.id)}
                  >
                    <span className="ic">{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rail-section">
              <div className="grid-toggle-row">
                <span>Show grid</span>
                <div className={`switch${gridOn ? ' on' : ''}`} onClick={() => setGridOn(v => !v)} />
              </div>
            </div>
            <div className="rail-section">
              <div className="rail-title">Token Tray</div>
              <div className="token-tray">
                {['A', 'B', 'C', 'D', 'E', 'F'].map((label, i) => (
                  <div
                    key={label}
                    className="tray-token"
                    style={{ background: TOKEN_COLORS[i % TOKEN_COLORS.length] }}
                    draggable
                    onDragStart={() => {
                      dragPayloadRef.current = { kind: 'tray', color: TOKEN_COLORS[i % TOKEN_COLORS.length], label };
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="tray-hint">Drag a token onto the map to place it. Drag placed tokens to move them.</div>
            </div>
          </div>

          {/* Center map */}
          <div
            className="map-wrap"
            ref={mapWrapRef}
            onDragOver={e => e.preventDefault()}
            onDrop={handleMapDrop}
            onMouseDown={e => {
              const t = e.target as HTMLElement;
              if (t.id === 'map-canvas' || t.id === 'map-grid-overlay' || t === mapWrapRef.current) {
                setSelectedTokenId(null);
              }
            }}
          >
            <div className="map-canvas" id="map-canvas" style={{ background: currentScene.bg }} />
            <div className={`map-grid-overlay${gridOn ? '' : ' hidden'}`} id="map-grid-overlay" />
            <div className="map-vignette" />
            {currentTokens.length === 0 && (
              <div className="map-empty-hint">Drag a token from the left tray onto the map to begin</div>
            )}

            {/* Tokens */}
            {currentTokens.map(tok => {
              const pos = getTokenPos(tok);
              const hpPct = Math.max(0, Math.round(100 * tok.hp / tok.maxHp));
              return (
                <div
                  key={tok.id}
                  className={`token${selectedTokenId === tok.id ? ' selected' : ''}${dragPos?.id === tok.id ? ' dragging' : ''}`}
                  data-id={tok.id}
                  style={{ left: pos.x, top: pos.y, background: tok.color, ['--hp-pct' as string]: hpPct } as React.CSSProperties}
                  onMouseDown={e => handleTokenMouseDown(e, tok)}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="hp-ring" />
                  {tok.label}
                  <div className="token-label">{tok.fullName} · {tok.hp}/{tok.maxHp}</div>
                </div>
              );
            })}

            {/* Token popover */}
            {selectedToken && popoverPos && (
              <div className="token-popover" style={{ left: popoverPos.left, top: popoverPos.top }}>
                <h4>{selectedToken.fullName}</h4>
                <div className="hp-row">
                  <button onClick={() => adjustHp(selectedToken.id, -1)}>−</button>
                  <span className="hp-val">{selectedToken.hp} / {selectedToken.maxHp} HP</span>
                  <button onClick={() => adjustHp(selectedToken.id, 1)}>＋</button>
                </div>
                <button
                  className="btn btn-sm"
                  style={{ width: '100%', marginBottom: 6 }}
                  onClick={() => addToInitiative(selectedToken.id)}
                >
                  Add to initiative
                </button>
                <button
                  className="btn btn-sm btn-danger pop-close"
                  onClick={() => removeToken(selectedToken.id)}
                >
                  Remove token
                </button>
              </div>
            )}

            {/* Initiative bar */}
            <div className="initiative-bar">
              <span className="init-label">Initiative</span>
              <div className="init-track">
                {initiative.length === 0 ? (
                  <span style={{ fontSize: '11.5px', color: 'var(--ink-text-2)' }}>
                    Select a token on the map and &quot;Add to initiative&quot; to start tracking turns.
                  </span>
                ) : initiative.map((entry, idx) => (
                  <div key={entry.tokenId} className={`init-card${idx === currentTurnIdx ? ' current' : ''}`}>
                    <div className="ini-name" style={{ color: entry.color }}>{entry.name}</div>
                    <div className="ini-num">{entry.value}</div>
                    <div
                      className="rm"
                      onClick={() => {
                        setInitiative(prev => prev.filter((_, i) => i !== idx));
                        setCurrentTurnIdx(c => (initiative.length - 1 > 0 ? Math.min(c, initiative.length - 2) : 0));
                      }}
                    >
                      ✕
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-sm btn-ghost" onClick={nextTurn}>Next turn →</button>
            </div>
          </div>

          {/* Right panel */}
          <div className="right-panel">
            <div className="rp-tabs">
              {['chat', 'characters', 'compendium', 'journal'].map(pane => (
                <button
                  key={pane}
                  className={`rp-tab${activePane === pane ? ' active' : ''}`}
                  onClick={() => setActivePane(pane)}
                >
                  {pane.charAt(0).toUpperCase() + pane.slice(1)}
                </button>
              ))}
            </div>

            {/* Chat pane */}
            <div className={`rp-pane${activePane === 'chat' ? ' active' : ''}`}>
              <div className="dice-quickbar">
                {QUICK_DICE.map(d => (
                  <button key={d} className="die-btn" onClick={() => rollDie(d)}>d{d}</button>
                ))}
              </div>
              <div className="custom-roll-hint">Or type a formula below, e.g. 2d6+3</div>
              <div className="chat-log" ref={chatLogRef}>
                {chatItems.map((item, i) => {
                  if (item.type === 'system') {
                    return <div key={i} className="chat-item system">{item.text}</div>;
                  }
                  if (item.type === 'chat') {
                    return <div key={i} className="chat-item"><span className="who">{item.who}</span>{item.text}</div>;
                  }
                  if (item.type === 'roll') {
                    const r = item.res;
                    const breakdown = r.n > 1
                      ? `[${r.rolls.join(', ')}]${r.mod ? (r.mod > 0 ? ' + ' + r.mod : ' - ' + Math.abs(r.mod)) : ''}`
                      : r.mod ? `[${r.rolls[0]}] ${r.mod > 0 ? '+' : ''}${r.mod}` : '';
                    const tag = item.crit ? ' · Critical!' : (item.fumble ? ' · Fumble' : '');
                    return (
                      <div key={i} className={`roll-card${item.crit ? ' crit' : item.fumble ? ' fumble' : ''}`}>
                        <div className="rc-head">
                          <span className="rc-who">{item.who}</span>
                          <span className="rc-formula">{r.formula}{tag}</span>
                        </div>
                        <div className="rc-result">{r.total}</div>
                        {breakdown && <div className="rc-breakdown">{breakdown}</div>}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
              <div className="chat-input-row">
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="Say something, or roll a formula…"
                  onKeyDown={e => { if (e.key === 'Enter') handleChatSubmit(); }}
                />
                <button className="send-btn" onClick={handleChatSubmit}>Send</button>
              </div>
            </div>

            {/* Characters pane */}
            <div className={`rp-pane${activePane === 'characters' ? ' active' : ''}`}>
              <div className="char-list">
                {CHARACTERS.map(c => (
                  <button
                    key={c.id}
                    className={`char-chip${c.id === activeCharId ? ' active' : ''}`}
                    onClick={() => setActiveCharId(c.id)}
                  >
                    {c.name.split(' ')[0]}
                  </button>
                ))}
              </div>
              <div className="char-sheet">
                {(() => {
                  const charIdx = CHARACTERS.findIndex(c => c.id === activeCharId);
                  const color = TOKEN_COLORS[charIdx % TOKEN_COLORS.length];
                  return (
                    <>
                      <div className="cs-head">
                        <div className="cs-avatar" style={{ background: color + '22', color }}>
                          {activeChar.name[0]}
                        </div>
                        <div>
                          <div className="cs-name">{activeChar.name}</div>
                          <div className="cs-sub">{activeChar.cls}</div>
                        </div>
                      </div>
                      <div className="cs-vitals">
                        <div className="vital-box hp">
                          <div className="v-label">HP</div>
                          <div className="v-val">{activeChar.hp}/{activeChar.maxHp}</div>
                        </div>
                        <div className="vital-box ac">
                          <div className="v-label">AC</div>
                          <div className="v-val">{activeChar.ac}</div>
                        </div>
                      </div>
                      <div className="ability-grid">
                        {Object.entries(activeChar.abilities).map(([key, val]) => (
                          <div key={key} className="ability" onClick={() => rollAbility(activeChar.name, key, val)}>
                            <div className="a-name">{key}</div>
                            <div className="a-mod">{abilityMod(val)}</div>
                            <div className="a-score">{val}</div>
                          </div>
                        ))}
                      </div>
                      <div className="inv-title">Inventory</div>
                      <ul className="inv-list">
                        {activeChar.inventory.map((item, i) => (
                          <li key={i}><span>{item.name}</span><span className="qty">×{item.qty}</span></li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Compendium pane */}
            <div className={`rp-pane${activePane === 'compendium' ? ' active' : ''}`}>
              <div className="comp-search">
                <input
                  type="text"
                  placeholder="Search monsters &amp; items…"
                  value={compSearch}
                  onChange={e => setCompSearch(e.target.value)}
                />
              </div>
              <div className="comp-list">
                {filteredCompendium.length === 0 ? (
                  <div style={{ color: 'var(--ink-text-2)', fontSize: 13, padding: 10 }}>No matches.</div>
                ) : filteredCompendium.map(c => {
                  const idx = COMPENDIUM.indexOf(c);
                  return (
                    <div
                      key={c.name}
                      className="comp-item"
                      draggable
                      onDragStart={() => { dragPayloadRef.current = { kind: 'compendium', idx }; }}
                    >
                      <div className="ci-top">
                        <span className="ci-name">{c.name}</span>
                        <span className="ci-cr">{c.cr}</span>
                      </div>
                      <div className="ci-type">{c.type}</div>
                      {c.hp !== null && (
                        <div className="ci-stats"><span>HP {c.hp}</span><span>AC {c.ac}</span></div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="comp-hint">Drag an entry onto the map to spawn it as a token.</div>
            </div>

            {/* Journal pane */}
            <div className={`rp-pane${activePane === 'journal' ? ' active' : ''}`}>
              <div className="journal-pane">
                <textarea
                  placeholder="Session notes, secrets, clues the party hasn't found yet…"
                  value={currentGameId ? (journals[currentGameId] ?? '') : ''}
                  onChange={e => saveJournal(e.target.value)}
                />
                <div className="journal-saved">{journalSaved}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toastVisible ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
