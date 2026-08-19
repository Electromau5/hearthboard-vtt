'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

// ── Constants ────────────────────────────────────────────────────────
const TOKEN_COLORS = ['#c9944f', '#4f9b92', '#b1483f', '#8a72c9', '#5f8fc9', '#c9b04f'];
const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];

const ECHOES_OF_DARKNESS = {
  id: 'echoes',
  name: 'Echoes of Darkness',
  system: 'Call of Cthulhu',
  description: 'Seven investigators descend into a 17-year subterranean excavation — and something ancient stirs below.',
  art: 'art-void',
  lastPlayed: 'Ongoing',
};

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
  { id: 'c1', name: 'Dr. Alistair Finch', cls: 'The Disgraced Mortician', hp: 12, maxHp: 12, ac: 0, abilities: { STR: 50, CON: 65, DEX: 75, INT: 85, POW: 75, EDU: 85 }, inventory: [{ name: 'Dissection kit', qty: 1 }, { name: 'Formaldehyde jars', qty: 3 }, { name: 'Scalpel holster', qty: 1 }, { name: 'Mortuary credentials', qty: 1 }] },
  { id: 'c2', name: 'Silas "The Great" Vance', cls: 'The Blackmailed Illusionist', hp: 11, maxHp: 11, ac: 0, abilities: { STR: 55, CON: 60, DEX: 85, INT: 75, POW: 70, EDU: 65 }, inventory: [{ name: 'Lockpick kit', qty: 1 }, { name: 'Flash pellets', qty: 4 }, { name: 'Defense cane', qty: 1 }, { name: 'Debt note', qty: 1 }] },
  { id: 'c3', name: 'Julian Sterling', cls: 'The Desperate Auteur', hp: 10, maxHp: 10, ac: 0, abilities: { STR: 45, CON: 55, DEX: 70, INT: 80, POW: 65, EDU: 75 }, inventory: [{ name: '35mm Eyemo camera', qty: 1 }, { name: 'Nitrate film rolls', qty: 4 }, { name: 'Magnesium dish', qty: 1 }, { name: 'Dev kit', qty: 1 }] },
  { id: 'c4', name: 'Thomas "Mack" Callahan', cls: 'The Amnesiac Detective', hp: 14, maxHp: 14, ac: 0, abilities: { STR: 75, CON: 70, DEX: 65, INT: 70, POW: 65, EDU: 60 }, inventory: [{ name: 'Colt M1911', qty: 1 }, { name: 'Spare magazines', qty: 3 }, { name: 'Trench knife', qty: 1 }, { name: 'PI badge', qty: 1 }] },
  { id: 'c5', name: 'Richard Pickman Graves', cls: 'The Macabre Visionary', hp: 9, maxHp: 9, ac: 0, abilities: { STR: 40, CON: 45, DEX: 80, INT: 85, POW: 80, EDU: 70 }, inventory: [{ name: 'Charcoal sketchbook', qty: 1 }, { name: 'Bristle brushes', qty: 1 }, { name: 'Oil paint tubes', qty: 1 }, { name: 'Cemetery sketches', qty: 1 }] },
  { id: 'c6', name: 'Arthur Wright', cls: 'The Non-Euclidean Architect', hp: 12, maxHp: 12, ac: 0, abilities: { STR: 55, CON: 65, DEX: 60, INT: 90, POW: 70, EDU: 85 }, inventory: [{ name: 'Brass compass', qty: 1 }, { name: 'Theodolite', qty: 1 }, { name: 'Dynamite sticks', qty: 2 }, { name: 'Blueprint parchment', qty: 1 }] },
  { id: 'c7', name: 'Percival Winthrop', cls: 'The Ruined Tycoon', hp: 11, maxHp: 11, ac: 0, abilities: { STR: 50, CON: 55, DEX: 55, INT: 80, POW: 75, EDU: 85 }, inventory: [{ name: 'Savile Row suit', qty: 1 }, { name: 'Gold pocket watch', qty: 1 }, { name: '.32 ACP revolver', qty: 1 }, { name: 'Bankrupt ledger', qty: 1 }] },
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

  const [view, setView] = useState<'dashboard' | 'game'>('dashboard');
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
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [compSearch, setCompSearch] = useState('');
  const [journalSaved, setJournalSaved] = useState('Autosaves as you type');
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [butlerOpen, setButlerOpen] = useState(false);

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
  const chatInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const butlerAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { currentSceneIdRef.current = currentSceneId; }, [currentSceneId]);

  // Sync audio with music controls
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = musicVolume;
    if (musicPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [musicPlaying, musicVolume]);

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

  const openGame = () => {
    setView('game');
    setActivePane('chat');
    setSelectedTokenId(null);
  };

  const backToDashboard = () => {
    setView('dashboard');
  };

  const openButler = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setButlerOpen(true);
    if (butlerAudioRef.current) {
      butlerAudioRef.current.currentTime = 0;
      butlerAudioRef.current.play().catch(() => {});
    }
  };

  const closeButler = () => {
    setButlerOpen(false);
    if (butlerAudioRef.current) {
      butlerAudioRef.current.pause();
      butlerAudioRef.current.currentTime = 0;
    }
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
    setJournals(prev => ({ ...prev, [ECHOES_OF_DARKNESS.id]: value }));
    setJournalSaved('Saved just now');
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current);
    journalTimerRef.current = setTimeout(() => setJournalSaved('Autosaves as you type'), 1500);
  };

  // ── Derived ──────────────────────────────────────────────────────────
  const currentGame = ECHOES_OF_DARKNESS;
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
            <Link href="/characters" className="btn btn-ghost btn-sm">Characters</Link>
            <Link href="/locations" className="btn btn-ghost btn-sm">Locations</Link>
            {isAdmin && (
              <Link href="/admin/characters" className="btn btn-ghost btn-sm">Admin</Link>
            )}
            <span style={{ fontSize: 13, color: 'var(--ink-text-2)' }}>{session?.user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button>
          </div>
        </div>

        <div className="dash-body">
          <div className="dash-hero">
            <span className="eyebrow">Echoes of Darkness · Call of Cthulhu</span>
            <h1>The excavation awaits.</h1>
            <p>Seven investigators. A 17-year dig. Something ancient below.</p>
          </div>

          <div className="stat-row">
            <div className="stat-card"><div className="stat-num">7</div><div className="stat-label">Investigators</div></div>
            <div className="stat-card"><div className="stat-num">3</div><div className="stat-label">Active scenes</div></div>
            <div className="stat-card"><div className="stat-num">{rollCount}</div><div className="stat-label">Dice rolled</div></div>
          </div>

          <div className="section-label">Campaign</div>
          <div className="game-grid">
            <div className="game-card" onClick={openGame}>
              <div className={`game-card-art ${ECHOES_OF_DARKNESS.art}`}><span className="sys-tag">{ECHOES_OF_DARKNESS.system}</span></div>
              <div className="game-card-body">
                <h3>{ECHOES_OF_DARKNESS.name}</h3>
                <p>{ECHOES_OF_DARKNESS.description}</p>
                <div className="game-card-meta"><span>{ECHOES_OF_DARKNESS.lastPlayed}</span><span>Enter →</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* (create game modal removed — single hardcoded campaign) */}
      <div style={{ display: 'none' }}>
      </div>

      {/* ============ GAME / VTT VIEW ============ */}
      <div className={`view${view === 'game' ? ' active' : ''}`} id="view-game">
        <div className="game-topbar">
          <button className="btn btn-ghost btn-sm" onClick={backToDashboard}>← Dashboard</button>
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
              {[
                { id: 'chat', label: 'Chat' },
                { id: 'characters', label: 'Characters' },
                { id: 'compendium', label: 'Compendium' },
                { id: 'journal', label: 'Journal' },
                { id: 'mission', label: 'Mission' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  className={`rp-tab${activePane === id ? ' active' : ''}`}
                  onClick={() => setActivePane(id)}
                >
                  {label}
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
                  value={journals[ECHOES_OF_DARKNESS.id] ?? ''}
                  onChange={e => saveJournal(e.target.value)}
                />
                <div className="journal-saved">{journalSaved}</div>
              </div>
            </div>

            {/* Mission Details pane */}
            <div className={`rp-pane${activePane === 'mission' ? ' active' : ''}`} style={{ overflowY: 'auto', padding: '14px 12px', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-text-2)', marginBottom: 10 }}>
                Mission Details
              </div>

              {/* Arthur Butler briefing card */}
              <div
                style={missionCard}
                onClick={() => openButler()}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && openButler()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/arthur-butler.jpeg" alt="Arthur Butler" style={missionCardImg} />
                <div style={missionCardOverlay}>
                  <div style={missionCardBadge}>CONFIDENTIAL</div>
                  <div style={missionCardTitle}>Mission Briefing</div>
                  <div style={missionCardSub}>Arthur Butler · Legal Rep.</div>
                  <div style={missionCardHint}>▶ Click to open</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toastVisible ? ' show' : ''}`}>{toastMsg}</div>

      {/* Butler audio — always mounted so it can be preloaded */}
      <audio ref={butlerAudioRef} src="/butler-intro-1.mp3" preload="metadata" />

      {/* Butler briefing overlay */}
      {butlerOpen && (
        <div style={butlerBackdrop} onClick={closeButler}>
          <div style={butlerOverlay} onClick={e => e.stopPropagation()}>
            {/* Left: photograph */}
            <div style={butlerPhotoCol}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/arthur-butler.jpeg"
                alt="Arthur Butler"
                style={butlerPhoto}
                onClick={e => openButler(e)}
                title="Click to replay"
              />
              <div style={butlerPhotoCaption}>Click photograph to replay</div>
            </div>

            {/* Right: briefing text */}
            <div style={butlerTextCol}>
              <div style={butlerStamp}>CONFIDENTIAL</div>
              <h2 style={butlerHeading}>Mission Briefing</h2>
              <div style={butlerDivider} />
              <div style={butlerScroll}>
                <p style={butlerPara}>Welcome everyone. Let us begin.</p>
                <p style={butlerPara}>
                  My name is Arthur Butler and I am the legal representative of a benefactor who shall be unnamed.
                </p>
                <p style={butlerPara}>
                  You have all been summoned here to continue an excavation that was started 17 years ago.
                  My benefactor has spent a substantial amount of resources to find a subterranean chamber
                  that for better or for worse — contains an object that is of importance to them.
                  Alas, we have not made enough progress to even locate this chamber.
                </p>
                <p style={butlerPara}>
                  You will all be given one year to locate this chamber. You will be provided with adequate
                  resources to help you on your quest, but please be warned.
                </p>
                <p style={{ ...butlerPara, ...butlerWarning }}>
                  This is an operation that is not allowed to have any eyes apart from yours.
                  If this gains unnecessary visibility, we will pull all of our support and resources.
                </p>
                <p style={butlerPara}>
                  You all have agreed to join this mission for your individual motives and my benefactor
                  will fulfill all of them on completion.
                </p>
              </div>
              <div style={butlerClose}>
                <button className="btn btn-ghost btn-sm" onClick={closeButler} style={{ color: 'var(--ink-text-2)', marginTop: 8 }}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Music Player — Admin only */}
      {isAdmin && (
        <>
          <audio ref={audioRef} src="/soundtrack-1.mp3" loop preload="metadata" />
          <div style={musicBarStyle}>
            <div style={musicInfo}>
              <span style={musicNote}>{musicPlaying ? '♫' : '♩'}</span>
              <div>
                <div style={musicTitle}>Echoes of Darkness</div>
                <div style={musicSub}>Campaign Soundtrack</div>
              </div>
            </div>
            <button
              className="btn btn-sm"
              style={musicPlaying ? playBtnActive : playBtn}
              onClick={() => setMusicPlaying(p => !p)}
              title={musicPlaying ? 'Pause music' : 'Play music'}
            >
              {musicPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <div style={volRow}>
              <span style={volIcon}>🔈</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={musicVolume}
                onChange={e => setMusicVolume(Number(e.target.value))}
                style={volSlider}
                title={`Volume: ${Math.round(musicVolume * 100)}%`}
              />
              <span style={volIcon}>🔊</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Mission pane card (right panel) ──────────────────────────────────
const missionCard: React.CSSProperties = {
  position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
  cursor: 'pointer', border: '1px solid var(--brass-dim)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
};
const missionCardImg: React.CSSProperties = {
  width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover',
  filter: 'sepia(0.3) brightness(0.75)',
};
const missionCardOverlay: React.CSSProperties = {
  position: 'absolute', inset: 0,
  background: 'linear-gradient(to top, rgba(10,8,6,0.92) 0%, rgba(10,8,6,0.3) 55%, transparent 100%)',
  padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
};
const missionCardBadge: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '2px',
  color: 'var(--blood)', border: '1px solid var(--blood)',
  display: 'inline-block', padding: '2px 6px', marginBottom: 6, width: 'fit-content',
};
const missionCardTitle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--parchment)', lineHeight: 1.2,
};
const missionCardSub: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--brass)', marginTop: 3,
};
const missionCardHint: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-text-2)', marginTop: 6, letterSpacing: '0.5px',
};

// ── Butler overlay ────────────────────────────────────────────────────
const butlerBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(4,5,8,0.94)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};
const butlerOverlay: React.CSSProperties = {
  display: 'flex', maxWidth: 960, width: '92vw', maxHeight: '88vh',
  background: 'var(--surface)', border: '1px solid var(--brass-dim)',
  borderRadius: 'var(--r-lg)', overflow: 'hidden',
  boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,148,79,0.15)',
  cursor: 'default',
};
const butlerPhotoCol: React.CSSProperties = {
  width: 320, flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column',
};
const butlerPhoto: React.CSSProperties = {
  width: '100%', flex: 1, objectFit: 'cover', display: 'block',
  filter: 'sepia(0.25) brightness(0.9)', cursor: 'pointer',
};
const butlerPhotoCaption: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--surface-2)',
  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--brass)',
  textAlign: 'center', letterSpacing: '0.6px',
};
const butlerTextCol: React.CSSProperties = {
  flex: 1, padding: '32px 36px', display: 'flex', flexDirection: 'column',
  overflowY: 'auto', background: 'var(--ink)',
};
const butlerStamp: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '3px',
  color: 'var(--blood)', border: '1px solid var(--blood)',
  display: 'inline-block', padding: '3px 10px', marginBottom: 14,
  opacity: 0.85,
};
const butlerHeading: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700,
  color: 'var(--parchment)', margin: '0 0 12px',
};
const butlerDivider: React.CSSProperties = {
  height: 1, background: 'var(--brass-dim)', marginBottom: 20, opacity: 0.5,
};
const butlerScroll: React.CSSProperties = { flex: 1, overflowY: 'auto' };
const butlerPara: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.75,
  color: 'var(--parchment)', marginBottom: 16,
};
const butlerWarning: React.CSSProperties = {
  color: '#e8c98a', borderLeft: '3px solid var(--brass-dim)',
  paddingLeft: 14, fontStyle: 'italic',
};
const butlerClose: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', paddingTop: 8,
};

// ── Music player styles ───────────────────────────────────────────────
const musicBarStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 24,
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '10px 18px',
  background: 'rgba(26,31,40,0.96)',
  border: '1px solid var(--brass-dim)',
  borderRadius: 'var(--r-lg)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,148,79,0.1)',
  backdropFilter: 'blur(10px)',
};
const musicInfo: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
};
const musicNote: React.CSSProperties = {
  fontSize: 22, color: 'var(--brass)', lineHeight: 1,
};
const musicTitle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--parchment)', lineHeight: 1.2,
};
const musicSub: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--brass)', letterSpacing: '0.8px', marginTop: 2,
};
const playBtn: React.CSSProperties = {
  background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--parchment)',
  fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 76,
};
const playBtnActive: React.CSSProperties = {
  background: 'rgba(201,148,79,0.15)', borderColor: 'var(--brass-dim)', color: 'var(--brass)',
  fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 76,
};
const volRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
};
const volIcon: React.CSSProperties = {
  fontSize: 13, opacity: 0.7,
};
const volSlider: React.CSSProperties = {
  width: 90, accentColor: 'var(--brass)', cursor: 'pointer',
};
