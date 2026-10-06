'use client';

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import type { ArchiveDoc, Bed, Collection, Examinable, GazeHazard, Inspectable, NpcSpot, Pickup, RadioSet, WalkthroughLevel } from '@/lib/walkthrough';
import { fileNote } from '@/lib/case-board';
import { createDeepOneHead } from './deep-one';
import { createPinboard } from './pinboard';
import { createInteractMarkers } from './interact-markers';
import { ArchiveBrowser } from './ArchiveBrowser';
import { TypewriterPane } from './TypewriterPane';
import { NpcConversation } from './NpcConversation';
import { InventoryPane } from './InventoryPane';
import { InspectViewer } from './InspectViewer';
import { SkillCheckPane, type Attempt, type Investigator } from './SkillCheckPane';
import type { CheckLevel } from '@/lib/coc-skills';
import { createAvatar, type Gait, type RemoteAvatar } from './avatars';
import { joinLevel, type Peer } from './presence';
import { createWoodsLamp } from './woods-lamp';
import { createHeldViewmodel, prepareHeldModel } from './held-viewmodel';
import { heldModelFor } from '@/lib/held-items';
import { createSkyDome } from './sky-dome';
import { createFlock } from './birds';
import { createGunSounds, type GunSounds } from './gun-sounds';
import { isRain, isTimeOfDay, RAIN_LABELS, RAIN_SPECS, RAINS, skyFor, TIME_LABELS, TIMES, withRain, type Rain, type TimeOfDay } from '@/lib/weather';
import { buildCover, createRain, createRainSound, type Cover, type RainSound } from './rain';
import { createUvStains, uvLightAt, CONE_OUTER, LAMP_RANGE, MAX_LAMPS, type UvLamp } from './uv-stains';

interface Props {
  /** Which place to explore — HOUSE_LEVEL, VESSEL_LEVEL, … */
  level: WalkthroughLevel;
  onClose: () => void;
  /** Posts what the investigator found to the shared chat. */
  onShare: (text: string) => void;
  /** Who is exploring — signs anything they type at a typewriter. */
  author: string;
  /** The investigator who uses skills on objects; without one, the skill panel is hidden. */
  investigator?: Investigator;
  /** Rolls a check against an object, posting it to the party chat. */
  onCheck?: (skill: string, target: number, objectTitle: string) => { roll: number; level: CheckLevel };
  /** The GM: in a level with `weather`, gets a bar to set the time of day for everyone. */
  isGM?: boolean;
}

const EYE = 1.6;           // camera height above the feet
const RADIUS = 0.28;       // investigator's footprint
const STEP = 0.42;         // tallest ledge that can be stepped onto (stairs rise 0.19)
const WALK = 1.7;          // m/s
const RUN = 3.0;
const REACH = 2.3;         // how far away something can be examined from
const LOOK = 0.0022;       // radians per pixel of mouse movement
const UV_SEEN = 0.12;      // how brightly the lamp must light a stain before it can be examined
const LAMP_POOL = 6;       // ceiling lamps lit at once, nearest first (each costs every pixel)

/**
 * The level's Godot build, when it has one and the page asks for it with
 * `?engine=godot`. Only for that visit — the choice is never remembered, so a
 * test can't leave a browser stuck on the Godot level, which still lacks the
 * three.js one's lamp, torch and clues. Clears the old remembered opt-in.
 */
function pickGodot(level: WalkthroughLevel): string | null {
  if (typeof window === 'undefined') return null;
  try {
    localStorage.removeItem('hearthboard:engine');
  } catch {}
  if (!level.godot) return null;
  return new URLSearchParams(window.location.search).get('engine') === 'godot' ? level.godot : null;
}

/** A message to or from the Godot iframe (see my-summer-game/web/walkthrough.gd). */
type GodotMessage = { type: string; [key: string]: unknown };

type Target = {
  id: string; entry: Examinable; box: THREE.Box3; collection?: Collection;
  /** A map pin: its head swells in focus, and it needs no floating marker — the pin is one. */
  pinHead?: THREE.Object3D;
  /** Someone to talk to: E opens a conversation instead of the reading card. */
  npc?: NpcSpot;
  /** A stain only the Wood's lamp shows: it can be examined only while lit. */
  uv?: { point: THREE.Vector3; normal: THREE.Vector3 };
  /** Something to pick up: E opens the inspect viewer instead of the reading card. */
  inspect?: Inspectable;
  /** Something lying on furniture to carry: E takes it in hand, or puts it back. */
  pickup?: Pickup;
  /** A bed: E lies down and sleeps in it. */
  bed?: Bed;
};
type Browsing = { target: Target; docs: ArchiveDoc[] | null; error: boolean };

/**
 * First-person exploration of a Summer-built level: walk with WASD and mouse
 * look under a torch, bump into walls and furniture, examine marked objects and
 * share findings to the party chat. What the level contains, and how it is lit,
 * comes from `level` (see src/lib/walkthrough.ts).
 */
export function WalkthroughModal({ level, onClose, onShare, author, investigator, onCheck, isGM }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [focus, setFocus] = useState<Target | null>(null);
  const [reading, setReading] = useState<Target | null>(null);
  const [browsing, setBrowsing] = useState<Browsing | null>(null);
  const [typing, setTyping] = useState<Target | null>(null);
  const [shared, setShared] = useState<Set<string>>(() => new Set());
  const [sharedDocs, setSharedDocs] = useState<Set<string>>(() => new Set());
  // The reading card's skill panel, and every skill tried this visit, by "<object>/<skill>".
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [sharedChecks, setSharedChecks] = useState<Set<string>>(() => new Set());
  const [savedChecks, setSavedChecks] = useState<Set<string>>(() => new Set());
  // Finds pinned to the case board from the reading card, and the one being pinned now.
  const [savedFinds, setSavedFinds] = useState<Set<string>>(() => new Set());
  const [savingFind, setSavingFind] = useState<string | null>(null);
  const canCheck = !!investigator && !!onCheck;
  const [torchOn, setTorchOn] = useState(true);
  // The Wood's lamp: in hand (Q), and its switch (F while it is out).
  const hasLamp = !!level.uvStains?.length;
  const [lampOut, setLampOut] = useState(false);
  const [lampOn, setLampOn] = useState(true);
  const [markersOn, setMarkersOn] = useState(true);
  const [radiosOn, setRadiosOn] = useState<Set<string>>(() => new Set());
  // The investigator's sheet equipment (I), the item in hand, and the last use, shown briefly.
  const items = useMemo(() => investigator?.equipment ?? [], [investigator]);
  const heldKey = investigator?.slug ? `hearthboard:held:${investigator.slug}` : null;
  const [invOpen, setInvOpen] = useState(false);
  const [held, setHeld] = useState<string | null>(() => {
    try { return heldKey ? localStorage.getItem(heldKey) : null; } catch { return null; }
  });
  const [usedNote, setUsedNote] = useState<string | null>(null);
  // Sleeping: the scene runs the lying down, the dark and the getting up; the
  // page asks for it (sleepCmdRef) and is told how far it has got (asleep).
  const [asleep, setAsleep] = useState<'no' | 'lying' | 'asleep' | 'waking'>('no');
  const asleepRef = useRef<'no' | 'lying' | 'asleep' | 'waking'>('no');
  useEffect(() => { asleepRef.current = asleep; }, [asleep]);
  const sleepCmdRef = useRef<{ wake: true } | { bed: Target } | null>(null);
  const sleepShadeRef = useRef<HTMLDivElement | null>(null);
  // The board hands a fresh onShare on every render (it polls chat every few
  // seconds); read it through a ref so callbacks the 3D scene depends on stay
  // the same and the level is not rebuilt.
  const onShareRef = useRef(onShare);
  useEffect(() => { onShareRef.current = onShare; }, [onShare]);
  // Time of day, where the level has weather: set by the GM, fetched by everyone (see src/lib/weather.ts).
  const [weatherTime, setWeatherTime] = useState<TimeOfDay>('night');
  const weatherRef = useRef<TimeOfDay>('night');
  useEffect(() => { weatherRef.current = weatherTime; }, [weatherTime]);
  const [rain, setRain] = useState<Rain>('none');
  const rainRef = useRef<Rain>('none');
  useEffect(() => { rainRef.current = rain; }, [rain]);
  const [weatherError, setWeatherError] = useState(false);
  // A pickup carried from where it lay (a gun off the armory bench), by id. Not inventory: it stays in the level.
  const [carried, setCarried] = useState<string | null>(null);
  const carriedRef = useRef<string | null>(null);
  useEffect(() => { carriedRef.current = carried; }, [carried]);
  const carriedPickup = useMemo(
    () => (carried ? level.pickups?.flatMap(t => t.items).find(p => p.id === carried) ?? null : null),
    [carried, level],
  );
  // The object in hand in the inspect viewer, its Wood's lamp, and clues found, by "<object>/<clue>".
  const [inspecting, setInspecting] = useState<Target | null>(null);
  const [inspectUv, setInspectUv] = useState(false);
  const [foundClues, setFoundClues] = useState<Set<string>>(() => new Set());
  const [sharedClues, setSharedClues] = useState<Set<string>>(() => new Set());
  const [savedClues, setSavedClues] = useState<Set<string>>(() => new Set());
  // Other investigators in this level right now, by name.
  const [companions, setCompanions] = useState<string[]>([]);
  // Checked up front: a browser with WebGL disabled (hardware acceleration off,
  // or the GPU process given up after crashes) makes WebGLRenderer throw.
  const [webgl] = useState(() => WebGL.isWebGL2Available());
  // Godot draws the level instead of three.js; this page still owns every card and pane.
  const [godot] = useState(() => pickGodot(level));
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // The key handler below, so keys the iframe forwards go through the same logic.
  const keyRef = useRef<((e: Pick<KeyboardEvent, 'code' | 'key' | 'repeat' | 'preventDefault'>) => void) | null>(null);

  // Refs the animation loop reads without re-registering.
  const readingRef = useRef<Target | null>(null);
  const browsingRef = useRef<Browsing | null>(null);
  const typingRef = useRef<Target | null>(null);
  const focusRef = useRef<Target | null>(null);
  const torchRef = useRef(true);
  const lampOutRef = useRef(false);
  const lampOnRef = useRef(true);
  const markersRef = useRef(true);
  const invOpenRef = useRef(false);
  // The item in hand, if it is still on the sheet — read by the level's loop to show it.
  const heldItemRef = useRef<string | null>(null);
  const inspectingRef = useRef<Target | null>(null);
  const heldRef = useRef<string | null>(null);
  const unlockedAtRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Set by the scene once the level loads; switches a radio on or off.
  const toggleRadioRef = useRef<((id: string) => void) | null>(null);
  // Set by the scene: reloads the gun in hand, if it can be.
  const reloadRef = useRef<(() => void) | null>(null);
  // Set by the scene when the level has a pinboard; refetches its notes now.
  const refreshPinsRef = useRef<(() => void) | null>(null);

  useEffect(() => { readingRef.current = reading; }, [reading]);
  useEffect(() => { browsingRef.current = browsing; }, [browsing]);
  useEffect(() => { typingRef.current = typing; }, [typing]);
  useEffect(() => { torchRef.current = torchOn; }, [torchOn]);
  useEffect(() => { lampOutRef.current = lampOut; }, [lampOut]);
  useEffect(() => { lampOnRef.current = lampOn; }, [lampOn]);
  useEffect(() => { markersRef.current = markersOn; }, [markersOn]);
  useEffect(() => { invOpenRef.current = invOpen; }, [invOpen]);
  useEffect(() => { inspectingRef.current = inspecting; }, [inspecting]);
  useEffect(() => { heldRef.current = held; }, [held]);

  // An item struck off the sheet since it was taken in hand is gone from the hand too.
  const heldItem = held && items.includes(held) ? held : null;
  useEffect(() => { heldItemRef.current = heldItem; }, [heldItem]);

  // Takes an item in hand, or puts it away; remembered per investigator across levels.
  const holdItem = useCallback((item: string) => {
    setHeld(prev => {
      const next = prev === item ? null : item;
      // One hand: whatever was picked up goes back to where it lay.
      if (next) setCarried(null);
      try {
        if (heldKey) {
          if (next) localStorage.setItem(heldKey, next);
          else localStorage.removeItem(heldKey);
        }
      } catch {}
      return next;
    });
  }, [heldKey]);

  const openInventory = useCallback(() => {
    setInvOpen(true);
    document.exitPointerLock?.();
  }, []);

  const closeInventory = useCallback(() => {
    setInvOpen(false);
    canvasRef.current?.requestPointerLock?.();
  }, []);

  const usedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(usedTimer.current), []);

  const openReading = useCallback((t: Target, withSkills = false) => {
    setReading(t);
    setSkillsOpen(withSkills);
    document.exitPointerLock?.();
  }, []);

  const closeReading = useCallback(() => {
    setReading(null);
    canvasRef.current?.requestPointerLock?.();
  }, []);

  // Collections, typewriters and map pins open their own panes, not the reading card.
  const canUseSkillOn = useCallback((t: Target) => canCheck && !t.collection && !t.pinHead && !t.npc && !t.inspect && !t.pickup && !t.bed && !level.typewriters?.[t.id], [canCheck, level]);

  // A collection (filing cabinet, gun rack…) opens its contents, fetched afresh
  // each time; a typewriter opens a sheet to type on; anything else opens the
  // reading card.
  const openTarget = useCallback((t: Target) => {
    // A bed: lie down and sleep. The scene takes it from here.
    if (t.bed) {
      if (asleepRef.current === 'no') {
        sleepCmdRef.current = { bed: t };
        onShareRef.current(`lay down in a ${t.entry.title.toLowerCase()} to sleep`);
      }
      return;
    }
    // A pickup: E on it takes it in hand, and anything already carried goes
    // back to its own place; E on the empty place of the one in hand puts it back.
    if (t.pickup) {
      const id = t.pickup.id;
      setCarried(prev => (prev === id ? null : id));
      if (carriedRef.current !== id) {
        setHeld(null);
        try { if (heldKey) localStorage.removeItem(heldKey); } catch {}
      }
      return;
    }
    // Something small is picked up and turned over in the inspect viewer.
    if (t.inspect) {
      setInspecting(t);
      // A Wood's lamp already lit in the level stays lit on the object.
      setInspectUv(lampOutRef.current && lampOnRef.current);
      document.exitPointerLock?.();
      return;
    }
    // A typewriter or a person takes the keyboard: both open over the level in `typing`.
    if (level.typewriters?.[t.id] || t.npc) {
      setTyping(t);
      document.exitPointerLock?.();
      return;
    }
    if (!t.collection) { openReading(t); return; }
    const opened: Browsing = { target: t, docs: null, error: false };
    setBrowsing(opened);
    document.exitPointerLock?.();
    t.collection.load().then(
      docs => setBrowsing(b => (b?.target === t ? { ...b, docs } : b)),
      () => setBrowsing(b => (b?.target === t ? { ...b, error: true } : b)),
    );
  }, [openReading, level, heldKey]);

  const closeInspect = useCallback(() => {
    setInspecting(null);
    setInspectUv(false);
    canvasRef.current?.requestPointerLock?.();
  }, []);

  // Things kept out of sight inside another object (the chart in the clock
  // weight, the boat under the boards): never drawn in the level, but brought
  // out by a button on their container's card or viewer.
  const hiddenTargets = useMemo(() => new Map(Object.entries(level.inspectables ?? {})
    .filter(([id, insp]) => insp.in && level.examinables[id])
    .map(([id, insp]): [string, Target] => [id, { id, entry: level.examinables[id], box: new THREE.Box3(), inspect: insp }])), [level]);
  const hiddenIn = useCallback((fromId: string) => [...hiddenTargets.values()].flatMap(t => {
    const where = t.inspect?.in;
    if (where?.from !== fromId) return [];
    return [{ id: t.id, label: where.action, ready: !where.after || foundClues.has(`${fromId}/${where.after}`) }];
  }), [hiddenTargets, foundClues]);
  /** Brings a hidden thing out into the viewer, from its container's card — or its viewer, keeping the lamp as it is. */
  const openHidden = useCallback((id: string, fromViewer = false) => {
    const t = hiddenTargets.get(id);
    if (!t) return;
    setReading(null);
    setInspecting(t);
    if (!fromViewer) setInspectUv(lampOutRef.current && lampOnRef.current);
    document.exitPointerLock?.();
  }, [hiddenTargets]);

  const shareClue = useCallback((t: Target, clueId: string) => {
    const clue = t.inspect?.clues[clueId];
    if (!clue) return;
    onShare(`turned over the ${t.entry.title.toLowerCase()}${clue.uv ? " under the Wood's lamp" : ''} — ${clue.title}: ${clue.text}`);
    setSharedClues(prev => new Set(prev).add(`${t.id}/${clueId}`));
  }, [onShare]);

  // A clue found on an object goes on the case board like any other find; UV finds on lavender paper.
  const saveClue = useCallback(async (t: Target, clueId: string) => {
    const clue = t.inspect?.clues[clueId];
    if (!clue) return;
    const place = level.title.split(' · ')[0];
    const how = clue.uv ? " · under the Wood's lamp" : '';
    const note = `${clue.title} · on the ${t.entry.title.toLowerCase()}${how} · ${place}\n\n${clue.text}\n\n— ${investigator?.name ?? author}`;
    try {
      await fileNote(note, author, { prefix: 'clue', color: clue.uv ? '#e4dcf2' : '#e8dcc0' });
      setSavedClues(prev => new Set(prev).add(`${t.id}/${clueId}`));
      refreshPinsRef.current?.();
    } catch (err) {
      console.error('Could not pin to the case board:', err);
    }
  }, [level, investigator, author]);

  const closeTyping = useCallback(() => {
    setTyping(null);
    canvasRef.current?.requestPointerLock?.();
  }, []);

  const closeBrowsing = useCallback(() => {
    setBrowsing(null);
    canvasRef.current?.requestPointerLock?.();
  }, []);

  const shareDoc = useCallback((t: Target, doc: ArchiveDoc) => {
    const detail = doc.text ? ` — ${doc.text}` : '';
    onShare(`pulled "${doc.title}" from the ${t.entry.title.toLowerCase()}${detail}`);
    setSharedDocs(prev => new Set(prev).add(`${t.id}/${doc.id}`));
  }, [onShare]);

  // Pins what the card says to the case board. Wood's-lamp finds go on lavender paper.
  const saveFind = useCallback(async (t: Target) => {
    setSavingFind(t.id);
    const place = level.title.split(' · ')[0];
    const how = t.uv ? " · under the Wood's lamp" : '';
    const note = `${t.entry.title}${how} · ${place}\n\n${t.entry.text}\n\n— ${investigator?.name ?? author}`;
    try {
      await fileNote(note, author, { prefix: 'clue', color: t.uv ? '#e4dcf2' : '#e8dcc0' });
      setSavedFinds(prev => new Set(prev).add(t.id));
      refreshPinsRef.current?.();
    } catch (err) {
      console.error('Could not pin to the case board:', err);
    } finally {
      setSavingFind(null);
    }
  }, [level, investigator, author]);

  const share = useCallback((t: Target) => {
    onShare(`examined the ${t.entry.title.toLowerCase()} — ${t.entry.text}`);
    setShared(prev => new Set(prev).add(t.id));
  }, [onShare]);

  // Uses the item in hand on what the investigator is looking at, and tells the party.
  const applyItem = useCallback((t: Target, item: string) => {
    onShare(`used “${item}” on the ${t.entry.title.toLowerCase()}`);
    setUsedNote(`Used ${item} on the ${t.entry.title.toLowerCase()} · shared with the party`);
    window.clearTimeout(usedTimer.current);
    usedTimer.current = window.setTimeout(() => setUsedNote(null), 3500);
  }, [onShare]);

  // Escape closes the reading card first, then the level. Pressing Escape to
  // leave pointer lock must not also close the modal, so a key arriving just
  // after the lock was released is ignored.
  useEffect(() => {
    const onKey = (e: Pick<KeyboardEvent, 'code' | 'key' | 'repeat' | 'preventDefault'>) => {
      // At the typewriter every key is typing (the textarea keeps its own keys
      // from reaching here); only Escape, from a focused button, backs out.
      if (typingRef.current) {
        if (e.key === 'Escape') setTyping(null);
        return;
      }
      // Asleep: E wakes; Escape still leaves the level; nothing else reaches it.
      if (asleepRef.current !== 'no') {
        if (e.code === 'KeyE' && !e.repeat && asleepRef.current !== 'waking') {
          sleepCmdRef.current = { wake: true };
          onShare('woke and got up');
        }
        if (e.key !== 'Escape') return;
      }
      // Holding something: E or Esc puts it down, Q lights the Wood's lamp on it; nothing else reaches the level.
      if (inspectingRef.current) {
        if (e.key === 'Escape' || (e.code === 'KeyE' && !e.repeat)) closeInspect();
        else if (e.code === 'KeyQ' && !e.repeat) setInspectUv(v => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (readingRef.current) { setReading(null); return; }
        if (browsingRef.current) { setBrowsing(null); return; }
        if (invOpenRef.current) { setInvOpen(false); return; }
        if (document.pointerLockElement || performance.now() - unlockedAtRef.current < 300) return;
        onClose();
        return;
      }
      // I opens or closes the inventory; with it open, 1–9 take an item in hand.
      if (e.code === 'KeyI' && !e.repeat && !readingRef.current && !browsingRef.current) {
        if (invOpenRef.current) closeInventory();
        else openInventory();
        return;
      }
      if (invOpenRef.current) {
        const n = /^Digit([1-9])$/.exec(e.code);
        if (n && !e.repeat && items[Number(n[1]) - 1]) holdItem(items[Number(n[1]) - 1]);
        // The level behind the pane is not being looked at: no examining or skills from here.
        if (e.code === 'KeyE' || e.code === 'KeyR' || e.code === 'KeyU') return;
      }
      // U uses the item in hand on the open card, or on whatever the crosshair is on.
      if (e.code === 'KeyU' && !e.repeat && !browsingRef.current) {
        const t = readingRef.current ?? focusRef.current;
        const pickup = carriedRef.current ? level.pickups?.flatMap(tb => tb.items).find(p => p.id === carriedRef.current) : undefined;
        const item = pickup ? pickup.title : heldRef.current;
        if (t && !t.pickup && item && (pickup || items.includes(item))) applyItem(t, item);
      }
      if (e.code === 'KeyE') {
        const target = focusRef.current;
        if (e.repeat) return;
        if (readingRef.current) closeReading();
        else if (browsingRef.current) closeBrowsing();
        else if (target && level.radios?.[target.id]) toggleRadioRef.current?.(target.id);
        else if (target) openTarget(target);
      }
      // With a gun that reloads in hand, R reloads it (skills are still on the open card).
      if (e.code === 'KeyR' && !e.repeat && !readingRef.current && !browsingRef.current) {
        const gun = carriedRef.current ? level.pickups?.flatMap(tb => tb.items).find(p => p.id === carriedRef.current) : undefined;
        if (gun?.view.reload) { reloadRef.current?.(); return; }
      }
      // R brings up the investigator's skills — on the open card, or straight from the crosshair.
      if (e.code === 'KeyR' && !e.repeat && !browsingRef.current) {
        const t = readingRef.current ?? focusRef.current;
        if (t && canUseSkillOn(t)) {
          if (readingRef.current) setSkillsOpen(v => !v);
          else openReading(t, true);
        }
      }
      // Q draws or holsters the Wood's lamp; the torch is put away while it is out, and F works its switch.
      if (e.code === 'KeyQ' && !e.repeat && hasLamp) setLampOut(v => !v);
      if (e.code === 'KeyF') {
        if (lampOutRef.current) setLampOn(v => !v);
        else setTorchOn(v => !v);
      }
      // Tab shows or hides the markers over interactive objects (and must not move browser focus).
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!e.repeat) setMarkersOn(v => !v);
      }
    };
    keyRef.current = onKey;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, openTarget, openReading, closeReading, closeBrowsing, canUseSkillOn, level, hasLamp, items, holdItem, applyItem, openInventory, closeInventory, closeInspect, onShare]);

  // ── Weather ───────────────────────────────────────────────────────
  // Every 10 s while the level is open and the tab is showing — gentle on the
  // shared store's request quota; the GM's own change applies at once.
  useEffect(() => {
    if (!level.weather) return;
    let cancelled = false;
    const poll = () => {
      if (document.hidden) return;
      fetch(`/api/weather?level=${encodeURIComponent(level.id)}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((w: { time?: unknown; rain?: unknown } | null) => {
          if (cancelled) return;
          setWeatherTime(isTimeOfDay(w?.time) ? w.time : 'night');
          setRain(isRain(w?.rain) ? w.rain : 'none');
        })
        .catch(() => {});
    };
    poll();
    const timer = window.setInterval(poll, 10_000);
    document.addEventListener('visibilitychange', poll);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [level]);

  // The GM changes the time of day or the rain; the other stays as it is.
  const setWeather = useCallback(async (change: { time?: TimeOfDay; rain?: Rain }) => {
    const before = { time: weatherRef.current, rain: rainRef.current };
    if (change.time) setWeatherTime(change.time);
    if (change.rain) setRain(change.rain);
    setWeatherError(false);
    try {
      const r = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.id, ...change }),
      });
      if (!r.ok) throw new Error(String(r.status));
    } catch (err) {
      console.error('Could not set the weather:', err);
      setWeatherTime(before.time);
      setRain(before.rain);
      setWeatherError(true);
    }
  }, [level]);

  // ── Godot ─────────────────────────────────────────────────────────
  // The iframe walks, lights and works out what the investigator is looking
  // at; it reports focus, pointer lock and the keys this page acts on, and is
  // paused while a card or pane is open.
  const postGodot = useCallback((msg: GodotMessage) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ hearthboard: msg }), window.location.origin);
  }, []);

  // One Target per examinable, so a focused object stays the same object.
  const godotTargets = useRef(new Map<string, Target>());
  const godotTarget = useCallback((id: string): Target | null => {
    const entry = level.examinables[id];
    if (!entry) return null;
    let t = godotTargets.current.get(id);
    if (!t) {
      t = { id, entry, box: new THREE.Box3(), collection: level.collections?.[id], inspect: level.inspectables?.[id] };
      godotTargets.current.set(id, t);
    }
    return t;
  }, [level]);

  useEffect(() => {
    if (!godot) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return;
      let msg: GodotMessage;
      try {
        msg = (JSON.parse(String(e.data)) as { hearthboard?: GodotMessage }).hearthboard as GodotMessage;
      } catch {
        return;
      }
      if (!msg) return;
      switch (msg.type) {
        case 'progress':
          setProgress(Number(msg.p) || 0);
          break;
        case 'error':
          console.error('Godot walkthrough failed:', msg.message);
          setLoadError(true);
          break;
        case 'ready':
          postGodot({ type: 'init', examinables: Object.keys(level.examinables) });
          setLoaded(true);
          break;
        case 'focus': {
          const t = typeof msg.id === 'string' ? godotTarget(msg.id) : null;
          focusRef.current = t;
          setFocus(t);
          break;
        }
        case 'lock':
          if (!msg.locked) unlockedAtRef.current = performance.now();
          setLocked(!!msg.locked);
          break;
        case 'key': {
          const code = String(msg.code);
          keyRef.current?.({ code, key: code === 'Escape' ? 'Escape' : '', repeat: false, preventDefault: () => {} });
          break;
        }
        case 'activate': {
          const t = typeof msg.id === 'string' ? godotTarget(msg.id) : null;
          if (t && !readingRef.current && !browsingRef.current && !typingRef.current) openTarget(t);
          break;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [godot, level, postGodot, godotTarget, openTarget]);

  // Hold the level still under a card; let it go when the last one closes.
  const covered = !!(reading || browsing || typing || invOpen || inspecting);
  useEffect(() => {
    if (!godot || !loaded) return;
    postGodot({ type: covered ? 'pause' : 'resume' });
    // Keys go back to the level once the card is gone.
    if (!covered) iframeRef.current?.focus();
  }, [godot, loaded, covered, postGodot]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !webgl || godot) return;

    const width = el.clientWidth || 960;
    const height = el.clientHeight || 540;

    // ── Renderer ────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    el.appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    canvasRef.current = canvas;

    // ── Scene ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const atmo = level.atmosphere;
    scene.background = new THREE.Color(atmo.background);
    scene.fog = new THREE.FogExp2(atmo.fogColor, atmo.fogDensity);

    const owned: { dispose: () => void }[] = [];
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.05, 60);
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    const hemi = new THREE.HemisphereLight(atmo.sky, atmo.ground, atmo.fill);
    scene.add(hemi);
    // The moon — or, in a level with weather, whichever of sun and moon is up.
    let moon: THREE.DirectionalLight | null = null;
    if (atmo.moon || level.weather) {
      moon = new THREE.DirectionalLight(atmo.moon?.color ?? 0xffffff, atmo.moon?.intensity ?? 0);
      moon.position.set(...(atmo.moon?.position ?? [-18, 22, -10]));
      moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
      moon.shadow.bias = -0.0005;
      moon.shadow.normalBias = 0.04;
      scene.add(moon);
    }

    // Time of day: the sky dome, and where the light is now, easing toward the GM's choice.
    const dome = level.weather ? createSkyDome(50) : null;
    if (dome) scene.add(dome.mesh);
    const flock = level.birds ? createFlock(scene, level.birds, () => listener) : null;
    // Rain: the streaks, what covers each part of the level (measured once it
    // loads), its sound once there is a listener, and how hard it is falling now.
    const rainFall = level.weather ? createRain() : null;
    if (rainFall) scene.add(rainFall.object);
    let cover: Cover | null = null;
    let rainSound: RainSound | null = null;
    const rainNow = { drops: 0, wind: 0, loudness: 0, storm: 0 };
    const rainTint = new THREE.Color();
    let lastBolt = -1;
    let flash = 0;
    const sky = (() => {
      const k = withRain(skyFor(weatherRef.current, level), rainRef.current);
      return {
        zenith: new THREE.Color(k.zenith), horizon: new THREE.Color(k.horizon), sunColor: new THREE.Color(k.sunColor),
        sunDir: new THREE.Vector3(...k.sunDir).normalize(), sunIntensity: k.sunIntensity,
        fogColor: new THREE.Color(k.fogColor), fogDensity: k.fogDensity,
        hemiSky: new THREE.Color(k.hemiSky), hemiGround: new THREE.Color(k.hemiGround), fill: k.fill, stars: k.stars,
      };
    })();
    const goal = new THREE.Color();
    const goalDir = new THREE.Vector3();
    // The sea is built near-black for night, with nothing to reflect: by day it
    // takes on the sky's horizon colour instead (found once the level loads).
    let sea: { mat: THREE.MeshStandardMaterial; night: THREE.Color } | null = null;

    // The investigator's flashlight rides on the camera.
    const torch = new THREE.SpotLight(0xffe0b0, 40, 16, 0.52, 0.55, 2);
    torch.position.set(0.15, -0.2, 0);
    torch.castShadow = true;
    torch.shadow.mapSize.set(1024, 1024);
    torch.shadow.camera.near = 0.1;
    torch.shadow.bias = -0.0004;
    camera.add(torch);
    camera.add(torch.target);
    torch.target.position.set(0, -0.1, -1);

    // The Wood's lamp: its violet wash on the camera, the stains it finds, and
    // the lamp itself in the investigator's hand. Others' lit lamps reveal
    // stains too, and each gets a wash of its own.
    const uvLevel = !!level.uvStains?.length;
    const woods = uvLevel ? createWoodsLamp(renderer, width / height) : null;
    // Whatever inventory item is in hand, when it has a model (the revolver).
    const inHand = createHeldViewmodel(renderer, width / height);
    let gunSounds: GunSounds | null = null;
    reloadRef.current = () => {
      const ear = ensureListener();
      gunSounds ??= createGunSounds(ear.context, ear.getInput());
      inHand.reload(gunSounds);
    };
    const uvWash = (light: THREE.SpotLight) => {
      light.angle = CONE_OUTER;
      light.penumbra = 0.55;
      light.decay = 2;
      light.distance = LAMP_RANGE + 1.5;
      light.intensity = 0;
      return light;
    };
    const uvSpot = uvWash(new THREE.SpotLight(0x6b2dff));
    const uvOwn: UvLamp = { pos: new THREE.Vector3(), dir: new THREE.Vector3(), power: 0 };
    const remoteLamps: { light: THREE.SpotLight; glow: THREE.Sprite; lamp: UvLamp }[] = [];
    if (uvLevel) {
      uvSpot.position.set(0.12, -0.1, 0);
      camera.add(uvSpot);
      camera.add(uvSpot.target);
      uvSpot.target.position.set(0, -0.02, -1);
      const glowMap = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d')!;
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(190,150,255,1)');
        g.addColorStop(1, 'rgba(80,20,180,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      })();
      for (let i = 0; i < MAX_LAMPS - 1; i++) {
        const light = uvWash(new THREE.SpotLight(0x6b2dff));
        light.visible = false;
        const glowMat = new THREE.SpriteMaterial({ map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.setScalar(0.12);
        glow.visible = false;
        owned.push(glowMat);
        scene.add(light, light.target, glow);
        remoteLamps.push({ light, glow, lamp: { pos: new THREE.Vector3(), dir: new THREE.Vector3(), power: 0 } });
      }
      owned.push(glowMap);
    }

    // ── State ───────────────────────────────────────────────────────
    const feet = new THREE.Vector3(-0.3, 0, 4.2);
    let yaw = 0;
    let pitch = 0;
    const keys = new Set<string>();
    const walls: THREE.Object3D[] = [];
    const blockers: THREE.Box3[] = [];
    const targets: Target[] = [];
    // Pickups as they lie in the level, by id.
    const pickupById = new Map<string, { item: Pickup; obj: THREE.Object3D }>();
    // Sleeping: where the investigator lies and gets up, and how far between
    // standing (0) and lying (1) they are; `dark` is the fade to sleep.
    let sleep: {
      phase: 'lying' | 'asleep' | 'waking';
      lie: THREE.Vector3; lieQ: THREE.Quaternion;
      up: THREE.Vector3; upYaw: number;
      k: number; dark: number;
    } | null = null;
    const standQ = new THREE.Quaternion();
    const camEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    // Each bed's own furniture, to find the top of its mattress.
    const bedPieces = new Map<string, THREE.Object3D>();
    const hazards: { hazard: GazeHazard; box: THREE.Box3; center: THREE.Vector3; radius: number }[] = [];
    const fires: THREE.PointLight[] = [];
    const radios = new Map<string, { set: RadioSet; el: HTMLAudioElement; glow: THREE.PointLight; center: THREE.Vector3; sound: THREE.PositionalAudio | null }>();
    let listener: THREE.AudioListener | null = null;
    // Sound starts on the first click or key in the level (browsers require a
    // gesture); after that, radios and birds share the one listener.
    const ensureListener = () => {
      if (!listener) {
        listener = new THREE.AudioListener();
        camera.add(listener);
      }
      if (listener.context.state !== 'running') void listener.context.resume();
      return listener;
    };
    // The watcher at the peephole: where its eye rests behind the hole, and the
    // state of its current look.
    let peeper: { head: ReturnType<typeof createDeepOneHead>; rest: THREE.Vector3; side: THREE.Vector3; hole: THREE.Vector3 } | null = null;
    const peek = { phase: 'away' as 'away' | 'in' | 'hold' | 'out', t: 0, next: 0, hold: 0, from: 1 };
    // Every lamp in the level, but only the nearest LAMP_POOL are lit by real
    // lights: each light costs every pixel, and 18 of them made the Archive
    // crawl. `w` fades a lamp in and out of the pool so none ever pops.
    const lamps: { pos: THREE.Vector3; color: THREE.Color; base: number; distance: number; dipUntil: number; w: number; d: number; slot: THREE.PointLight | null }[] = [];
    const lampPool: THREE.PointLight[] = [];
    let pinboard: ReturnType<typeof createPinboard> | null = null;
    let markers: ReturnType<typeof createInteractMarkers> | null = null;
    let stains: ReturnType<typeof createUvStains> | null = null;
    let pinTimer = 0;
    let model: THREE.Object3D | null = null;
    let disposed = false;
    let animId = 0;

    const ray = new THREE.Raycaster();
    const tmpV = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);

    /** Distance to the nearest wall along `dir` from `origin`, or Infinity. */
    const wallDist = (origin: THREE.Vector3, dir: THREE.Vector3, far: number) => {
      ray.set(origin, dir);
      ray.far = far;
      const hit = ray.intersectObjects(walls, false)[0];
      return hit ? hit.distance : Infinity;
    };

    /** Height of the floor beneath (x, z), searched from just above the feet. */
    const groundAt = (x: number, z: number, from: number) => {
      ray.set(tmpV.set(x, from + STEP + 0.05, z), down);
      ray.far = 6;
      const hit = ray.intersectObjects(walls, false)[0];
      return hit ? hit.point.y : -Infinity;
    };

    const hitsFurniture = (x: number, z: number, y: number) => {
      for (const b of blockers) {
        if (b.max.y < y + 0.3 || b.min.y > y + 1.7) continue;
        if (x > b.min.x - RADIUS && x < b.max.x + RADIUS && z > b.min.z - RADIUS && z < b.max.z + RADIUS) return true;
      }
      return false;
    };

    /** Tries to move the feet by (dx, dz); returns whether it moved. */
    const tryMove = (dx: number, dz: number) => {
      const len = Math.hypot(dx, dz);
      if (len === 0) return false;
      const dir = tmpV.set(dx / len, 0, dz / len).clone();
      // Two rays: one clears stair risers (which sit below it), one catches walls and beams.
      for (const h of [0.45, 1.3]) {
        const origin = new THREE.Vector3(feet.x, feet.y + h, feet.z);
        if (wallDist(origin, dir, RADIUS + len + 0.01) < RADIUS + len) return false;
      }
      const nx = feet.x + dx;
      const nz = feet.z + dz;
      const g = groundAt(nx, nz, feet.y);
      if (g === -Infinity || g > feet.y + STEP) return false;
      if (hitsFurniture(nx, nz, Math.max(g, feet.y))) return false;
      feet.x = nx;
      feet.z = nz;
      return true;
    };

    // ── Load the level ──────────────────────────────────────────────
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      level.model,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;
        scene.add(model);
        model.updateMatrixWorld(true);

        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        const arch = model.getObjectByName('Architecture');
        arch?.traverse((o) => { if ((o as THREE.Mesh).isMesh) walls.push(o); });
        // Where the rain cannot reach: over the architecture, cast down from above.
        if (rainFall && arch) {
          const span = new THREE.Box3().setFromObject(arch).expandByScalar(1);
          cover = buildCover(span, (x, z, from) => {
            ray.set(tmpV.set(x, from, z), down);
            ray.far = from - span.min.y + 1;
            const hit = ray.intersectObjects(walls, false)[0];
            return hit ? hit.point.y : -Infinity;
          });
          rainFall.setCover(cover);
        }

        // Furniture blocks as boxes: cheaper than its triangles, and it never snags on chair legs.
        const furniture = model.getObjectByName('Furniture');
        // Examinable furniture by id, for things set down on it (inspectables).
        const pieceById = new Map<string, THREE.Object3D>();
        furniture?.children.forEach((piece) => {
          const box = new THREE.Box3().setFromObject(piece);
          if (box.isEmpty()) return;
          const tall = box.max.y - box.min.y;
          // Skip rugs and wall-hung frames. "Hung" is measured from the floor the
          // piece stands over, so furniture on an upper storey still blocks.
          const below = groundAt((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2, box.min.y);
          const floorY = below === -Infinity ? 0 : below;
          if (tall > 0.12 && box.min.y - floorY < 1.2) blockers.push(box);
          const id = piece.name.startsWith('Examine_') ? piece.name.slice('Examine_'.length) : null;
          const entry = id ? level.examinables[id] : undefined;
          if (id && entry) targets.push({ id, entry, box, collection: level.collections?.[id], bed: level.beds?.[id] });
          if (id && level.beds?.[id]) bedPieces.set(id, piece);
          if (id) pieceById.set(id, piece);
          if (entry?.lying) {
            // Drop onto the top surface at the centre, not box.max.y — a chair
            // back can rise above the tabletop.
            const { src, crop: [cx, cy, cw, ch], width, turnDeg = 0 } = entry.lying;
            const centre = box.getCenter(new THREE.Vector3());
            const down = new THREE.Raycaster(new THREE.Vector3(centre.x, box.max.y + 0.5, centre.z), new THREE.Vector3(0, -1, 0));
            const top = down.intersectObject(piece, true)[0]?.point.y ?? box.max.y;
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = Math.round(512 * ch / cw);
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            const img = new Image();
            img.onload = () => {
              if (disposed) return;
              canvas.getContext('2d')!.drawImage(img, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);
              tex.needsUpdate = true;
            };
            img.src = src;
            const geo = new THREE.PlaneGeometry(width, width * ch / cw).rotateX(-Math.PI / 2);
            const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
            owned.push(geo, mat, tex);
            const sheet = new THREE.Mesh(geo, mat);
            sheet.position.set(centre.x, top + 0.003, centre.z);
            sheet.rotation.y = THREE.MathUtils.degToRad(turnDeg);
            sheet.receiveShadow = true;
            scene.add(sheet);
          }
          const hazard = id ? level.gazeHazards?.[id] : undefined;
          if (hazard) {
            const sphere = box.getBoundingSphere(new THREE.Sphere());
            hazards.push({ hazard, box, center: sphere.center, radius: sphere.radius });
          }
        });

        const start = model.getObjectByName('PlayerStart');
        if (start) {
          start.getWorldPosition(feet);
          const q = start.getWorldQuaternion(new THREE.Quaternion());
          yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
        }
        // Stand on whatever is under the start (a deck can sit above or below y = 0).
        const floor = groundAt(feet.x, feet.z, feet.y);
        if (floor !== -Infinity) feet.y = floor;

        for (const f of level.fires ?? []) {
          const anchor = targets.find(t => t.id === f.examineId);
          if (!anchor) continue;
          const fire = new THREE.PointLight(0xff7a30, 6, 6, 2);
          fire.position.set(...f.at(anchor.box));
          scene.add(fire);
          fires.push(fire);
        }

        if (level.lamps) {
          const cfg = level.lamps;
          model.traverse((o) => {
            if (!o.name.startsWith('Lamp_')) return;
            const { color, intensity, distance } = { ...cfg, ...cfg.only?.[o.name] };
            lamps.push({ pos: o.getWorldPosition(new THREE.Vector3()), color: new THREE.Color(color), base: intensity, distance, dipUntil: 0, w: 0, d: 0, slot: null });
          });
          for (let i = 0; i < Math.min(LAMP_POOL, lamps.length); i++) {
            const light = new THREE.PointLight(0xffffff, 0, 1, 2);
            scene.add(light);
            lampPool.push(light);
          }
        }

        // Live notes on the corkboard, refetched while the level is open.
        const boardNode = level.pinboard ? model.getObjectByName('Pinboard') : undefined;
        if (boardNode && level.pinboard) {
          const cfg = level.pinboard;
          const pb = createPinboard(cfg.size);
          boardNode.add(pb.group);
          pinboard = pb;
          const refresh = () => {
            cfg.load().then(d => { if (!disposed) pb.update(d.notes, d.threads); }).catch(() => {});
          };
          refresh();
          pinTimer = window.setInterval(refresh, cfg.refreshSec * 1000);
          refreshPinsRef.current = refresh;
        }

        const hole = level.peeper ? model.getObjectByName('Peephole') : undefined;
        if (hole) {
          const head = createDeepOneHead();
          const holePos = hole.getWorldPosition(new THREE.Vector3());
          const inward = new THREE.Vector3(0, 0, -1).applyQuaternion(hole.getWorldQuaternion(new THREE.Quaternion()));
          // The eye rests just behind the door's outer face, looking in; the
          // head trails off outside, where the door hides it.
          head.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);
          const rest = holePos.clone().addScaledVector(inward, -0.065);
          const side = new THREE.Vector3(1, 0, 0).applyQuaternion(head.group.quaternion);
          head.group.visible = false;
          scene.add(head.group);
          peeper = { head, rest, side, hole: holePos };
          peek.next = 2 + Math.random() * 2;
        }

        for (const tg of targets) {
          const set = level.radios?.[tg.id];
          if (!set) continue;
          const el = new Audio(set.src);
          el.loop = set.loop ?? true;
          el.preload = 'none';
          const center = tg.box.getCenter(new THREE.Vector3());
          // The dial's warm glow while the set is on.
          const glow = new THREE.PointLight(0xffb060, 0, 1.4, 2);
          glow.position.set(center.x, tg.box.max.y, center.z);
          scene.add(glow);
          // A one-off broadcast switches the set off when it finishes.
          el.addEventListener('ended', () => {
            glow.intensity = 0;
            setRadiosOn(prev => {
              const next = new Set(prev);
              next.delete(tg.id);
              return next;
            });
          });
          radios.set(tg.id, { set, el, glow, center, sound: null });
        }

        // Pins in the wall map, one per location, each examinable on its own.
        const mapFace = level.mapPins ? model.getObjectByName('MapFace') : undefined;
        if (mapFace && level.mapPins) {
          const [W, H] = level.mapPins.size;
          const headGeo = new THREE.SphereGeometry(0.03, 12, 8);
          const needleGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.06, 5).rotateX(Math.PI / 2);
          const headMat = new THREE.MeshStandardMaterial({ color: 0xb01e16, roughness: 0.35, emissive: 0x3a0503 });
          const needleMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.8, roughness: 0.3 });
          owned.push(headGeo, needleGeo, headMat, needleMat);
          for (const p of level.mapPins.pins) {
            // The node's -Z faces the room; facing the map, its -X is on the right.
            const pin = new THREE.Group();
            pin.position.set(-(p.u - 0.5) * W, (0.5 - p.v) * H, 0);
            const needle = new THREE.Mesh(needleGeo, needleMat);
            needle.position.z = -0.03;
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.z = -0.065;
            pin.add(needle, head);
            mapFace.add(pin);
            pin.updateMatrixWorld(true);
            // A generous box, so a pin is easy to aim at from arm's length.
            const box = new THREE.Box3().setFromObject(head).expandByScalar(0.05);
            targets.push({ id: `pin-${p.id}`, entry: { title: p.title, text: p.text }, box, pinHead: head });
          }
        }

        // Photographs in frames that were modelled empty, each examinable on its own.
        const framesNode = level.photoFrames ? model.getObjectByName(level.photoFrames.node) : undefined;
        const framesMesh = framesNode?.getObjectByProperty('isMesh', true);
        if (framesMesh && level.photoFrames) {
          const { axes, photos } = level.photoFrames;
          const facing = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
            new THREE.Vector3(...axes.right), new THREE.Vector3(...axes.up), new THREE.Vector3(...axes.out),
          ));
          for (const ph of photos) {
            const [w, h] = ph.size;
            // The print, whole, on an aged mat cut to the opening — cropping a
            // landscape plate to a portrait frame would cut people out of it.
            const canvas = document.createElement('canvas');
            canvas.height = 512;
            canvas.width = Math.round(512 * w / h);
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#a89878';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            const img = new Image();
            img.onload = () => {
              if (disposed) return;
              const margin = canvas.width * 0.06;
              const s = Math.min((canvas.width - 2 * margin) / img.width, (canvas.height - 2 * margin) / img.height);
              const iw = img.width * s, ih = img.height * s;
              ctx.drawImage(img, (canvas.width - iw) / 2, (canvas.height - ih) / 2, iw, ih);
              tex.needsUpdate = true;
            };
            img.src = ph.image;
            const geo = new THREE.PlaneGeometry(w, h);
            const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
            owned.push(geo, mat, tex);
            const print = new THREE.Mesh(geo, mat);
            print.quaternion.copy(facing);
            print.position.set(...ph.center);
            print.receiveShadow = true;
            framesMesh.add(print);
            print.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(print).expandByScalar(0.01);
            targets.push({ id: ph.id, entry: { title: ph.title, text: ph.text, image: ph.image, checks: ph.checks }, box });
          }
        }

        // Stains for the Wood's lamp, laid on the walls and floors they name.
        if (level.uvStains?.length) {
          const loadedModel = model;
          const st = createUvStains(
            level.uvStains,
            (from, dir) => {
              ray.set(from, dir);
              ray.far = 8;
              const hit = ray.intersectObjects(walls, false)[0];
              if (!hit?.face) return null;
              const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
              if (normal.dot(dir) > 0) normal.negate();
              return { point: hit.point.clone(), normal };
            },
            // From just above the boards, so rugs count as floor and tabletops don't.
            (x, z, nearY) => {
              ray.set(tmpV.set(x, nearY + 0.3, z), down);
              ray.far = 1;
              const hit = ray.intersectObject(loadedModel, true)[0];
              return hit ? hit.point.y : null;
            },
          );
          scene.add(st.group);
          stains = st;
          for (const piece of st.pieces) {
            targets.push({ id: piece.stain.id, entry: piece.stain, box: piece.box, uv: { point: piece.point, normal: piece.normal } });
          }
        }

        // People, standing at their markers. Each is a target the size of a person.
        for (const spot of level.npcs ?? []) {
          const node = model.getObjectByName(spot.node);
          if (!node) { console.warn(`NPC "${spot.id}" has no "${spot.node}" marker`); continue; }
          const home = node.getWorldPosition(new THREE.Vector3());
          const homeYaw = new THREE.Euler().setFromQuaternion(node.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
          const person: (typeof npcs)[number] = { avatar: null, home, homeYaw };
          npcs.push(person);
          const box = new THREE.Box3(new THREE.Vector3(home.x - 0.35, home.y, home.z - 0.35), new THREE.Vector3(home.x + 0.35, home.y + 1.85, home.z + 0.35));
          targets.push({ id: `npc-${spot.id}`, entry: { title: spot.name, text: '' }, box, npc: spot });
          createAvatar(spot.outfit, spot.name).then(av => {
            if (disposed) { av.dispose(); return; }
            person.avatar = av;
            av.setTarget(home, homeYaw, 'idle');
            scene.add(av.group);
          }).catch(err => console.error('NPC figure failed to load:', err));
        }

        // Examinables with no furniture of their own: an invisible box each.
        for (const [id, spot] of Object.entries(level.spots ?? {})) {
          const entry = level.examinables[id];
          if (entry) targets.push({ id, entry, box: new THREE.Box3(new THREE.Vector3(...spot.min), new THREE.Vector3(...spot.max)) });
        }

        // Small things to pick up, each stood on its piece of furniture. The level
        // opens once they are down, so their markers and focus boxes exist.
        const placeInspectable = async (id: string, insp: Inspectable) => {
          const anchor = insp.on ? pieceById.get(insp.on) : undefined;
          const entry = level.examinables[id];
          if ((!anchor && !insp.at) || !entry) { console.warn('Inspectable has nowhere to stand:', id); return; }
          const gltf = await new GLTFLoader().loadAsync(insp.model);
          if (disposed) return;
          const obj = gltf.scene;
          if (anchor) {
            const base = new THREE.Box3().setFromObject(anchor).getCenter(new THREE.Vector3());
            const [ox, oz] = insp.offset ?? [0, 0];
            const x = base.x + ox, z = base.z + oz;
            // Onto whatever top is under that spot — the desk's, not a hutch above it.
            const hit = new THREE.Raycaster(new THREE.Vector3(x, base.y + 2, z), new THREE.Vector3(0, -1, 0)).intersectObject(anchor, true)[0];
            obj.position.set(x, hit ? hit.point.y : base.y, z);
          } else {
            const [x, z] = insp.at!;
            const floor = groundAt(x, z, 0);
            obj.position.set(x, floor === -Infinity ? 0 : floor, z);
          }
          obj.rotation.y = THREE.MathUtils.degToRad(insp.turnDeg ?? 0);
          obj.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          scene.add(obj);
          obj.updateMatrixWorld(true);
          // A little larger than the object itself, so it is easy to look at.
          const box = new THREE.Box3().setFromObject(obj).expandByScalar(0.04);
          targets.push({ id, entry, box, inspect: insp });
        };
        // Things to carry, laid on their furniture: on their side, turned as set,
        // resting on whatever visible surface is under them.
        const placePickup = async (item: Pickup, anchor: THREE.Object3D) => {
          const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(item.view.model);
          if (disposed) return;
          const { root } = prepareHeldModel(gltf.scene, item.view);
          const lie = new THREE.Group();
          lie.rotation.z = Math.PI / 2;
          lie.add(root);
          const obj = new THREE.Group();
          obj.rotation.y = THREE.MathUtils.degToRad(item.turnDeg ?? 0);
          obj.add(lie);
          obj.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          const base = new THREE.Box3().setFromObject(anchor).getCenter(new THREE.Vector3());
          const x = base.x + item.at[0], z = base.z + item.at[1];
          const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
          const hit = new THREE.Raycaster(new THREE.Vector3(x, base.y + 2, z), new THREE.Vector3(0, -1, 0))
            .intersectObject(anchor, true).find(h => shown(h.object));
          obj.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(obj, true);
          const centre = box.getCenter(new THREE.Vector3());
          obj.position.set(x - centre.x, (hit ? hit.point.y : base.y) - box.min.y + 0.002, z - centre.z);
          scene.add(obj);
          obj.updateMatrixWorld(true);
          pickupById.set(item.id, { item, obj });
          // Ready in the hand too, so it comes up and reloads the moment it is taken.
          inHand.preload(item.view);
          targets.push({ id: `pickup-${item.id}`, entry: { title: item.title, text: '' }, box: new THREE.Box3().setFromObject(obj, true).expandByScalar(0.05), pickup: item });
        };
        const pickupLoads = (level.pickups ?? []).flatMap(table => {
          const anchor = model?.getObjectByName(table.on);
          if (!anchor) { console.warn('Pickups have nowhere to lie:', table.on); return []; }
          for (const name of table.hide ?? []) {
            const stand = anchor.getObjectByName(name);
            if (stand) stand.visible = false;
          }
          return table.items.map(item => placePickup(item, anchor).catch(err => console.error('Pickup failed to load:', item.id, err)));
        });
        Promise.all([
          ...Object.entries(level.inspectables ?? {}).filter(([, insp]) => !insp.in).map(([id, insp]) =>
            placeInspectable(id, insp).catch(err => console.error('Inspectable failed to load:', id, err)),
          ),
          ...pickupLoads,
        ]).then(() => {
          if (disposed) return;
          // Stains get no marker: finding them is the lamp's job. People have their names over their heads.
          markers = createInteractMarkers(targets.filter(t => !t.pinHead && !t.uv && !t.npc && !t.pickup));
          scene.add(markers.group);
          setLoaded(true);
        });
      },
      (ev) => { if (ev.lengthComputable) setProgress(ev.loaded / ev.total); },
      (err) => { console.error('Walkthrough GLB load error:', level.model, err); if (!disposed) setLoadError(true); },
    );

    // Audio is wired up on the first switch-on: browsers only let an
    // AudioContext start from a user gesture, and that key press is one.
    toggleRadioRef.current = (id) => {
      const r = radios.get(id);
      if (!r) return;
      const ear = ensureListener();
      if (!r.sound) {
        const sound = new THREE.PositionalAudio(ear);
        sound.setMediaElementSource(r.el);
        sound.setRefDistance(r.set.refDistance);
        sound.setRolloffFactor(1.4);
        sound.setVolume(r.set.volume);
        // Cut the lows and highs: a 1930s cabinet speaker, not a gramophone.
        const ctx = ear.context;
        const low = ctx.createBiquadFilter();
        low.type = 'highpass';
        low.frequency.value = 250;
        const high = ctx.createBiquadFilter();
        high.type = 'lowpass';
        high.frequency.value = 3800;
        sound.setFilters([low, high]);
        sound.position.copy(r.center);
        scene.add(sound);
        r.sound = sound;
      }
      const on = r.el.paused;
      // A broadcast starts over each time, so nobody hears it from the middle.
      if (on && !r.el.loop) r.el.currentTime = 0;
      if (on) r.el.play().catch(() => {});
      else r.el.pause();
      r.glow.intensity = on ? 0.6 : 0;
      setRadiosOn(prev => {
        const next = new Set(prev);
        if (on) next.add(id); else next.delete(id);
        return next;
      });
    };

    // ── Input ───────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      // A level with birds calling needs sound from the start; a key press lets it begin.
      if (level.birds?.cries || level.weather) ensureListener();
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        keys.add(e.code);
        if (e.code.startsWith('Arrow')) e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
    const onBlur = () => keys.clear();
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yaw -= e.movementX * LOOK;
      pitch = Math.max(-1.35, Math.min(1.35, pitch - e.movementY * LOOK));
    };
    const onCanvasClick = () => {
      if (level.birds?.cries || level.weather) ensureListener();
      if (readingRef.current || browsingRef.current || typingRef.current || invOpenRef.current || inspectingRef.current) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
      else if (focusRef.current) openTarget(focusRef.current);
    };
    const onLockChange = () => {
      const isLocked = document.pointerLockElement === canvas;
      if (!isLocked) { unlockedAtRef.current = performance.now(); keys.clear(); }
      setLocked(isLocked);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    canvas.addEventListener('click', onCanvasClick);

    // ── Other investigators ─────────────────────────────────────────
    // Everyone in the same level sees everyone else, as an animated figure
    // walking where they walk. One figure per connection; a figure appears
    // once its first position arrives.
    const avatars = new Map<number, { avatar: RemoteAvatar | null; peer: Peer }>();
    // The level's own people (see NpcSpot): where they stand and which way they face at rest.
    const npcs: { avatar: RemoteAvatar | null; home: THREE.Vector3; homeYaw: number }[] = [];

    // Figures walking their loops (see Wanderer). Each loads on its own; until then it is absent.
    const wanderers: { root: THREE.Object3D; mixer: THREE.AnimationMixer; curve: THREE.CatmullRomCurve3; length: number; speed: number; along: number }[] = [];
    for (const w of level.wanderers ?? []) {
      new GLTFLoader().loadAsync(w.model).then(gltf => {
        if (disposed) return;
        const y = w.y ?? 0;
        const curve = new THREE.CatmullRomCurve3(w.path.map(([x, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
        const root = gltf.scene;
        root.traverse(o => {
          const m = o as THREE.Mesh;
          if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; }   // skinned bounds lag the walk
        });
        const mixer = new THREE.AnimationMixer(root);
        const clip = (w.clip && gltf.animations.find(a => a.name === w.clip)) || gltf.animations[0];
        if (clip) mixer.clipAction(clip).play();
        scene.add(root);
        wanderers.push({ root, mixer, curve, length: curve.getLength(), speed: w.speed, along: 0 });
      }).catch(err => console.error('Wanderer failed to load:', w.model, err));
    }
    const wanderAhead = new THREE.Vector3();
    const onPeers = (peers: Peer[]) => {
      if (disposed) return;
      const live = new Set(peers.map(p => p.id));
      for (const [id, a] of avatars) {
        if (!live.has(id)) { a.avatar?.dispose(); avatars.delete(id); }
      }
      for (const peer of peers) {
        const known = avatars.get(peer.id);
        if (known) { known.peer = peer; continue; }
        const entry = { avatar: null as RemoteAvatar | null, peer };
        avatars.set(peer.id, entry);
        createAvatar(peer.slug, peer.name).then(av => {
          if (disposed || avatars.get(peer.id) !== entry) { av.dispose(); return; }
          entry.avatar = av;
          av.group.visible = false;
          scene.add(av.group);
        }).catch(err => console.error('Avatar load failed:', err));
      }
      setCompanions(peers.filter(p => p.pose).map(p => p.name));
    };
    const presence = joinLevel(level.id, onPeers);
    const lastFeet = new THREE.Vector3().copy(feet);
    const tmpFeet = new THREE.Vector3();
    let gaitHold = 0;
    let lastYaw = 0, lastPitch = 0;
    let shownGait: Gait = 'idle';

    // ── Animate ─────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const lookDir = new THREE.Vector3();
    let flickerUntil = 0;
    let lastFocusId: string | null = null;
    const toHazard = new THREE.Vector3();
    let dread = 0;          // 0..1 — how far the gaze blur has taken hold
    let dreadHazard: GazeHazard | null = null;
    let shownBlur = -1;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Ease the light toward the time of day over a few seconds.
      if (level.weather) {
        const spec = RAIN_SPECS[rainRef.current];
        const k = withRain(skyFor(weatherRef.current, level), rainRef.current);
        const a = 1 - Math.exp(-dt / 1.2);
        // Rain comes on and eases off over a few seconds, too.
        const ra = 1 - Math.exp(-dt / 2.5);
        rainNow.drops += (spec.drops - rainNow.drops) * ra;
        rainNow.wind += (spec.wind - rainNow.wind) * ra;
        rainNow.loudness += (spec.loudness - rainNow.loudness) * ra;
        rainNow.storm += ((spec.lightning ? 1 : 0) - rainNow.storm) * ra;
        sky.zenith.lerp(goal.set(k.zenith), a);
        sky.horizon.lerp(goal.set(k.horizon), a);
        sky.sunColor.lerp(goal.set(k.sunColor), a);
        sky.sunDir.lerp(goalDir.set(...k.sunDir).normalize(), a).normalize();
        sky.sunIntensity += (k.sunIntensity - sky.sunIntensity) * a;
        sky.fogColor.lerp(goal.set(k.fogColor), a);
        sky.fogDensity += (k.fogDensity - sky.fogDensity) * a;
        sky.hemiSky.lerp(goal.set(k.hemiSky), a);
        sky.hemiGround.lerp(goal.set(k.hemiGround), a);
        sky.fill += (k.fill - sky.fill) * a;
        sky.stars += (k.stars - sky.stars) * a;
        const fog = scene.fog as THREE.FogExp2;
        fog.color.copy(sky.fogColor);
        fog.density = sky.fogDensity;
        (scene.background as THREE.Color).copy(sky.horizon);
        hemi.color.copy(sky.hemiSky);
        hemi.groundColor.copy(sky.hemiGround);
        // Lightning, in a storm: the bolts come from the clock, so everyone sees the same one.
        flash = Math.max(0, flash - dt * 7);
        if (rainNow.storm > 0.5) {
          const slot = Math.floor(Date.now() / 1500);
          let r = Math.sin(slot * 12.9898) * 43758.5453;
          r -= Math.floor(r);
          if (slot !== lastBolt && r < 0.09) {
            lastBolt = slot;
            flash = 1;
            // The thunder follows, sooner and sharper the nearer the strike.
            const delay = 0.5 + (r / 0.09) * 3;
            rainSound?.thunder(delay, 1 - delay / 3.5);
          }
        }
        // A bolt is two hard pulses of white.
        const bolt = flash > 0 ? flash * (0.6 + 0.4 * Math.sin(flash * 40)) : 0;
        hemi.intensity = sky.fill + bolt * 4;
        if (moon) {
          moon.color.copy(sky.sunColor);
          moon.intensity = sky.sunIntensity;
          moon.position.copy(sky.sunDir).multiplyScalar(30);
        }
        if (bolt > 0 && dome) {
          const white = new THREE.Color(0xdfe6ff);
          dome.set(sky.zenith.clone().lerp(white, bolt * 0.7), sky.horizon.clone().lerp(white, bolt * 0.5), sky.sunColor, sky.sunDir, sky.stars);
        } else {
          dome?.set(sky.zenith, sky.horizon, sky.sunColor, sky.sunDir, sky.stars);
        }

        // The rain, catching what light there is.
        rainTint.copy(sky.horizon).lerp(goal.set(0xe8eef4), 0.35).multiplyScalar(0.55 + bolt * 0.8);
        rainFall?.update(dt, camera.position, rainNow.drops, rainNow.wind, rainTint);
        if (listener && !rainSound) rainSound = createRainSound(listener.context, listener.getInput());
        const overhead = cover ? cover.at(camera.position.x, camera.position.z) : -Infinity;
        rainSound?.update(dt, rainNow.loudness, Math.min(1, rainNow.wind / 4.5), overhead > camera.position.y);
        if (model && !sea) {
          model.traverse(o => {
            const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if (!sea && mat?.name === 'sea' && mat.isMeshStandardMaterial) sea = { mat, night: mat.color.clone() };
          });
        }
        if (sea) sea.mat.color.copy(sea.night).lerp(goal.copy(sky.horizon).multiplyScalar(0.32), 1 - sky.stars);
      }
      flock?.update(dt, Date.now(), weatherRef.current, RAIN_SPECS[rainRef.current].grounded);

      // Take up a request to sleep or wake.
      const cmd = sleepCmdRef.current;
      sleepCmdRef.current = null;
      if (cmd && 'bed' in cmd && !sleep && model) {
        const bed = cmd.bed.bed!;
        const box = cmd.bed.box;
        const mid = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const head = new THREE.Vector3(bed.head[0], 0, bed.head[1]);
        const long = Math.abs(head.x) > 0.5 ? size.x : size.z;
        const wide = Math.abs(head.x) > 0.5 ? size.z : size.x;
        // The top of the mattress: down from under a bunk's upper berth, or from above a plain bed.
        const from = Math.min(box.max.y + 0.3, box.min.y + 1.25);
        const piece = bedPieces.get(cmd.bed.id);
        const top = (piece ? new THREE.Raycaster(new THREE.Vector3(mid.x, from, mid.z), down).intersectObject(piece, true) : [])
          .find(h => h.point.y < from - 0.05 && h.point.y > box.min.y)?.point.y ?? box.min.y + 0.55;
        const lie = mid.clone().addScaledVector(head, long / 2 - 0.35).setY(top + 0.14);
        // On your back, head on the pillow, looking up past your feet.
        const lieQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.15, Math.atan2(head.x, head.z), 0, 'YXZ'));
        const out = new THREE.Vector3(bed.out[0], 0, bed.out[1]);
        const up = mid.clone().addScaledVector(out, wide / 2 + 0.45).setY(feet.y);
        sleep = { phase: 'lying', lie, lieQ, up, upYaw: Math.atan2(-out.x, -out.z), k: 0, dark: 0 };
        keys.clear();
        setAsleep('lying');
      } else if (cmd && 'wake' in cmd && sleep && sleep.phase !== 'waking') {
        sleep.phase = 'waking';
        setAsleep('waking');
      }

      if (model && !sleep && !readingRef.current && !browsingRef.current && !typingRef.current && !invOpenRef.current && !inspectingRef.current) {
        // Arrow keys turn, so the level is walkable without pointer lock too.
        if (keys.has('ArrowLeft')) yaw += 1.8 * dt;
        if (keys.has('ArrowRight')) yaw -= 1.8 * dt;

        let f = 0, s = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
        if (keys.has('KeyD')) s += 1;
        if (keys.has('KeyA')) s -= 1;
        if (f || s) {
          const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK) * dt;
          const n = Math.hypot(f, s);
          const sin = Math.sin(yaw), cos = Math.cos(yaw);
          const dx = (-sin * f + cos * s) / n * speed;
          const dz = (-cos * f - sin * s) / n * speed;
          // Slide along walls: if the full step is blocked, try each axis alone.
          if (!tryMove(dx, dz)) { tryMove(dx, 0); tryMove(0, dz); }
        }
        // Settle onto whatever is underfoot (stairs up, or a drop).
        const g = groundAt(feet.x, feet.z, feet.y);
        if (g !== -Infinity) feet.y = g > feet.y ? g : Math.max(g, feet.y - 4 * dt);
      }

      camera.position.set(feet.x, feet.y + EYE + Math.sin(t * 1.3) * 0.004, feet.z);
      camera.rotation.set(pitch, yaw, 0);
      // Lying down, sleeping, getting up: ease between standing and lying, and fade.
      if (sleep) {
        if (sleep.phase === 'lying') {
          sleep.k = Math.min(1, sleep.k + dt / 1.3);
          if (sleep.k >= 1) sleep.dark = Math.min(1, sleep.dark + dt / 2.2);
          if (sleep.dark >= 1) { sleep.phase = 'asleep'; setAsleep('asleep'); }
        } else if (sleep.phase === 'waking') {
          sleep.dark = Math.max(0, sleep.dark - dt / 1.1);
          if (sleep.dark <= 0.35) {
            // Up and out beside the bed, facing the room.
            if (feet.x !== sleep.up.x || feet.z !== sleep.up.z) {
              feet.copy(sleep.up);
              yaw = sleep.upYaw;
              pitch = 0;
            }
            sleep.k = Math.max(0, sleep.k - dt / 1.2);
          }
        } else {
          // Asleep: breathing, slow and deep.
          sleep.lie.y += Math.sin(t * 0.9) * 0.00008;
        }
        const e = sleep.k * sleep.k * (3 - 2 * sleep.k);
        standQ.setFromEuler(camEuler.set(pitch, yaw, 0, 'YXZ'));
        camera.position.set(feet.x, feet.y + EYE, feet.z).lerp(sleep.lie, e);
        camera.quaternion.slerpQuaternions(standQ, sleep.lieQ, e);
        if (sleepShadeRef.current) sleepShadeRef.current.style.opacity = String(sleep.dark * 0.95);
        if (sleep.phase === 'waking' && sleep.k <= 0 && sleep.dark <= 0) {
          sleep = null;
          setAsleep('no');
          if (sleepShadeRef.current) sleepShadeRef.current.style.opacity = '0';
        }
      }
      camera.updateMatrixWorld();

      // The Wood's lamp: raise or lower it, let the tube warm, and light the stains.
      const uvLamps: UvLamp[] = [];
      if (woods) {
        woods.setDrawn(lampOutRef.current);
        woods.setSwitch(lampOnRef.current);
        const pace = dt > 0 ? Math.min(1, Math.hypot(feet.x - lastFeet.x, feet.z - lastFeet.z) / dt / RUN) : 0;
        woods.update(dt, [yaw - lastYaw, pitch - lastPitch], pace);
        uvSpot.intensity = woods.power * 20;
        uvSpot.getWorldPosition(uvOwn.pos);
        uvOwn.dir.copy(uvSpot.target.getWorldPosition(tmpV)).sub(uvOwn.pos).normalize();
        uvOwn.power = woods.power;
        if (uvOwn.power > 0) uvLamps.push(uvOwn);
        let slot = 0;
        for (const { avatar, peer } of avatars.values()) {
          const aim = peer.pose?.lamp;
          if (!avatar || aim === undefined || slot >= remoteLamps.length) continue;
          const r = remoteLamps[slot++];
          const ay = peer.pose!.yaw;
          const fwd = tmpV.set(-Math.sin(ay), 0, -Math.cos(ay));
          // In the right hand, a little ahead and to the side, at chest height.
          r.lamp.pos.copy(avatar.group.position).add(new THREE.Vector3(0, 1.35, 0))
            .addScaledVector(fwd, 0.35).addScaledVector(new THREE.Vector3(-fwd.z, 0, fwd.x), 0.18);
          r.lamp.dir.set(-Math.sin(ay) * Math.cos(aim), Math.sin(aim), -Math.cos(ay) * Math.cos(aim));
          r.lamp.power = 1;
          r.light.position.copy(r.lamp.pos);
          r.light.target.position.copy(r.lamp.pos).add(r.lamp.dir);
          r.light.intensity = 20;
          r.light.visible = true;
          r.glow.position.copy(r.lamp.pos);
          r.glow.visible = true;
          uvLamps.push(r.lamp);
        }
        for (let i = slot; i < remoteLamps.length; i++) {
          // Off, not just dark: an unlit light still costs every pixel.
          remoteLamps[i].light.visible = false;
          remoteLamps[i].glow.visible = false;
        }
        stains?.setLamps(uvLamps);
      }
      // The item in hand comes up when chosen; the Wood's lamp takes the same hand, so it goes away while that is out.
      const carriedNow = carriedRef.current ? pickupById.get(carriedRef.current) : undefined;
      inHand.setItem(lampOutRef.current ? null : carriedNow ? carriedNow.item.view : heldModelFor(heldItemRef.current));
      // A carried pickup is gone from where it lay; the rest stay put.
      for (const p of pickupById.values()) p.obj.visible = p.item.id !== carriedRef.current;
      const stride = dt > 0 ? Math.min(1, Math.hypot(feet.x - lastFeet.x, feet.z - lastFeet.z) / dt / RUN) : 0;
      inHand.update(dt, [yaw - lastYaw, pitch - lastPitch], stride);
      lastYaw = yaw;
      lastPitch = pitch;

      // Tell the others where we are and how fast we're going. A short hold
      // keeps a single blocked frame from flicking the figure to idle.
      if (model) {
        const speed = dt > 0 ? Math.hypot(feet.x - lastFeet.x, feet.z - lastFeet.z) / dt : 0;
        lastFeet.copy(feet);
        const gait: Gait = speed > (WALK + RUN) / 2 ? 'run' : speed > 0.3 ? 'walk' : 'idle';
        if (gait !== 'idle') { shownGait = gait; gaitHold = 0.15; }
        else if ((gaitHold -= dt) <= 0) shownGait = 'idle';
        presence.setPose({ p: [feet.x, feet.y, feet.z], yaw, gait: shownGait, lamp: uvOwn.power > 0.3 ? pitch : undefined });
      }
      for (const { avatar, peer } of avatars.values()) {
        if (!avatar) continue;
        avatar.group.visible = !!peer.pose;
        if (peer.pose) avatar.setTarget(tmpFeet.fromArray(peer.pose.p), peer.pose.yaw, peer.pose.gait);
        avatar.update(dt);
      }
      // Wanderers walk on round their loops, facing the way they go.
      for (const w of wanderers) {
        w.mixer.update(dt);
        w.along = (w.along + w.speed * dt) % w.length;
        const u = w.along / w.length;
        w.curve.getPointAt(u, w.root.position);
        w.curve.getTangentAt(u, wanderAhead);
        w.root.rotation.y = Math.atan2(wanderAhead.x, wanderAhead.z);
      }

      // People turn to watch whoever comes near, and settle back when they leave.
      // Their names show only close to, so a name never gives them away through a wall.
      for (const { avatar, home, homeYaw } of npcs) {
        if (!avatar) continue;
        const dx = camera.position.x - home.x;
        const dz = camera.position.z - home.z;
        const near = Math.hypot(dx, dz) < 5 && Math.abs(camera.position.y - EYE - home.y) < 1;
        avatar.setTarget(home, near ? Math.atan2(-dx, -dz) : homeYaw, 'idle');
        avatar.label.visible = near;
        avatar.update(dt);
      }

      // The torch stutters now and then.
      if (torchRef.current && !woods?.visible) {
        if (t > flickerUntil && Math.random() < 0.002) flickerUntil = t + 0.25 + Math.random() * 0.4;
        torch.intensity = t < flickerUntil ? (Math.random() < 0.5 ? 4 : 30) : 40;
      } else {
        torch.intensity = 0;
      }
      inHand.setTorch(torch.intensity / 40);
      // The Deep One: slide in behind the hole from one side, stare, withdraw.
      if (peeper && level.peeper) {
        const cfg = level.peeper;
        const shy = camera.position.distanceTo(peeper.hole) < cfg.shyWithin;
        const rand = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);
        peek.t += dt;
        if (peek.phase === 'away') {
          if (peek.t >= peek.next && !shy) {
            Object.assign(peek, { phase: 'in', t: 0, hold: rand(cfg.holdSec), from: Math.random() < 0.5 ? -1 : 1 });
          }
        } else if (peek.phase === 'in' && peek.t >= 0.7) {
          Object.assign(peek, { phase: 'hold', t: 0 });
        } else if (peek.phase === 'hold' && (peek.t >= peek.hold || shy)) {
          Object.assign(peek, { phase: 'out', t: 0 });
        } else if (peek.phase === 'out' && peek.t >= 0.22) {
          Object.assign(peek, { phase: 'away', t: 0, next: rand(cfg.gapSec) });
        }
        // 0 = eye on the hole, 1 = hidden behind the door beside it.
        const off = peek.phase === 'in' ? 1 - THREE.MathUtils.smoothstep(peek.t, 0, 0.7)
          : peek.phase === 'hold' ? 0
          : peek.phase === 'out' ? peek.t / 0.22
          : 1;
        const { group, eye } = peeper.head;
        group.visible = off < 1;
        if (group.visible) {
          group.position.copy(peeper.rest)
            .addScaledVector(peeper.side, peek.from * off * 0.26)
            .add(tmpV.set(0, Math.sin(t * 1.7) * 0.004, 0));   // breathing
          eye.lookAt(camera.position);
        }
      }

      for (const r of radios.values()) if (!r.el.paused) r.glow.intensity = 0.55 + Math.random() * 0.1;
      // Old wiring: now and then a bulb browns out for a moment.
      if (lamps.length) {
        // The nearest lamps get the lights; one already lit keeps its light
        // until another is a metre nearer, so two lamps never trade back and forth.
        for (const l of lamps) l.d = l.pos.distanceTo(camera.position) - (l.slot ? 1 : 0);
        const wanted = new Set([...lamps].sort((a, b) => a.d - b.d).slice(0, lampPool.length));
        const fade = dt / 0.35;
        for (const l of lamps) {
          l.w = wanted.has(l) && l.slot ? Math.min(1, l.w + fade) : Math.max(0, l.w - fade);
          if (l.w === 0 && l.slot && !wanted.has(l)) { l.slot.intensity = 0; l.slot = null; }
        }
        // A wanted lamp takes a light as soon as one is free.
        for (const l of wanted) {
          if (l.slot) continue;
          const free = lampPool.find(p => !lamps.some(o => o.slot === p));
          if (!free) break;
          l.slot = free;
          free.position.copy(l.pos);
          free.color.copy(l.color);
          free.distance = l.distance;
        }
        for (const l of lamps) {
          // Old wiring: now and then a bulb browns out for a moment.
          if (t > l.dipUntil && Math.random() < 0.0008) l.dipUntil = t + 0.08 + Math.random() * 0.25;
          if (l.slot) l.slot.intensity = l.w * (t < l.dipUntil ? l.base * (0.25 + Math.random() * 0.3) : l.base);
        }
      }
      for (const fire of fires) fire.intensity = 5 + Math.sin(t * 9) * 0.8 + Math.sin(t * 23) * 0.5 + Math.random() * 0.6;

      // What is the investigator looking at?
      if (model) {
        camera.getWorldDirection(lookDir);
        ray.set(camera.position, lookDir);
        let best: Target | null = null;
        let bestD = REACH;
        for (const tg of targets) {
          if (tg.uv && uvLightAt(uvLamps, tg.uv.point, tg.uv.normal) < UV_SEEN) continue;
          const hit = ray.ray.intersectBox(tg.box, tmpV);
          if (!hit) continue;
          // A person wins over whatever they stand behind (the admissions counter, a desk).
          const d = hit.distanceTo(camera.position) - (tg.npc ? 1.2 : 0);
          if (d < bestD) { bestD = d; best = tg; }
        }
        if (best && wallDist(camera.position.clone(), lookDir, bestD) < bestD - 0.05) best = null;
        focusRef.current = best;
        const id = best?.id ?? null;
        if (id !== lastFocusId) {
          for (const tg of targets) tg.pinHead?.scale.setScalar(tg === best ? 1.6 : 1);
          lastFocusId = id;
          setFocus(best);
        }

        if (markers) {
          markers.group.visible = markersRef.current;
          if (markersRef.current) markers.update(camera.position, t, id);
        }

        // Staring straight at a gaze hazard blurs the view; looking away lets it clear.
        let gazing: GazeHazard | null = null;
        for (const h of hazards) {
          toHazard.subVectors(h.center, camera.position);
          const d = toHazard.length();
          if (d > h.hazard.range || d < 0.01) continue;
          const off = lookDir.angleTo(toHazard);
          const allowed = Math.atan(h.radius / d) + THREE.MathUtils.degToRad(h.hazard.angleDeg);
          if (off > allowed) continue;
          if (wallDist(camera.position.clone(), toHazard.normalize(), d) < d - h.radius) continue;
          gazing = h.hazard;
          break;
        }
        if (gazing) {
          dreadHazard = gazing;
          dread = Math.min(1, dread + dt / gazing.onsetSec);
        } else if (dreadHazard) {
          dread = Math.max(0, dread - dt / dreadHazard.recoverSec);
        }
      }

      // Ease in, and let the blur swell and ebb a little so it feels alive.
      const eased = dread * dread * (3 - 2 * dread);
      const blur = dreadHazard ? eased * dreadHazard.maxBlurPx * (1 + 0.15 * Math.sin(t * 2.3)) : 0;
      const rounded = Math.round(blur * 10) / 10;
      if (rounded !== shownBlur) {
        shownBlur = rounded;
        canvas.style.filter = rounded > 0
          ? `blur(${rounded}px) saturate(${1 - eased * 0.4}) hue-rotate(${eased * 18}deg)`
          : '';
      }

      dome?.mesh.position.copy(camera.position);
      renderer.render(scene, camera);
      if (woods?.visible || inHand.visible) {
        // What is in hand draws over everything, so it never dips into a wall.
        renderer.autoClear = false;
        renderer.clearDepth();
        if (woods?.visible) woods.render(renderer);
        inHand.render(renderer);
        renderer.autoClear = true;
      }
    };
    animate();

    // ── Resize ──────────────────────────────────────────────────────
    const onResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      woods?.resize(w / h);
      inHand.resize(w / h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      presence.leave();
      for (const a of avatars.values()) a.avatar?.dispose();
      avatars.clear();
      setCompanions([]);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.style.filter = '';
      window.removeEventListener('resize', onResize);
      toggleRadioRef.current = null;
      reloadRef.current = null;
      refreshPinsRef.current = null;
      window.clearInterval(pinTimer);
      pinboard?.dispose();
      markers?.dispose();
      stains?.dispose();
      for (const p of npcs) p.avatar?.dispose();
      for (const w of wanderers) {
        w.mixer.stopAllAction();
        w.root.removeFromParent();
        w.root.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          for (const mat of [m.material].flat()) mat.dispose();
        });
      }
      woods?.dispose();
      inHand.dispose();
      dome?.dispose();
      flock?.dispose();
      rainFall?.dispose();
      cover?.texture.dispose();
      rainSound?.dispose();
      for (const o of owned) o.dispose();
      peeper?.head.dispose();
      for (const r of radios.values()) {
        r.el.pause();
        r.el.removeAttribute('src');
        r.sound?.disconnect();
      }
      setRadiosOn(new Set());
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      model?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
          m.dispose();
        }
      });
      torch.shadow.map?.dispose();
      renderer.dispose();
      canvasRef.current = null;
      if (el.contains(canvas)) el.removeChild(canvas);
    };
  }, [openTarget, webgl, level, godot]);

  const hint = !webgl ? '3D unavailable' : !loaded
    ? loadError ? level.errorText : `${level.loadingText} ${Math.round(progress * 100)}%`
    : locked
      ? `WASD move · Shift run · Mouse look · E / click examine${carriedPickup?.view.reload ? ' · R reload' : canCheck ? ' · R use a skill' : ''}${heldItem ? ' · U use item' : ''} · I inventory · F ${lampOut ? 'lamp switch' : 'torch'}${hasLamp ? " · Q Wood's lamp" : ''} · Tab markers · Esc release`
      : 'Click the view to look around · arrow keys also move and turn';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(5,4,3,0.94)',
        backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(1100px, 94vw)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--brass-dim)',
          boxShadow: '0 0 0 1px rgba(201,148,79,0.12), 0 32px 100px rgba(0,0,0,0.95)',
          background: '#050403',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px 9px',
          borderBottom: '1px solid rgba(201,148,79,0.18)',
          background: 'rgba(201,148,79,0.04)',
        }}>
          <div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '2.5px',
              color: 'var(--blood)', border: '1px solid var(--blood)',
              padding: '2px 6px', marginRight: 10,
            }}>
              EXPLORATION
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--parchment)' }}>
              {level.title}
            </span>
            {companions.length > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--forest)', marginLeft: 14, letterSpacing: '0.4px' }}>
                ● Here with you: {companions.join(', ')}
              </span>
            )}
          </div>
          {/* The GM sets the time of day here for everyone in the level. */}
          {level.weather && isGM && (
            <div role="group" aria-label="Time of day" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', marginRight: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', color: weatherError ? 'var(--blood)' : 'var(--ink-text-2)', marginRight: 4 }}>
                {weatherError ? 'Not saved' : 'Time'}
              </span>
              {TIMES.map(time => (
                <button
                  key={time}
                  onClick={() => void setWeather({ time })}
                  aria-pressed={weatherTime === time}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                    padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    background: weatherTime === time ? 'rgba(201,148,79,0.18)' : 'transparent',
                    border: `1px solid ${weatherTime === time ? 'var(--brass)' : 'var(--line)'}`,
                    color: weatherTime === time ? 'var(--brass)' : 'var(--ink-text-2)',
                  }}
                >
                  {TIME_LABELS[time]}
                </button>
              ))}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-text-2)', margin: '0 4px 0 10px' }}>
                Rain
              </span>
              {RAINS.map(r => (
                <button
                  key={r}
                  onClick={() => void setWeather({ rain: r })}
                  aria-pressed={rain === r}
                  title={RAIN_LABELS[r]}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                    padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    background: rain === r ? 'rgba(120,150,190,0.2)' : 'transparent',
                    border: `1px solid ${rain === r ? '#8fa6c8' : 'var(--line)'}`,
                    color: rain === r ? '#b9cbe4' : 'var(--ink-text-2)',
                  }}
                >
                  {r === 'none' ? 'Off' : r === 'light' ? 'Light' : r === 'heavy' ? 'Heavy' : 'Storm'}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            aria-label={level.leaveLabel}
            style={{
              background: 'rgba(0,0,0,0.5)', border: '1px solid var(--line)',
              borderRadius: '50%', width: 28, height: 28,
              color: 'var(--ink-text-2)', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Three.js canvas mount + overlays */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
          <div ref={mountRef} style={{ position: 'absolute', inset: 0, cursor: locked ? 'none' : 'pointer' }}>
            {godot && webgl && (
              <iframe
                ref={iframeRef}
                src={godot}
                title={level.title}
                allow="autoplay; fullscreen"
                style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#020202' }}
              />
            )}
          </div>

          {loaded && locked && asleep === 'no' && !reading && !browsing && !typing && !inspecting && (
            <div style={{
              position: 'absolute', left: '50%', top: '50%', width: 6, height: 6,
              marginLeft: -3, marginTop: -3, borderRadius: '50%', pointerEvents: 'none',
              background: focus ? 'var(--brass)' : 'rgba(232,220,200,0.45)',
              boxShadow: focus ? '0 0 8px var(--brass)' : 'none',
            }} />
          )}

          {loaded && focus && asleep === 'no' && !reading && !browsing && !typing && !invOpen && !inspecting && (
            <div style={{
              position: 'absolute', left: '50%', top: 'calc(50% + 22px)', transform: 'translateX(-50%)',
              pointerEvents: 'none', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.5px',
              color: 'var(--parchment)', textShadow: '0 1px 4px #000',
            }}>
              {focus.npc ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Speak to {focus.entry.title.replace(/^The /, 'the ')}</>
              ) : focus.bed ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Sleep in the {focus.entry.title.toLowerCase()}</>
              ) : focus.inspect ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Pick up the {focus.entry.title.toLowerCase()}</>
              ) : focus.pickup ? (
                carried === focus.pickup.id
                  ? <><span style={{ color: 'var(--brass)' }}>[E]</span> Put the {focus.pickup.title} back</>
                  : <><span style={{ color: 'var(--brass)' }}>[E]</span> Pick up the {focus.pickup.title}{carriedPickup ? <span style={{ color: 'var(--ink-text-2)' }}> · the {carriedPickup.title} goes back</span> : null}</>
              ) : focus.collection ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Open {focus.entry.title}</>
              ) : level.typewriters?.[focus.id] ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Type at the {focus.entry.title}</>
              ) : level.radios?.[focus.id] ? (
                <>
                  <span style={{ color: 'var(--brass)' }}>[E]</span> Turn {radiosOn.has(focus.id) ? 'off' : 'on'} {focus.entry.title}
                  <span style={{ color: 'var(--ink-text-2)' }}> · click to examine</span>
                </>
              ) : (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Examine {focus.entry.title}</>
              )}
              {canUseSkillOn(focus) && !carriedPickup?.view.reload && (
                <span style={{ color: 'var(--ink-text-2)' }}> · <span style={{ color: 'var(--brass)' }}>[R]</span> use a skill</span>
              )}
              {(carriedPickup || heldItem) && !focus.pickup && (
                <span style={{ color: 'var(--ink-text-2)' }}> · <span style={{ color: 'var(--brass)' }}>[U]</span> use {carriedPickup ? `the ${carriedPickup.title}` : heldItem}</span>
              )}
            </div>
          )}

          {/* The item in hand, and the last use of it. */}
          {loaded && (carriedPickup || heldItem || usedNote) && !reading && !browsing && !typing && !inspecting && (
            <div style={{
              position: 'absolute', left: 12, bottom: 12, maxWidth: '60%', pointerEvents: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.5px', color: 'var(--parchment)',
              background: 'rgba(0,0,0,0.6)', border: '1px solid var(--brass-dim)', borderRadius: 'var(--r-sm)',
              padding: '6px 10px', textShadow: '0 1px 4px #000',
            }}>
              {usedNote ?? <>
                <span style={{ color: 'var(--ink-text-2)' }}>In hand · </span>{carriedPickup ? `the ${carriedPickup.title}` : heldItem}
                {carriedPickup?.view.reload && <span style={{ color: 'var(--ink-text-2)' }}> · <span style={{ color: 'var(--brass)' }}>[R]</span> reload</span>}
              </>}
            </div>
          )}

          {/* Sleep: the dark comes down over the level, and lifts on waking. */}
          {level.beds && (
            <div
              ref={sleepShadeRef}
              style={{
                position: 'absolute', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8,
              }}
            >
              {asleep === 'asleep' && (
                <>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'rgba(232,220,200,0.75)', letterSpacing: '0.5px' }}>Asleep</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-text-2)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    <span style={{ color: 'var(--brass)' }}>[E]</span> wake
                  </div>
                </>
              )}
            </div>
          )}

          {inspecting?.inspect && (
            <InspectViewer
              key={inspecting.id}
              title={inspecting.entry.title}
              intro={inspecting.entry.text}
              inspectable={inspecting.inspect}
              uvOn={inspectUv}
              onToggleUv={() => setInspectUv(v => !v)}
              found={new Set([...foundClues].filter(k => k.startsWith(`${inspecting.id}/`)).map(k => k.slice(inspecting.id.length + 1)))}
              onFound={clueId => setFoundClues(prev => new Set(prev).add(`${inspecting.id}/${clueId}`))}
              shared={new Set([...sharedClues].filter(k => k.startsWith(`${inspecting.id}/`)).map(k => k.slice(inspecting.id.length + 1)))}
              saved={new Set([...savedClues].filter(k => k.startsWith(`${inspecting.id}/`)).map(k => k.slice(inspecting.id.length + 1)))}
              onShare={clueId => shareClue(inspecting, clueId)}
              onSave={clueId => saveClue(inspecting, clueId)}
              onClose={closeInspect}
              inside={hiddenIn(inspecting.id)}
              onOpenInside={id => openHidden(id, true)}
            />
          )}

          {invOpen && (
            <InventoryPane
              owner={investigator?.name}
              items={items}
              held={heldItem}
              onHold={holdItem}
              onClose={closeInventory}
            />
          )}

          {!webgl && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 8,
              alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-text-2)', letterSpacing: '0.5px',
            }}>
              <div style={{ color: 'var(--blood)', letterSpacing: '1px' }}>3D is unavailable in this browser</div>
              <div style={{ maxWidth: 440, lineHeight: 1.6 }}>
                WebGL is turned off. Enable hardware / graphics acceleration in the browser&apos;s settings and relaunch it,
                then try again.
              </div>
            </div>
          )}

          {webgl && !loaded && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: loadError ? 'var(--blood)' : 'var(--ink-text-2)',
              letterSpacing: '1px',
            }}>
              {loadError ? level.errorText : `${level.loadingText} ${Math.round(progress * 100)}%`}
            </div>
          )}

          {webgl && loaded && !locked && !reading && !browsing && !typing && !invOpen && !inspecting && (
            <div style={{
              position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
              pointerEvents: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '1.5px',
              textTransform: 'uppercase', color: 'var(--brass)',
              background: 'rgba(0,0,0,0.6)', border: '1px solid var(--brass-dim)', padding: '6px 12px',
              borderRadius: 'var(--r-sm)',
            }}>
              {level.enterText}
            </div>
          )}

          {webgl && loaded && !locked && level.credit && (
            <div style={{
              position: 'absolute', right: 10, bottom: 8, pointerEvents: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.5px', color: 'var(--ink-text-2)',
              opacity: 0.7,
            }}>
              {level.credit}
            </div>
          )}

          {browsing && (
            <ArchiveBrowser
              title={browsing.target.entry.title}
              intro={browsing.target.entry.text}
              docs={browsing.docs}
              error={browsing.error}
              emptyText={browsing.target.collection?.emptyText ?? ''}
              shared={new Set([...sharedDocs].filter(k => k.startsWith(`${browsing.target.id}/`)).map(k => k.slice(browsing.target.id.length + 1)))}
              onShare={doc => shareDoc(browsing.target, doc)}
              onClose={closeBrowsing}
            />
          )}

          {typing?.npc && <NpcConversation npc={typing.npc} onClose={closeTyping} />}

          {typing && level.typewriters?.[typing.id] && (
            <TypewriterPane
              title={typing.entry.title}
              typewriter={level.typewriters[typing.id]}
              author={author}
              onPinned={() => refreshPinsRef.current?.()}
              onClose={closeTyping}
            />
          )}

          {reading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)',
            }}>
              <div style={{
                width: reading.entry.image || skillsOpen ? 'min(760px, 92%)' : 'min(440px, 86%)', padding: '16px 18px',
                maxHeight: '94%', overflowY: 'auto',
                background: 'rgba(14,11,8,0.96)', border: '1px solid var(--brass-dim)',
                borderRadius: 'var(--r-md)', boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-text-2)' }}>
                  {reading.uv ? 'Under the Wood\'s lamp' : 'Examined'}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--parchment)', margin: '4px 0 10px' }}>
                  {reading.entry.title}
                </div>
                {reading.entry.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reading.entry.image}
                    alt={reading.entry.title}
                    style={{
                      display: 'block', width: '100%', maxHeight: '44vh', objectFit: 'contain',
                      marginBottom: 12, background: '#000', border: '1px solid var(--line)',
                    }}
                  />
                )}
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--parchment)', margin: 0 }}>
                  {reading.entry.text}
                </p>
                {skillsOpen && investigator && onCheck && canUseSkillOn(reading) && (
                  <SkillCheckPane
                    key={reading.id}
                    objectTitle={reading.entry.title}
                    checks={reading.entry.checks ?? []}
                    investigator={investigator}
                    attempts={Object.fromEntries(Object.entries(attempts)
                      .filter(([k]) => k.startsWith(`${reading.id}/`))
                      .map(([k, a]) => [k.slice(reading.id.length + 1), a]))}
                    roll={(skill, target) => onCheck(skill, target, reading.entry.title)}
                    onAttempt={a => {
                      const key = `${reading.id}/${a.skill}`;
                      setAttempts(prev => ({ ...prev, [key]: a }));
                      setSharedChecks(prev => { const next = new Set(prev); next.delete(key); return next; });
                      setSavedChecks(prev => { const next = new Set(prev); next.delete(key); return next; });
                    }}
                    onShare={(skill, text) => {
                      onShare(text);
                      setSharedChecks(prev => new Set(prev).add(`${reading.id}/${skill}`));
                    }}
                    shared={new Set([...sharedChecks].filter(k => k.startsWith(`${reading.id}/`)).map(k => k.slice(reading.id.length + 1)))}
                    onSave={async (skill, note) => {
                      // A finding is filed on clue paper, below the players' own notes.
                      await fileNote(note, author, { prefix: 'clue', color: '#e8dcc0' });
                      setSavedChecks(prev => new Set(prev).add(`${reading.id}/${skill}`));
                      refreshPinsRef.current?.();
                    }}
                    saved={new Set([...savedChecks].filter(k => k.startsWith(`${reading.id}/`)).map(k => k.slice(reading.id.length + 1)))}
                  />
                )}
                {hiddenIn(reading.id).some(h => h.ready) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {hiddenIn(reading.id).filter(h => h.ready).map(h => (
                      <button
                        key={h.id}
                        onClick={() => openHidden(h.id)}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                          padding: '6px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                          background: 'rgba(201,148,79,0.16)', border: '1px solid var(--brass)', color: 'var(--parchment)',
                        }}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                  {canUseSkillOn(reading) && (
                    <button
                      onClick={() => setSkillsOpen(v => !v)}
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                        padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', marginRight: 'auto',
                        background: skillsOpen ? 'rgba(201,148,79,0.16)' : 'rgba(201,148,79,0.08)',
                        border: '1px solid var(--brass-dim)', color: 'var(--brass)',
                      }}
                    >
                      {skillsOpen ? 'Hide skills [R]' : 'Use a skill [R]'}
                    </button>
                  )}
                  {heldItem && (
                    <button
                      onClick={() => applyItem(reading, heldItem)}
                      title={`Use ${heldItem} on the ${reading.entry.title.toLowerCase()}`}
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                        padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', maxWidth: 220,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        background: 'rgba(201,148,79,0.08)', border: '1px solid var(--brass-dim)', color: 'var(--brass)',
                      }}
                    >
                      Use {heldItem} [U]
                    </button>
                  )}
                  <button
                    onClick={() => void saveFind(reading)}
                    disabled={savedFinds.has(reading.id) || savingFind === reading.id}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                      padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: savedFinds.has(reading.id) ? 'default' : 'pointer',
                      background: 'rgba(201,148,79,0.08)', border: '1px solid var(--brass-dim)',
                      color: savedFinds.has(reading.id) ? 'var(--ink-text-2)' : 'var(--brass)',
                    }}
                  >
                    {savedFinds.has(reading.id) ? 'On the case board' : savingFind === reading.id ? 'Pinning…' : 'Save to case board'}
                  </button>
                  <button
                    onClick={() => share(reading)}
                    disabled={shared.has(reading.id)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                      padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: shared.has(reading.id) ? 'default' : 'pointer',
                      background: 'rgba(201,148,79,0.08)', border: '1px solid var(--brass-dim)',
                      color: shared.has(reading.id) ? 'var(--ink-text-2)' : 'var(--brass)',
                    }}
                  >
                    {shared.has(reading.id) ? 'Shared with party' : 'Share with party'}
                  </button>
                  <button
                    onClick={closeReading}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                      padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                      background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-text-2)',
                    }}
                  >
                    Back [E]
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '8px 16px', borderTop: '1px solid rgba(201,148,79,0.12)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', letterSpacing: '0.4px', minWidth: 0 }}>
            {hint}
          </span>
          <span style={{ display: 'flex', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 9, whiteSpace: 'nowrap' }}>
            <span style={{ color: invOpen ? 'var(--brass)' : 'var(--ink-text-2)' }}>Inventory [I]</span>
            <span style={{ color: markersOn ? 'var(--brass)' : 'var(--ink-text-2)' }}>Markers {markersOn ? 'on' : 'off'} [Tab]</span>
            {hasLamp && (
              <span style={{ color: lampOut ? '#b48cff' : 'var(--ink-text-2)' }}>
                Wood&apos;s lamp {lampOut ? (lampOn ? 'lit' : 'out') : 'holstered'} [Q]
              </span>
            )}
            <span style={{ color: torchOn && !lampOut ? 'var(--brass)' : 'var(--ink-text-2)' }}>Torch {lampOut ? 'stowed' : torchOn ? 'on' : 'off'}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
