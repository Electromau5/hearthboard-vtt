'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { DiceRollerPane } from './components/DiceRollerPane';
import { CthulhuReliefModal } from './components/CthulhuReliefModal';
import { InvestigationBoard } from './components/InvestigationBoard';

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
  { id: 's1', locationId: 'loc-miskatonic', name: 'Miskatonic University & Orne Library', short: 'Miskatonic', mapX: 47, mapY: 22 },
  { id: 's2', locationId: 'loc-bellevue',   name: 'Bellevue Psychiatric Isolation Ward',  short: 'Bellevue',   mapX: 14, mapY: 67 },
  { id: 's3', locationId: 'loc-underworld', name: 'Underworld Abattoir & Speakeasy',      short: 'Abattoir',   mapX: 49, mapY: 52 },
  { id: 's4', locationId: 'loc-blackarchive', name: 'Black Archives',                     short: 'Black Archives', mapX: 65, mapY: 47 },
  { id: 's5', locationId: 'loc-docks',      name: 'Federal Quarantine Docks',             short: 'Fed. Docks', mapX: 70, mapY: 18 },
];

const COMPENDIUM = [
  { name: 'Goblin Skirmisher', type: 'Small humanoid', cr: 'CR 1/4', hp: 7 as number | null, color: '#7a9b4f' },
  { name: 'Dire Wolf', type: 'Large beast', cr: 'CR 1', hp: 37 as number | null, color: '#6b6b70' },
  { name: 'Cultist Adept', type: 'Medium humanoid', cr: 'CR 2', hp: 27 as number | null, color: '#8a2f2f' },
  { name: 'Stone Gargoyle', type: 'Medium construct', cr: 'CR 2', hp: 52 as number | null, color: '#8a8a8a' },
  { name: 'Drowned Revenant', type: 'Medium undead', cr: 'CR 4', hp: 68 as number | null, color: '#3f6b6b' },
  { name: 'Young Wyrmling', type: 'Large dragon', cr: 'CR 6', hp: 97 as number | null, color: '#b1483f' },
  { name: 'Lantern of Tides', type: 'Wondrous item', cr: '—', hp: null as number | null, color: '#c9944f' },
  { name: 'Vial of Still Water', type: 'Consumable', cr: '—', hp: null as number | null, color: '#4f9b92' },
];

const CHARACTERS = [
  { id: 'c1', slug: 'dr-alistair-finch',    name: 'Dr. Alistair Finch',       cls: 'The Disgraced Mortician',         hp: 12, maxHp: 12, abilities: { STR: 50, CON: 65, DEX: 75, INT: 85, POW: 75, EDU: 85 }, inventory: [{ name: 'Dissection kit', qty: 1 }, { name: 'Formaldehyde jars', qty: 3 }, { name: 'Scalpel holster', qty: 1 }, { name: 'Mortuary credentials', qty: 1 }] },
  { id: 'c2', slug: 'silas-vance',           name: 'Silas "The Great" Vance',  cls: 'The Blackmailed Illusionist',     hp: 11, maxHp: 11, abilities: { STR: 55, CON: 60, DEX: 85, INT: 75, POW: 70, EDU: 65 }, inventory: [{ name: 'Lockpick kit', qty: 1 }, { name: 'Flash pellets', qty: 4 }, { name: 'Defense cane', qty: 1 }, { name: 'Debt note', qty: 1 }] },
  { id: 'c3', slug: 'julian-sterling',       name: 'Julian Sterling',           cls: 'The Desperate Auteur',            hp: 10, maxHp: 10, abilities: { STR: 45, CON: 55, DEX: 70, INT: 80, POW: 65, EDU: 75 }, inventory: [{ name: '35mm Eyemo camera', qty: 1 }, { name: 'Nitrate film rolls', qty: 4 }, { name: 'Magnesium dish', qty: 1 }, { name: 'Dev kit', qty: 1 }] },
  { id: 'c4', slug: 'thomas-callahan',       name: 'Thomas "Mack" Callahan',   cls: 'The Amnesiac Detective',          hp: 14, maxHp: 14, abilities: { STR: 75, CON: 70, DEX: 65, INT: 70, POW: 65, EDU: 60 }, inventory: [{ name: 'Colt M1911', qty: 1 }, { name: 'Spare magazines', qty: 3 }, { name: 'Trench knife', qty: 1 }, { name: 'PI badge', qty: 1 }] },
  { id: 'c5', slug: 'richard-graves',        name: 'Richard Pickman Graves',   cls: 'The Macabre Visionary',           hp: 9,  maxHp: 9,  ac: 0, abilities: { STR: 40, CON: 45, DEX: 80, INT: 85, POW: 80, EDU: 70 }, inventory: [{ name: 'Charcoal sketchbook', qty: 1 }, { name: 'Bristle brushes', qty: 1 }, { name: 'Oil paint tubes', qty: 1 }, { name: 'Cemetery sketches', qty: 1 }] },
  { id: 'c6', slug: 'arthur-wright',         name: 'Arthur Wright',             cls: 'The Non-Euclidean Architect',     hp: 12, maxHp: 12, abilities: { STR: 55, CON: 65, DEX: 60, INT: 90, POW: 70, EDU: 85 }, inventory: [{ name: 'Brass compass', qty: 1 }, { name: 'Theodolite', qty: 1 }, { name: 'Dynamite sticks', qty: 2 }, { name: 'Blueprint parchment', qty: 1 }] },
  { id: 'c7', slug: 'percival-winthrop',     name: 'Percival Winthrop',         cls: 'The Ruined Tycoon',               hp: 11, maxHp: 11, abilities: { STR: 50, CON: 55, DEX: 55, INT: 80, POW: 75, EDU: 85 }, inventory: [{ name: 'Savile Row suit', qty: 1 }, { name: 'Gold pocket watch', qty: 1 }, { name: '.32 ACP revolver', qty: 1 }, { name: 'Bankrupt ledger', qty: 1 }] },
];

// ── Briefing entries ─────────────────────────────────────────────────
type BriefingSection = {
  audio: string;
  paragraphs: string[];
};

type Briefing = {
  id: string;
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  sections: BriefingSection[];
  cardHint?: string;
  bgSong?: string;
};

const BRIEFINGS: Briefing[] = [
  {
    id: 'butler',
    image: '/arthur-butler.jpeg',
    badge: 'CONFIDENTIAL',
    title: 'Mission Briefing',
    subtitle: 'Arthur Butler · Legal Representative',
    cardHint: 'Arthur Butler · Legal Rep.',
    sections: [
      {
        audio: '/butler-intro-1.mp3',
        paragraphs: [
          'Welcome everyone. Let us begin.',
          'My name is Arthur Butler and I am the legal representative of a benefactor who shall be unnamed.',
          'You have all been summoned here to continue an excavation that was started 17 years ago. My benefactor has spent a substantial amount of resources to find a subterranean chamber that for better or for worse — contains an object that is of importance to them. Alas, we have not made enough progress to even locate this chamber.',
          'You will all be given one year to locate this chamber. You will be provided with adequate resources to help you on your quest, but please be warned.',
          'This is an operation that is not allowed to have any eyes apart from yours. If this gains unnecessary visibility, we will pull all of our support and resources.',
          'You all have agreed to join this mission for your individual motives and my benefactor will fulfill all of them on completion.',
        ],
      },
      {
        audio: '/butler-intro-2.mp3',
        paragraphs: [
          'We operate under the code name Project Deep Bedrock. You will find that my benefactors\' resources are extensive, but they are not infinite, nor are they without rigorous control.',
          'To facilitate your progress, we have established a sophisticated logistical framework. Depending on the complexity of your requirements, we can provide anything from standard heavy excavation equipment to sensitive, black budget military hardware.',
          'However, understand this. Every item requisitioned increases the noise this mission creates. We monitor this exposure with clinical precision.',
          'Should your activities draw the attention of federal task forces or local authorities, do not expect bail or legal intervention. We will trigger our standard severance protocol — liquidating all assets, dissolving your contacts and removing any trace of your existence.',
          'You are on your own the moment you become a liability.',
        ],
      },
      {
        audio: '/butler-intro-3.mp3',
        paragraphs: [
          'For your research, you will be granted access to the Black Archive, located within a decommissioned municipal cold storage warehouse in Boston Harbour.',
          'It contains a collection of artefacts curated over decades. Use them to decode the pre-human glyphs and structural enigmas you will undoubtedly face.',
          'I must warn you, these items are not merely academic curiosities. They exact a toll — psychological, physiological and perhaps existential.',
          'We provide the tools, but we do not guarantee your sanity in their handling.',
        ],
      },
      {
        audio: '/butler-intro-4.mp3',
        paragraphs: [
          'You have one year. The astronomical alignments are shifting and our window of opportunity is narrow. We have provided you with the necessary data to begin your sifting process in Boston.',
          'Do not look for us. Do not seek to identify my benefactor. Focus on the tomb and ensure that when it is unsealed, the primary objective is delivered to our couriers without incident.',
          'Everything else you find within — the relics, the gold, the artefacts — is yours to claim. That is the agreement.',
          'Good day. We will be in touch when the first drop is ready.',
        ],
      },
    ],
  },
  {
    id: 'old-man',
    image: '/old-man-1.jpeg',
    badge: 'WITNESS ACCOUNT',
    title: "A Warning from the Docks",
    subtitle: 'Anonymous · Innsmouth Harbour',
    cardHint: 'Anonymous · Innsmouth Harbour',
    sections: [
      {
        audio: '/old-man-0.mp3',
        paragraphs: [
          "I used to live in this fishing town called Innsmouth near Newburyport.",
          "I never thought that the town could get any weirder till this guy showed up asking questions about the town's history.",
          "Apparently he had access to information that wasn't made public and he wanted to learn more.",
        ],
      },
      {
        audio: '/old-man-1.mp3',
        paragraphs: [
          "That poor bastard. He was asking too many questions and in this town, everyone knows that'll get ya in deep trouble.",
          "The last I heard of him was that he went insane and drowned himself in the waters of Innsmouth, but I know that's complete horseshit.",
          "There's something down there. Something that was calling him and he answered the call.",
        ],
      },
      {
        audio: '/old-man-2.mp3',
        paragraphs: [
          "I'm probably not going to be here tomorrow when I tell you what I'm about to tell you, but if that means bringing some peace to that poor soul, so be it.",
          "The name 'Obed Marsh' would probably ring a bell. He's the primary reason why this town survived a 100 years longer than it should've have.",
          "You need to find the last remaining family member of the Marsh family. That will get you closer to what you were asking about — a lot closer.",
          "All I know is that the Marshes abandoned Innsmouth a long time back. God knows where they live now.",
        ],
      },
    ],
  },
  {
    id: 'mobster',
    image: '/mobster-1.jpeg',
    badge: 'INTERCEPTED',
    title: 'A Business Arrangement',
    subtitle: 'Unknown Subject · Surveillance Recording',
    cardHint: 'Unknown Subject · Surveillance',
    bgSong: '/speakeasy-1.mp3',
    sections: [
      {
        audio: '/mobster-2.mp3',
        paragraphs: [
          "The guy you're looking for goes by the name 'Amazo the Amazing'. I know. Stupid name right?",
          "Anyway, he's built a reputation as the primary magic act in these parts, but the guy — he's really ambitious. So he asks my old man for a loan.",
          "However, in return the old man doesn't ask him for the money back. He instead gets him to give away his secrets. Shrewd bastard.",
          "Now he knows everything about this guy's secrets and is blackmailing him for a larger cut of the profits.",
        ],
      },
      {
        audio: '/mobster-1.mp3',
        paragraphs: [
          "Yeah. My father has been behind that guy for a couple of years now.",
          "He knows he's a fraud, but he's also quite useful. He's not stupid, that one. He knows things — things that could very well be helpful for both of us.",
          "So we made a deal — I take the old man out of the equation and he and I form… a business partnership. Whatever he finds in that tomb is gonna make him very famous and me very rich.",
        ],
      },
    ],
  },
  {
    id: 'attendant',
    image: '/attendant-1.png',
    badge: 'FACILITY CONTACT',
    title: 'The Chief Attendant',
    subtitle: 'Bellevue Psychiatric Isolation Ward',
    cardHint: 'Bellevue · Chief Attendant',
    sections: [
      {
        audio: '/attendant-1.mp3',
        paragraphs: [
          "Hello.",
          "I'm the chief attendant at this......magical place.",
          "I was told about your arrival.",
          "I would be happy to help, but please keep in mind that our patient records are strictly confidential unless they have been approved to be released by the patient themselves or a family member.",
          "I think you will like it here.",
        ],
      },
    ],
  },
  {
    id: 'armitage',
    image: '/dr-armitage.jpeg',
    badge: 'RESTRICTED ACCESS',
    title: 'Miskatonic University & Orne Library',
    subtitle: 'Dr. Henry Armitage · Head Librarian',
    cardHint: 'Dr. Armitage · Orne Library',
    sections: [
      {
        audio: '/dr-armitage-1.mp3',
        paragraphs: [
          "There was an incident several years back — one that I would rather like to forget, but circumstances beyond my control have forced to retain memories of that ghastly night.",
          "His name was Wilbur Whatley. The smell. That wretched smell drove my dog insane to the point where it broke loose and tore his flesh apart.",
          "I'm not at liberty to divulge what we saw when we discovered his lifeless body, but I can tell you right now — he was trying to steal our copy of that 'unspeakable' book.",
          "Because of that day, the book is sealed within our archives and only can be seen with special permission under my observation.",
        ],
      },
    ],
  },
];

// ── Types ────────────────────────────────────────────────────────────
interface Game { id: string; name: string; system: string; description: string; art: string; lastPlayed: string; }

interface Token { id: string; label: string; fullName: string; color: string; x: number; y: number; hp: number; maxHp: number; avatarUrl?: string; }
interface StickyNote { id: string; text: string; x: number; y: number; sceneId: string; author: string; }
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
  const [tokensByScene, setTokensByScene] = useState<Record<string, Token[]>>({ s1: [], s2: [], s3: [], s4: [], s5: [] });
  const [mapZoomedTo, setMapZoomedTo] = useState<string | null>(null);
  const [locationImages, setLocationImages] = useState<Record<string, string>>({});
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
  const [briefingBgActive, setBriefingBgActive] = useState(false);
  const [briefingBgVolume, setBriefingBgVolume] = useState(0.75);
  const [activeBriefing, setActiveBriefing] = useState<Briefing | null>(null);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [charAvatars, setCharAvatars] = useState<Record<string, string>>({});
  const [screenEffect, setScreenEffect] = useState<{ id: string; label: string; duration: number; triggeredAt: number; data?: Record<string, unknown> } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [videoModalSrc, setVideoModalSrc] = useState<string | null>(null);
  const [reliefModalOpen, setReliefModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [boardView, setBoardView] = useState<'map' | 'board'>('map');
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [dragNotePos, setDragNotePos] = useState<{ id: string; x: number; y: number } | null>(null);
  // Track triggeredAt values we've already displayed so one-shot effects (visions)
  // don't replay on every poll while the blob entry is still live.
  const shownEffectsRef = useRef<Set<number>>(new Set());

  // Refs
  const dragPayloadRef = useRef<{ kind: 'tray'; color: string; label: string; fullName?: string; avatarUrl?: string; hp?: number; maxHp?: number } | { kind: 'compendium'; idx: number } | null>(null);
  const dragTokRef = useRef<{ id: string; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const dragPosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const tokenSeqRef = useRef(1);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const currentSceneIdRef = useRef(currentSceneId);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const dragNoteRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const dragNotePosRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const editingNoteIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const briefingAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakeasyBgRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { currentSceneIdRef.current = currentSceneId; }, [currentSceneId]);
  useEffect(() => { editingNoteIdRef.current = editingNoteId; }, [editingNoteId]);

  // Fetch character assignments on mount, then load avatar URLs for claimed characters
  useEffect(() => {
    fetch('/api/characters/assignments', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : {})
      .then(async (data: Record<string, string>) => {
        setAssignments(data);
        // Auto-select the player's own character in the pane
        if (session && session.user.role !== 'admin') {
          const mySlug = Object.entries(data).find(([, uid]) => uid === session.user.id)?.[0];
          const mine = CHARACTERS.find(c => c.slug === mySlug);
          if (mine) setActiveCharId(mine.id);
        }
        // Fetch avatar URLs for claimed characters
        const claimedSlugs = Object.keys(data);
        if (claimedSlugs.length > 0) {
          const avatarMap: Record<string, string> = {};
          await Promise.all(claimedSlugs.map(async (slug) => {
            try {
              const res = await fetch(`/api/admin/characters/${slug}`, { cache: 'no-store' });
              if (!res.ok) return;
              const char = await res.json() as { avatar?: string };
              if (char.avatar) avatarMap[slug] = char.avatar;
            } catch {}
          }));
          setCharAvatars(avatarMap);
        }
      });
  }, [session]);

  // Fetch location primary images for the map info panel
  useEffect(() => {
    fetch('/api/admin/locations', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then((locs: { id: string; primaryImage?: string }[]) => {
        const imgs: Record<string, string> = {};
        for (const loc of locs) {
          if (loc.primaryImage) imgs[loc.id] = loc.primaryImage;
        }
        setLocationImages(imgs);
      })
      .catch(() => {});
  }, []);

  // Load and play briefing audio when active briefing or section changes
  useEffect(() => {
    const audio = briefingAudioRef.current;
    if (!audio) return;
    if (activeBriefing) {
      audio.src = activeBriefing.sections[activeSectionIdx].audio;
      audio.load();
      audio.play().catch(() => {});
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [activeBriefing, activeSectionIdx]);

  // Sync audio with music controls — paused while briefing bg is active
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = musicVolume;
    if (musicPlaying && !briefingBgActive) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [musicPlaying, musicVolume, briefingBgActive]);

  // Play briefing background song (e.g. Speakeasy) when a briefing with bgSong opens
  useEffect(() => {
    const bgAudio = speakeasyBgRef.current;
    if (!bgAudio) return;
    if (activeBriefing?.bgSong) {
      setBriefingBgActive(true);
      bgAudio.src = activeBriefing.bgSong;
      bgAudio.volume = briefingBgVolume;
      bgAudio.loop = true;
      bgAudio.load();
      bgAudio.play().catch(() => {});
    } else {
      setBriefingBgActive(false);
      bgAudio.pause();
      bgAudio.currentTime = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBriefing]);

  // Sync briefing bg volume in real time
  useEffect(() => {
    const bgAudio = speakeasyBgRef.current;
    if (bgAudio) bgAudio.volume = briefingBgVolume;
  }, [briefingBgVolume]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [chatItems]);

  // Poll sticky notes for all players — skip update while a note is open for editing
  useEffect(() => {
    const load = () =>
      fetch('/api/notes', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : [])
        .then((notes: StickyNote[]) => {
          if (!editingNoteIdRef.current) setStickyNotes(notes);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (reliefModalOpen) {
      document.body.classList.add('eff-primal-horror');
    } else {
      document.body.classList.remove('eff-primal-horror');
    }
    return () => document.body.classList.remove('eff-primal-horror');
  }, [reliefModalOpen]);

  // Global mouse handlers for token and note dragging
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (mapWrapRef.current) {
        if (dragTokRef.current) {
          dragTokRef.current.moved = true;
          const rect = mapWrapRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left - dragTokRef.current.offsetX;
          const y = e.clientY - rect.top - dragTokRef.current.offsetY;
          const pos = { id: dragTokRef.current.id, x, y };
          dragPosRef.current = pos;
          setDragPos({ ...pos });
        }
        if (dragNoteRef.current) {
          const rect = mapWrapRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left - dragNoteRef.current.offsetX;
          const y = e.clientY - rect.top - dragNoteRef.current.offsetY;
          const pos = { id: dragNoteRef.current.id, x, y };
          dragNotePosRef.current = pos;
          setDragNotePos({ ...pos });
        }
      }
    };
    const onMouseUp = () => {
      if (dragTokRef.current) {
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
      }
      if (dragNoteRef.current) {
        const { id } = dragNoteRef.current;
        const pos = dragNotePosRef.current;
        if (pos) {
          setStickyNotes(prev => prev.map(n => n.id === id ? { ...n, x: pos.x, y: pos.y } : n));
          fetch(`/api/notes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: pos.x, y: pos.y }),
          }).catch(() => {});
        }
        dragNoteRef.current = null;
        dragNotePosRef.current = null;
        setDragNotePos(null);
      }
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

  // Poll for admin-triggered screen effects (non-admin players only)
  useEffect(() => {
    if (session?.user?.role === 'admin') return;
    const poll = async () => {
      try {
        const res = await fetch('/api/effects');
        if (!res.ok) return;
        const data = await res.json();
        if (data && shownEffectsRef.current.has(data.triggeredAt)) return;
        setScreenEffect(data);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [session]);

  const backToDashboard = () => {
    setView('dashboard');
  };

  const openBriefing = (briefing: Briefing, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveBriefing(briefing);
    setActiveSectionIdx(0);
  };

  const replayBriefing = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = briefingAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const closeBriefing = () => {
    setActiveBriefing(null);
    const audio = briefingAudioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
  };

  const addToken = (t: { label: string; color: string; x: number; y: number; hp: number; maxHp: number; fullName?: string; avatarUrl?: string }) => {
    const id = 't' + tokenSeqRef.current++;
    const tok: Token = { id, label: t.label, fullName: t.fullName || t.label, color: t.color, x: t.x, y: t.y, hp: t.hp, maxHp: t.maxHp, avatarUrl: t.avatarUrl };
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
      addToken({ label: payload.label, color: payload.color, x, y, hp: payload.hp ?? 20, maxHp: payload.maxHp ?? 20, fullName: payload.fullName, avatarUrl: payload.avatarUrl });
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

  const downloadExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/campaign/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journal: journals[ECHOES_OF_DARKNESS.id] ?? '' }),
      });
      if (!res.ok) { showToast('Export failed'); return; }
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `echoes-of-darkness-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast('Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  const createNote = useCallback((x: number, y: number) => {
    const id = 'n' + Date.now();
    const note: StickyNote = { id, text: '', x, y, sceneId: currentSceneIdRef.current, author: session?.user?.name ?? 'Unknown' };
    setStickyNotes(prev => [...prev, note]);
    setEditingNoteId(id);
    setEditingNoteText('');
    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    }).catch(() => {});
  }, [session]);

  const saveNoteText = useCallback((id: string, text: string) => {
    setStickyNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
    setEditingNoteId(null);
    fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  }, []);

  const deleteNote = useCallback((id: string) => {
    setStickyNotes(prev => prev.filter(n => n.id !== id));
    setEditingNoteId(prev => prev === id ? null : prev);
    fetch(`/api/notes/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────
  const currentGame = ECHOES_OF_DARKNESS;
  const currentTokens = tokensByScene[currentSceneId] ?? [];
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

      {/* Screen effect overlay (triggered by admin) */}
      {screenEffect && (
        <EffectLayer
          effect={screenEffect}
          onExpire={() => {
            shownEffectsRef.current.add(screenEffect.triggeredAt);
            setScreenEffect(null);
          }}
        />
      )}

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
              <Link href="/admin/experience" className="btn btn-ghost btn-sm">Experience</Link>
            )}
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
          {isAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); downloadExport(); }}
                disabled={exportLoading}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.5px', opacity: exportLoading ? 0.6 : 1 }}
              >
                {exportLoading ? 'Generating…' : '↓ Export Session (.md)'}
              </button>
            </div>
          )}
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
                onClick={() => {
                  setCurrentSceneId(s.id);
                  setMapZoomedTo(prev => prev === s.id ? null : s.id);
                  setSelectedTokenId(null);
                }}
              >
                {s.short}
              </button>
            ))}
          </div>
          <button
            className={`scene-chip${boardView === 'board' ? ' active' : ''}`}
            style={{ marginLeft: 8, borderColor: boardView === 'board' ? 'var(--brass)' : undefined, color: boardView === 'board' ? 'var(--brass)' : undefined }}
            onClick={() => setBoardView(v => v === 'map' ? 'board' : 'map')}
            title="Toggle case investigation board"
          >
            ⬡ Case Board
          </button>
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
                  { id: 'note', icon: '✏', label: 'Note' },
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
                {CHARACTERS.filter(c => !!assignments[c.slug]).map((char) => {
                  const charIdx = CHARACTERS.indexOf(char);
                  const color = TOKEN_COLORS[charIdx % TOKEN_COLORS.length];
                  const avatarUrl = charAvatars[char.slug];
                  const words = char.name.replace(/[^a-zA-Z ]/g, '').split(' ').filter(Boolean);
                  const initials = words.length >= 2
                    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                    : (words[0]?.[0] ?? '?').toUpperCase();
                  return (
                    <div
                      key={char.slug}
                      className="tray-token"
                      style={{
                        background: avatarUrl ? 'transparent' : color,
                        overflow: 'hidden',
                        position: 'relative',
                        border: avatarUrl ? '2px solid var(--brass-dim)' : undefined,
                      }}
                      draggable
                      onDragStart={() => {
                        dragPayloadRef.current = { kind: 'tray', color, label: initials, fullName: char.name, hp: char.hp, maxHp: char.maxHp, avatarUrl };
                      }}
                      title={char.name}
                    >
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={char.name}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                          draggable={false}
                        />
                      ) : initials}
                    </div>
                  );
                })}
                {CHARACTERS.filter(c => !!assignments[c.slug]).length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-text-2)', padding: '4px 0', lineHeight: 1.5 }}>
                    No investigators claimed yet.
                  </div>
                )}
              </div>
              <div className="tray-hint">Drag a token onto the map to place it. Drag placed tokens to move them.</div>
            </div>
          </div>

          {/* Case board — replaces map when toggled */}
          {boardView === 'board' && (
            <InvestigationBoard username={session?.user?.name ?? 'Unknown'} />
          )}

          {/* Center map */}
          <div
            className={`map-wrap${tool === 'note' ? ' tool-note' : ''}`}
            ref={mapWrapRef}
            style={{ display: boardView === 'board' ? 'none' : undefined }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleMapDrop}
            onMouseDown={e => {
              const t = e.target as HTMLElement;
              const isBg = t.id === 'map-canvas' || t.id === 'map-grid-overlay' || t === mapWrapRef.current
                || t.classList.contains('map-bg-img') || t.classList.contains('map-zoom-inner');
              if (isBg) {
                setSelectedTokenId(null);
                if (mapZoomedTo) setMapZoomedTo(null);
                if (tool === 'note' && !mapZoomedTo && mapWrapRef.current) {
                  const rect = mapWrapRef.current.getBoundingClientRect();
                  createNote(e.clientX - rect.left, e.clientY - rect.top);
                }
              }
            }}
          >
            <div className="map-canvas" id="map-canvas">
              <div
                className="map-zoom-inner"
                style={{
                  transformOrigin: mapZoomedTo
                    ? `${SCENES.find(s => s.id === mapZoomedTo)?.mapX ?? 50}% ${SCENES.find(s => s.id === mapZoomedTo)?.mapY ?? 50}%`
                    : '50% 50%',
                  transform: mapZoomedTo ? 'scale(2.5)' : 'scale(1)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/map-v1.jpeg"
                  alt="Campaign map"
                  className="map-bg-img"
                  draggable={false}
                />
                {SCENES.map(s => (
                  <button
                    key={s.id}
                    className={`loc-marker-btn${s.id === currentSceneId ? ' active' : ''}`}
                    style={{ left: `${s.mapX}%`, top: `${s.mapY}%` }}
                    onClick={e => {
                      e.stopPropagation();
                      setCurrentSceneId(s.id);
                      setMapZoomedTo(prev => prev === s.id ? null : s.id);
                      setSelectedTokenId(null);
                    }}
                    title={s.name}
                  >
                    <div className="loc-pin" />
                    <div className="loc-pin-label">{s.short}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className={`map-grid-overlay${gridOn ? '' : ' hidden'}`} id="map-grid-overlay" />
            <div className="map-vignette" />
            {mapZoomedTo && (() => {
              const scene = SCENES.find(s => s.id === mapZoomedTo);
              const img = scene ? locationImages[scene.locationId] : undefined;
              const isDocks = scene?.locationId === 'loc-docks';
              const isSpeakeasy = scene?.locationId === 'loc-underworld';
              const isBellevue = scene?.locationId === 'loc-bellevue';
              const oldManBriefing = BRIEFINGS.find(b => b.id === 'old-man');
              const mobsterBriefing = BRIEFINGS.find(b => b.id === 'mobster');
              const attendantBriefing = BRIEFINGS.find(b => b.id === 'attendant');
              return (
                <div className="loc-info-panel">
                  <button className="loc-close-btn" onClick={() => setMapZoomedTo(null)}>✕</button>
                  {scene && <div className="loc-info-name">{scene.name}</div>}
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={scene?.name} className="loc-info-img" />
                  ) : (
                    <div className="loc-info-placeholder">No image set — upload one in Admin → Locations</div>
                  )}

                  {/* Witness account — only shown on the Docks */}
                  {isDocks && oldManBriefing && (
                    <>
                      <div style={{ height: 1, background: 'var(--brass-dim)', opacity: 0.5 }} />
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-text-2)' }}>
                        Witness Account
                      </div>
                      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                      <div
                        style={{
                          position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
                          cursor: 'pointer', border: '1px solid var(--brass-dim)',
                          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                        }}
                        onClick={() => openBriefing(oldManBriefing)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && openBriefing(oldManBriefing)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={oldManBriefing.image}
                          alt={oldManBriefing.title}
                          style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover', filter: 'sepia(0.35) brightness(0.7)' }}
                        />
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(to top, rgba(10,8,6,0.92) 0%, rgba(10,8,6,0.25) 60%, transparent 100%)',
                          padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '2px', color: 'var(--blood)', border: '1px solid var(--blood)', display: 'inline-block', padding: '1px 5px', marginBottom: 4, width: 'fit-content' }}>
                            {oldManBriefing.badge}
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--parchment)', lineHeight: 1.2 }}>
                            {oldManBriefing.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--brass)', marginTop: 3 }}>
                            Anonymous · Innsmouth Harbour
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', marginTop: 4, letterSpacing: '0.5px' }}>
                            ▶ Click to open
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Business Arrangement — only shown on the Speakeasy */}
                  {isSpeakeasy && mobsterBriefing && (
                    <>
                      <div style={{ height: 1, background: 'var(--brass-dim)', opacity: 0.5 }} />
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-text-2)' }}>
                        Intercepted Recording
                      </div>
                      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                      <div
                        style={{
                          position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
                          cursor: 'pointer', border: '1px solid var(--brass-dim)',
                          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                        }}
                        onClick={() => openBriefing(mobsterBriefing)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && openBriefing(mobsterBriefing)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mobsterBriefing.image}
                          alt={mobsterBriefing.title}
                          style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover', filter: 'sepia(0.35) brightness(0.7)' }}
                        />
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(to top, rgba(10,8,6,0.92) 0%, rgba(10,8,6,0.25) 60%, transparent 100%)',
                          padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '2px', color: 'var(--blood)', border: '1px solid var(--blood)', display: 'inline-block', padding: '1px 5px', marginBottom: 4, width: 'fit-content' }}>
                            {mobsterBriefing.badge}
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--parchment)', lineHeight: 1.2 }}>
                            {mobsterBriefing.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--brass)', marginTop: 3 }}>
                            Unknown Subject · Surveillance
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', marginTop: 4, letterSpacing: '0.5px' }}>
                            ▶ Click to open
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Facility contact — only shown on Bellevue */}
                  {isBellevue && attendantBriefing && (
                    <>
                      <div style={{ height: 1, background: 'var(--brass-dim)', opacity: 0.5 }} />
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-text-2)' }}>
                        Facility Contact
                      </div>
                      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                      <div
                        style={{
                          position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
                          cursor: 'pointer', border: '1px solid var(--brass-dim)',
                          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                        }}
                        onClick={() => openBriefing(attendantBriefing)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && openBriefing(attendantBriefing)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={attendantBriefing.image}
                          alt={attendantBriefing.title}
                          style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover', filter: 'sepia(0.35) brightness(0.7)' }}
                        />
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(to top, rgba(10,8,6,0.92) 0%, rgba(10,8,6,0.25) 60%, transparent 100%)',
                          padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '2px', color: 'var(--blood)', border: '1px solid var(--blood)', display: 'inline-block', padding: '1px 5px', marginBottom: 4, width: 'fit-content' }}>
                            {attendantBriefing.badge}
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--parchment)', lineHeight: 1.2 }}>
                            {attendantBriefing.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--brass)', marginTop: 3 }}>
                            Bellevue · Chief Attendant
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', marginTop: 4, letterSpacing: '0.5px' }}>
                            ▶ Click to open
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
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
                  style={{ left: pos.x, top: pos.y, background: tok.avatarUrl ? 'transparent' : tok.color, overflow: 'hidden', position: 'relative', ['--hp-pct' as string]: hpPct } as React.CSSProperties}
                  onMouseDown={e => handleTokenMouseDown(e, tok)}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="hp-ring" style={{ position: 'absolute', inset: 0, zIndex: 2 }} />
                  {tok.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tok.avatarUrl}
                      alt={tok.label}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                      draggable={false}
                    />
                  ) : tok.label}
                  <div className="token-label" style={{ position: 'absolute', zIndex: 3 }}>{tok.fullName} · {tok.hp}/{tok.maxHp}</div>
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

            {/* Sticky Notes */}
            {stickyNotes.filter(n => n.sceneId === currentSceneId).map(note => {
              const livePos = dragNotePos?.id === note.id ? dragNotePos : null;
              const nx = livePos ? livePos.x : note.x;
              const ny = livePos ? livePos.y : note.y;
              const isEditing = editingNoteId === note.id;
              return (
                <div
                  key={note.id}
                  className="sticky-note"
                  style={{ left: nx, top: ny }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                >
                  <div
                    className="sticky-note-handle"
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!mapWrapRef.current) return;
                      const rect = mapWrapRef.current.getBoundingClientRect();
                      dragNoteRef.current = {
                        id: note.id,
                        offsetX: e.clientX - rect.left - note.x,
                        offsetY: e.clientY - rect.top - note.y,
                      };
                    }}
                  >
                    <span className="sticky-note-author">{note.author}</span>
                    <button
                      className="sticky-note-delete"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => deleteNote(note.id)}
                    >✕</button>
                  </div>
                  {isEditing ? (
                    <textarea
                      className="sticky-note-textarea"
                      autoFocus
                      value={editingNoteText}
                      onChange={e => setEditingNoteText(e.target.value)}
                      onBlur={() => saveNoteText(note.id, editingNoteText)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') saveNoteText(note.id, editingNoteText);
                        e.stopPropagation();
                      }}
                    />
                  ) : (
                    <div
                      className="sticky-note-text"
                      onClick={() => {
                        setEditingNoteId(note.id);
                        setEditingNoteText(note.text);
                      }}
                    >
                      {note.text || <span className="sticky-note-placeholder">Click to write…</span>}
                    </div>
                  )}
                </div>
              );
            })}

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
                { id: 'compendium', label: 'Resources' },
                { id: 'journal', label: 'Journal' },
                { id: 'mission', label: 'Mission' },
                { id: 'roll', label: 'Roll' },
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
              {(() => {
                const myId = session?.user?.id ?? '';
                const mySlug = Object.entries(assignments).find(([, uid]) => uid === myId)?.[0];
                const visibleChars = isAdmin
                  ? CHARACTERS
                  : CHARACTERS.filter(c => c.slug === mySlug);

                if (visibleChars.length === 0) {
                  return (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-text-2)', fontSize: 13 }}>
                      <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.4 }}>⬡</div>
                      No investigator assigned.
                      <br />
                      <a href="/characters" style={{ color: 'var(--brass)', textDecoration: 'none', fontSize: 12, marginTop: 8, display: 'inline-block' }}>Choose your character →</a>
                    </div>
                  );
                }

                const displayChar = visibleChars.find(c => c.id === activeCharId) ?? visibleChars[0];
                const charIdx = CHARACTERS.findIndex(c => c.id === displayChar.id);
                const color = TOKEN_COLORS[charIdx % TOKEN_COLORS.length];

                return (
                  <>
                    {visibleChars.length > 1 && (
                      <div className="char-list">
                        {visibleChars.map(c => (
                          <button
                            key={c.id}
                            className={`char-chip${c.id === activeCharId ? ' active' : ''}`}
                            onClick={() => setActiveCharId(c.id)}
                          >
                            {c.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="char-sheet">
                      <div className="cs-head">
                        <div className="cs-avatar" style={{ background: color + '22', color }}>
                          {displayChar.name[0]}
                        </div>
                        <div>
                          <div className="cs-name">{displayChar.name}</div>
                          <div className="cs-sub">{displayChar.cls}</div>
                        </div>
                      </div>
                      <div className="cs-vitals">
                        <div className="vital-box hp">
                          <div className="v-label">HP</div>
                          <div className="v-val">{displayChar.hp}/{displayChar.maxHp}</div>
                        </div>
                      </div>
                      <div className="ability-grid">
                        {Object.entries(displayChar.abilities).map(([key, val]) => (
                          <div key={key} className="ability" onClick={() => rollAbility(displayChar.name, key, val)}>
                            <div className="a-name">{key}</div>
                            <div className="a-mod">{abilityMod(val)}</div>
                            <div className="a-score">{val}</div>
                          </div>
                        ))}
                      </div>
                      <div className="inv-title">Inventory</div>
                      <ul className="inv-list">
                        {displayChar.inventory.map((item, i) => (
                          <li key={i}><span>{item.name}</span><span className="qty">×{item.qty}</span></li>
                        ))}
                      </ul>
                    </div>
                  </>
                );
              })()}
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
              {/* Single scrollable container for all Resources content */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {/* Draggable compendium entries */}
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                          <div className="ci-stats"><span>HP {c.hp}</span></div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="comp-hint">Drag an entry onto the map to spawn it as a token.</div>

                {/* Field Documents */}
                <div style={{ padding: '4px 10px 10px' }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1.5px',
                    textTransform: 'uppercase', color: 'var(--ink-text-2)',
                    marginBottom: 8,
                  }}>
                    Field Documents
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/journal-1.jpeg"
                    alt="Patient journal — Bellevue Psychiatric Isolation Ward"
                    onClick={() => setLightboxSrc('/journal-1.jpeg')}
                    style={{
                      width: '100%', display: 'block',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--line)',
                      boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                      cursor: 'zoom-in',
                      marginBottom: 8,
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/inmate-log.jpeg"
                    alt="Inmate Census & Observation List — Bellevue Psychiatric Isolation Ward"
                    onClick={() => setLightboxSrc('/inmate-log.jpeg')}
                    style={{
                      width: '100%', display: 'block',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--line)',
                      boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                      cursor: 'zoom-in',
                      marginBottom: 8,
                    }}
                  />

                  {/* Tomb footage video */}
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                  <div
                    onClick={() => setVideoModalSrc('/tomb-1.mp4')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setVideoModalSrc('/tomb-1.mp4')}
                    style={{
                      position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
                      border: '1px solid var(--line)', boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                      cursor: 'pointer', background: '#0a0807',
                      marginBottom: 8,
                    }}
                  >
                    <video
                      src="/tomb-1.mp4"
                      muted
                      playsInline
                      style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover', opacity: 0.6, pointerEvents: 'none' }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(10,8,6,0.9) 0%, rgba(10,8,6,0.2) 60%, transparent 100%)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                      padding: '8px 10px',
                    }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '2px', color: 'var(--blood)', border: '1px solid var(--blood)', display: 'inline-block', padding: '1px 5px', marginBottom: 4, width: 'fit-content' }}>
                        FOOTAGE
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--parchment)', lineHeight: 1.2 }}>
                        Tomb Excavation
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', marginTop: 4, letterSpacing: '0.5px' }}>
                        ▶ Click to play
                      </div>
                    </div>
                  </div>

                  {/* ── Cthulhu Bas Relief — 3D Artifact ── */}
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1.5px',
                    textTransform: 'uppercase', color: 'var(--ink-text-2)',
                    marginBottom: 8, marginTop: 10,
                  }}>
                    3D Artifacts
                  </div>
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setReliefModalOpen(true)}
                    onKeyDown={e => e.key === 'Enter' && setReliefModalOpen(true)}
                    style={{
                      position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden',
                      border: '1px solid var(--brass-dim)',
                      boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                      cursor: 'pointer',
                      background: '#0d0905',
                      marginBottom: 10,
                    }}
                  >
                    {/* Static render preview image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/cthulhu-relief-preview.png"
                      alt="Cthulhu Bas Relief"
                      style={{
                        width: '100%', display: 'block', aspectRatio: '4/3',
                        objectFit: 'cover', opacity: 0.75,
                        pointerEvents: 'none',
                        filter: 'sepia(0.2) contrast(1.1)',
                      }}
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(10,6,4,0.96) 0%, rgba(10,6,4,0.35) 55%, transparent 100%)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                      padding: '8px 10px',
                    }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '2px', color: 'var(--brass)', border: '1px solid var(--brass-dim)', display: 'inline-block', padding: '1px 5px', marginBottom: 4, width: 'fit-content' }}>
                        3D ARTIFACT
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--parchment)', lineHeight: 1.2 }}>
                        Cthulhu Bas Relief
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--brass-dim)', marginTop: 2 }}>
                        Sub-chamber · Section 7
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', marginTop: 4, letterSpacing: '0.5px' }}>
                        ⬡ Click to inspect
                      </div>
                    </div>
                  </div>

                </div>
              </div>
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

            {/* Roll pane */}
            <div className={`rp-pane${activePane === 'roll' ? ' active' : ''}`} style={{ overflow: 'hidden' }}>
              {activePane === 'roll' && (
                <DiceRollerPane
                  pushRollToChat={pushRollToChat}
                  who={session?.user?.name ?? 'You'}
                />
              )}
            </div>

            {/* Mission Details pane */}
            <div className={`rp-pane${activePane === 'mission' ? ' active' : ''}`} style={{ overflowY: 'auto', padding: '14px 12px', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-text-2)', marginBottom: 10 }}>
                Mission Details
              </div>

              {BRIEFINGS.filter(b => b.id !== 'old-man' && b.id !== 'mobster' && b.id !== 'attendant').map(b => (
                <div
                  key={b.id}
                  style={{ ...missionCard, marginBottom: 10 }}
                  onClick={() => openBriefing(b)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && openBriefing(b)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.image} alt={b.title} style={missionCardImg} />
                  <div style={missionCardOverlay}>
                    <div style={missionCardBadge}>{b.badge}</div>
                    <div style={missionCardTitle}>{b.title}</div>
                    <div style={missionCardSub}>{b.cardHint ?? b.subtitle}</div>
                    <div style={missionCardHint}>▶ Click to open</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toastVisible ? ' show' : ''}`}>{toastMsg}</div>

      {/* Briefing audio — single element, src swapped per entry */}
      <audio ref={briefingAudioRef} preload="none" />
      {/* Speakeasy background song — plays when a briefing with bgSong is open */}
      <audio ref={speakeasyBgRef} preload="none" />

      {/* Briefing overlay */}
      {activeBriefing && (() => {
        const totalSections = activeBriefing.sections.length;
        const currentSection = activeBriefing.sections[activeSectionIdx];
        const isMulti = totalSections > 1;
        return (
          <div style={butlerBackdrop} onClick={closeBriefing}>
            <div style={butlerOverlay} onClick={e => e.stopPropagation()}>
              {/* Left: photograph */}
              <div style={butlerPhotoCol}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeBriefing.image}
                  alt={activeBriefing.title}
                  style={butlerPhoto}
                  onClick={replayBriefing}
                  title="Click to replay"
                />
                <div style={butlerPhotoCaption}>Click photograph to replay</div>
              </div>

              {/* Right: briefing text */}
              <div style={butlerTextCol}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={butlerStamp}>{activeBriefing.badge}</div>
                  {isMulti && (
                    <div style={sectionCounter}>Part {activeSectionIdx + 1} of {totalSections}</div>
                  )}
                </div>
                <h2 style={butlerHeading}>{activeBriefing.title}</h2>
                <div style={butlerSubtitleLine}>{activeBriefing.subtitle}</div>
                <div style={butlerDivider} />
                <div style={butlerScroll}>
                  {currentSection.paragraphs.map((p, i) => (
                    <p key={i} style={butlerPara}>{p}</p>
                  ))}
                </div>
                <div style={butlerClose}>
                  {isMulti && (
                    <div style={briefingNav}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setActiveSectionIdx(idx => idx - 1)}
                        disabled={activeSectionIdx === 0}
                        style={{ opacity: activeSectionIdx === 0 ? 0.35 : 1 }}
                      >
                        ← Previous
                      </button>
                      <div style={navDots}>
                        {activeBriefing.sections.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveSectionIdx(i)}
                            style={{ ...navDot, background: i === activeSectionIdx ? 'var(--brass)' : 'var(--line)', border: 'none', cursor: 'pointer', padding: 0 }}
                            title={`Part ${i + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setActiveSectionIdx(idx => idx + 1)}
                        disabled={activeSectionIdx === totalSections - 1}
                        style={{ opacity: activeSectionIdx === totalSections - 1 ? 0.35 : 1 }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                  {activeBriefing.bgSong && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', color: 'var(--ink-text-2)', textTransform: 'uppercase' }}>♫ Music</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 8px', minWidth: 28 }}
                        onClick={() => setBriefingBgVolume(v => Math.max(0, Math.round((v - 0.1) * 10) / 10))}
                      >−</button>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--brass)', minWidth: 32, textAlign: 'center' }}>
                        {Math.round(briefingBgVolume * 100)}%
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 8px', minWidth: 28 }}
                        onClick={() => setBriefingBgVolume(v => Math.min(1, Math.round((v + 0.1) * 10) / 10))}
                      >+</button>
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={closeBriefing} style={{ color: 'var(--ink-text-2)', marginTop: 8 }}>
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--line)',
              boxShadow: '0 8px 60px rgba(0,0,0,0.8)',
              objectFit: 'contain',
            }}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: 'absolute', top: 20, right: 24,
              background: 'none', border: 'none',
              color: 'var(--ink-text-2)', fontSize: 26, cursor: 'pointer',
              lineHeight: 1,
            }}
          >✕</button>
        </div>
      )}

      {/* Cthulhu bas relief 3D modal + mild passive sanity effect */}
      {reliefModalOpen && (
        <>
          <div className="eff-primal-horror-flash" />
          <div className="eff-sanity-mild" />
          <CthulhuReliefModal onClose={() => setReliefModalOpen(false)} />
        </>
      )}

      {/* Video modal */}
      {videoModalSrc && (
        <div
          onClick={() => setVideoModalSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 250,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', maxWidth: '88vw', width: 900,
              borderRadius: 'var(--r-lg)', overflow: 'hidden',
              border: '1px solid var(--brass-dim)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(201,148,79,0.15)',
              cursor: 'default',
              background: '#000',
            }}
          >
            <video
              src={videoModalSrc}
              controls
              autoPlay
              style={{ width: '100%', display: 'block', maxHeight: '80vh' }}
            />
            <button
              onClick={() => setVideoModalSrc(null)}
              style={{
                position: 'absolute', top: 12, right: 16,
                background: 'rgba(0,0,0,0.6)', border: '1px solid var(--line)',
                borderRadius: '50%', width: 32, height: 32,
                color: 'var(--parchment)', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >✕</button>
          </div>
        </div>
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
  color: 'var(--parchment)', margin: '0 0 4px',
};
const butlerSubtitleLine: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brass)',
  letterSpacing: '0.5px', marginBottom: 14,
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
  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingTop: 8,
};
const sectionCounter: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '1px',
  color: 'var(--brass)', textTransform: 'uppercase',
};
const briefingNav: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
};
const navDots: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'center',
};
const navDot: React.CSSProperties = {
  width: 7, height: 7, borderRadius: '50%', transition: 'background 0.2s',
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

// ── Screen Effect Layer ───────────────────────────────────────────────
type EffectProps = { effect: { id: string; duration: number; triggeredAt: number; data?: Record<string, unknown> }; onExpire: () => void };

function EffectLayer({ effect, onExpire }: EffectProps) {
  const { id, duration, triggeredAt, data } = effect;
  // Visions: always flash for 500ms from the moment the player first sees it,
  // regardless of polling delay. Duration in blob is kept long (8s) so the
  // effect is still present when players poll.
  const remaining = id === 'visions' ? 500 : Math.max(0, triggeredAt + duration - Date.now());

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const t = setTimeout(onExpire, remaining);
    return () => clearTimeout(t);
  }, [triggeredAt, onExpire, remaining]);

  // Horror: shake the body
  useEffect(() => {
    if (id !== 'horror') return;
    document.body.classList.add('eff-horror');
    return () => document.body.classList.remove('eff-horror');
  }, [id]);

  if (id === 'sanity') {
    return <div className="eff-sanity" />;
  }

  if (id === 'darkness') {
    return (
      <div
        className="eff-darkness"
        style={{ animationDuration: `${duration}ms` }}
      />
    );
  }

  if (id === 'blood') {
    return <div className="eff-blood" />;
  }

  if (id === 'static') {
    return <StaticCanvas />;
  }

  if (id === 'horror') {
    return <div className="eff-horror-flash" />;
  }

  if (id === 'echo') {
    return <div className="eff-echo" />;
  }

  if (id === 'visions') {
    const imageIndex = (data?.imageIndex as number) ?? 1;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/vision-${imageIndex}.jpeg`}
        alt=""
        className="eff-vision"
      />
    );
  }

  return null;
}

function StaticCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;

    const draw = () => {
      const img = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = ((Math.random() * 180) + 60) | 0;
      }
      ctx.putImageData(img, 0, 0);
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="eff-static"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
