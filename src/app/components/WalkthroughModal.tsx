'use client';

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import type { ArchiveDoc, Bed, Collection, DoorsState, Examinable, GazeHazard, Inspectable, LightSwitch, LocksState, DressedProp, DressingState, NpcSpot, Passage, Performer, Pickup, Placement, RadioSet, WalkthroughLevel } from '@/lib/walkthrough';
import { fileNote } from '@/lib/case-board';
import { PROP_LIBRARY, type LibraryProp, type PropAssetId } from '@/lib/prop-library';
import { createDeepOneHead } from './deep-one';
import { createHunter, type HunterSense } from './hunter';
import { createPinboard } from './pinboard';
import { createInteractMarkers } from './interact-markers';
import { ArchiveBrowser } from './ArchiveBrowser';
import { TypewriterPane } from './TypewriterPane';
import { NpcConversation } from './NpcConversation';
import { DialoguePane } from './DialoguePane';
import { InventoryPane } from './InventoryPane';
import { InspectViewer } from './InspectViewer';
import { ModelBuilder } from './ModelBuilder';
import { SafeCracker } from './SafeCracker';
import { SetDressing } from './SetDressing';
import { cloneProp, createDressing, propBox, tickProps, type Dressing } from './set-dressing';
import { createModelInLevel } from './model-pieces';
import { createSewer } from './sewer';
import { createShore } from './shore';
import { createDoor, type DoorModel } from './level-door';
import { SkillCheckPane, type Attempt, type Investigator } from './SkillCheckPane';
import type { CheckLevel } from '@/lib/coc-skills';
import { createAvatar, type Gait, type RemoteAvatar } from './avatars';
import { joinLevel, leadsHunter, type Peer } from './presence';
import { createWoodsLamp } from './woods-lamp';
import { BAND, createTuner, stationAt, STEP as DIAL_STEP, type Tuner } from './radio-tuner';
import { createHeldViewmodel, prepareHeldModel, SCOPE_IN } from './held-viewmodel';
import { heldModelFor, type HeldModel } from '@/lib/held-items';
import { createSkyDome } from './sky-dome';
import { createFlock } from './birds';
import { createGunSounds, type GunSounds } from './gun-sounds';
import { isRain, isTimeOfDay, RAIN_LABELS, RAIN_SPECS, RAINS, skyFor, TIME_LABELS, TIMES, withRain, type Rain, type TimeOfDay } from '@/lib/weather';
import { buildCover, createRain, createRainSound, type Cover, type RainSound } from './rain';
import { createBulletHoles } from './bullet-holes';
import { createShells } from './shells';
import { createLightSwitch } from './light-switch';
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
  /** gamelord himself: in a level with lamps, can throw the mains for everyone (L, or the header button). */
  isGamelord?: boolean;
  /** Where to come in, if not at the level's PlayerStart: an arrival from another level (see Passage). */
  arrive?: string;
  /** Takes this investigator through a Passage into another level, arriving at `arrive`. */
  onTravel?: (to: string, arrive: string) => void;
}

const EYE = 1.6;           // camera height above the feet
const RADIUS = 0.28;       // investigator's footprint
const STEP = 0.42;         // tallest ledge that can be stepped onto (stairs rise 0.19)
const WALK = 1.7;          // m/s
const RUN = 3.0;
const REACH = 2.3;         // how far away something can be examined from
const LOOK = 0.0022;       // radians per pixel of mouse movement
const UV_SEEN = 0.12;      // how brightly the lamp must light a stain before it can be examined
const WADE = 0.45;         // pace in knee-deep water, as a share of dry
const CLIMB = 1.1;          // m/s up or down a ladder
const CROUCH_EYE = 1.0;    // camera height while crouched (C)
const CROUCH_PACE = 0.5;   // crouched pace, as a share of walking; no running
const JUMP = 3.2;          // m/s straight up off the ground (Space) — about half a metre
const GRAVITY = 9.8;
const LAMP_POOL = 6;       // ceiling lamps lit at once, nearest first (each costs every pixel)

/**
 * The level's Godot build, when it has one and the page asks for it with
 * `?engine=godot`. Only for that visit — the choice is never remembered, so a
 * test can't leave a browser stuck on the Godot level, which still lacks the
 * three.js one's lamp, torch and clues. Clears the old remembered opt-in.
 */
/** Whether the level has anything for gamelord's door buttons: a door of his (not one a lock keeps), the grate, an ambush. */
function hasGmDoors(level: WalkthroughLevel) {
  return Object.values(level.doors ?? {}).some(d => !d.lock) || !!level.sewer?.grate || !!level.ambush;
}

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
  /** A light switch: E switches its room's lamps on or off. */
  lightSwitch?: LightSwitch;
  /** The sanctums' gates, or the key to them (level.sewer.sanctumGate). */
  seal?: 'gate' | 'key';
  /** The penned hunter's bars (level.hunter.cage.plea): E hears what it has to say. */
  plea?: true;
  /** A way into another level: E goes through it. */
  passage?: Passage;
};
type Browsing = { target: Target; docs: ArchiveDoc[] | null; error: boolean };

/**
 * First-person exploration of a Summer-built level: walk with WASD and mouse
 * look under a torch, bump into walls and furniture, examine marked objects and
 * share findings to the party chat. What the level contains, and how it is lit,
 * comes from `level` (see src/lib/walkthrough.ts).
 */

/** What is in the investigator's hand with a model: a pickup carried, or else an inventory item — none while the Wood's lamp has the hand. */
function gunOf(level: WalkthroughLevel, carried: string | null, held: string | null, lampOut: boolean): HeldModel | null {
  if (lampOut) return null;
  const pickup = carried ? level.pickups?.flatMap(t => t.items).find(p => p.id === carried) : undefined;
  return pickup ? pickup.view : heldModelFor(held);
}
export function WalkthroughModal({ level, onClose, onShare, author, investigator, onCheck, isGM, isGamelord, arrive, onTravel }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [focus, setFocus] = useState<Target | null>(null);
  const [reading, setReading] = useState<Target | null>(null);
  const [browsing, setBrowsing] = useState<Browsing | null>(null);
  const [typing, setTyping] = useState<Target | null>(null);
  // The level's safes that stand open, shared by the party (/api/locks).
  const [openLocks, setOpenLocks] = useState<LocksState>({});
  const openLocksRef = useRef(openLocks);
  useEffect(() => { openLocksRef.current = openLocks; }, [openLocks]);
  // Safes gamelord has opened himself: open for him only, and only until he leaves the level.
  const gmOpenRef = useRef<LocksState>({});
  const isGMRef = useRef(isGM);
  useEffect(() => { isGMRef.current = isGM; }, [isGM]);
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
  // Where each tunable set's needle stands, in kc, once someone has turned it.
  const [radioDial, setRadioDial] = useState<Record<string, number>>({});
  // Light switches turned on (by id); every switched room starts dark.
  const [switchesOn, setSwitchesOn] = useState<Set<string>>(() => new Set());
  // The investigator's sheet equipment (I), the item in hand, and the last use, shown briefly.
  const items = useMemo(() => investigator?.equipment ?? [], [investigator]);
  const heldKey = investigator?.slug ? `hearthboard:held:${investigator.slug}` : null;
  const [invOpen, setInvOpen] = useState(false);
  const [held, setHeld] = useState<string | null>(() => {
    try { return heldKey ? localStorage.getItem(heldKey) : null; } catch { return null; }
  });
  const [usedNote, setUsedNote] = useState<string | null>(null);
  // The line a performer is saying to us just now (Performer.speech), as a subtitle.
  const [subtitle, setSubtitle] = useState<string | null>(null);
  // Sleeping: the scene runs the lying down, the dark and the getting up; the
  // page asks for it (sleepCmdRef) and is told how far it has got (asleep).
  const [asleep, setAsleep] = useState<'no' | 'lying' | 'asleep' | 'waking'>('no');
  const asleepRef = useRef<'no' | 'lying' | 'asleep' | 'waking'>('no');
  useEffect(() => { asleepRef.current = asleep; }, [asleep]);
  const sleepCmdRef = useRef<{ wake: true } | { bed: Target } | null>(null);
  const sleepShadeRef = useRef<HTMLDivElement | null>(null);
  // The dream, once asleep (level.dream): its iframe, and whether it has the pointer.
  const dreamRef = useRef<HTMLIFrameElement | null>(null);
  const [dreamLocked, setDreamLocked] = useState(false);
  const [dreamFailed, setDreamFailed] = useState(false);
  const dreaming = asleep === 'asleep' && !!level.dream && !dreamFailed;
  // The board hands a fresh onShare on every render (it polls chat every few
  // seconds); read it through a ref so callbacks the 3D scene depends on stay
  // the same and the level is not rebuilt.
  const onShareRef = useRef(onShare);
  useEffect(() => { onShareRef.current = onShare; }, [onShare]);
  const onTravelRef = useRef(onTravel);
  useEffect(() => { onTravelRef.current = onTravel; }, [onTravel]);
  // Time of day, where the level has weather: set by the GM, fetched by everyone (see src/lib/weather.ts).
  const [weatherTime, setWeatherTime] = useState<TimeOfDay>('night');
  const weatherRef = useRef<TimeOfDay>('night');
  useEffect(() => { weatherRef.current = weatherTime; }, [weatherTime]);
  const [rain, setRain] = useState<Rain>('none');
  const rainRef = useRef<Rain>('none');
  useEffect(() => { rainRef.current = rain; }, [rain]);
  const [weatherError, setWeatherError] = useState(false);
  // The level's mains: gamelord throws them for everyone (see /api/lights). Room switches sit underneath.
  const [power, setPower] = useState(true);
  const powerRef = useRef(true);
  useEffect(() => { powerRef.current = power; }, [power]);
  const [powerError, setPowerError] = useState(false);
  // When gamelord last threw the mains here: a poll sent before then answers with the old state.
  const powerSetAt = useRef(0);
  // Doors gamelord opens and shuts for everyone (see /api/doors), by id: true while one stands open.
  const [doorsOpen, setDoorsOpen] = useState<Record<string, boolean>>({});
  const doorsOpenRef = useRef<Record<string, boolean>>({});
  useEffect(() => { doorsOpenRef.current = doorsOpen; }, [doorsOpen]);
  const doorSetAt = useRef(0);
  // The same doors in full: when each was last set (the ambush, kept with them, plays from then).
  const doorsStateRef = useRef<DoorsState>({});
  // Read the doors again now (the room says they changed), and tell the room we changed them.
  const pollDoorsRef = useRef<(() => void) | null>(null);
  const sendDoorsRef = useRef<(() => void) | null>(null);
  // gamelord's private run of the level's ambush (see Ambush): when he pressed Preview, 0 when none.
  // Nothing is saved or sent: only his own screen plays it, held and turned like an investigator.
  const ambushPreviewRef = useRef(0);
  const [doorError, setDoorError] = useState(false);
  // Set dressing (/api/dressing): props gamelord has set down here from the library's
  // tray. Everyone sees them; only gamelord has the mode that places them.
  const [dressing, setDressing] = useState(false);
  const dressingRef = useRef(false);
  useEffect(() => { dressingRef.current = dressing; }, [dressing]);
  const [dressItems, setDressItems] = useState<DressedProp[]>([]);
  const dressItemsRef = useRef<DressedProp[]>([]);
  const [dressError, setDressError] = useState(false);
  const dressUndo = useRef<{ items: DressedProp[]; at: number }[]>([]);
  const [canUndoDress, setCanUndoDress] = useState(false);
  const dressSaveTimer = useRef(0);
  // The scene's side of it, and its hooks into the view and the room (set by the scene effect).
  const dressRef = useRef<Dressing | null>(null);
  const lookRef = useRef<((dx: number, dy: number) => void) | null>(null);
  const sendDressingRef = useRef<(() => void) | null>(null);
  const refetchDressingRef = useRef<(() => void) | null>(null);
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
  // Talking to someone: their topics, or (Speak freely) open conversation — only with whom it was chosen.
  const [freeTalkWith, setFreeTalkWith] = useState<Target | null>(null);
  // A raised voice in conversation (1–3), and until when it carries: the hunter may hear it.
  const voiceRef = useRef<{ level: number; until: number } | null>(null);
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
  // …and turns a tunable one's dial by so many channels.
  const tuneRadioRef = useRef<((id: string, steps: number) => void) | null>(null);
  const toggleSwitchRef = useRef<((id: string) => void) | null>(null);
  // The penned hunter begs, when E is pressed at its bars (level.hunter.cage.plea).
  const pleaRef = useRef<(() => void) | null>(null);
  // gamelord walks the levels unseen: he never shares where he is.
  const unseenRef = useRef(!!isGamelord);
  useEffect(() => { unseenRef.current = !!isGamelord; }, [isGamelord]);
  // The room switches as the party last left them (see /api/lights), kept so a
  // level still loading can set its switches once they exist…
  const sharedSwitchesRef = useRef<Record<string, boolean>>({});
  // …and the scene's own hook for setting one that someone else flipped.
  const applySwitchRef = useRef<((id: string, on: boolean) => void) | null>(null);
  // When this player last flipped each switch: a poll sent before then answers with the old state.
  const switchSetAt = useRef<Record<string, number>>({});
  // Set by the scene: reloads the gun in hand, if it can be.
  const reloadRef = useRef<(() => void) | null>(null);
  const inspectRef = useRef<(() => void) | null>(null);
  // The magazine count over the view, written each frame without a re-render.
  const ammoRef = useRef<HTMLSpanElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  // Set by the scene when the level has a pinboard; refetches its notes now.
  const refreshPinsRef = useRef<(() => void) | null>(null);
  // Refetches the shared state of the level's models (builders) and redraws them on their tables.
  const refreshModelsRef = useRef<(() => void) | null>(null);

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
  // A gun in hand that fires (the AK-74u, the Tommy, the revolver): clicks fire it rather than examine.
  const gunView = gunOf(level, carried, heldItem, lampOut);
  const fires = !!(gunView?.arms || gunView?.revolver);

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
  const canUseSkillOn = useCallback((t: Target) => canCheck && !t.collection && !t.pinHead && !t.npc && !t.inspect && !t.pickup && !t.bed && t.seal !== 'key' && !level.typewriters?.[t.id]
    && !(t.id === level.sewer?.shrineLock && level.sewer.shrineSealed && !isGamelord), [canCheck, level, isGamelord]);

  // Safes: which stand open, fetched when the level opens and again whenever one is tried.
  const fetchLocks = useCallback(() => {
    if (!level.locks && !level.sewer?.sanctumGate) return Promise.resolve(openLocksRef.current);
    return fetch(`/api/locks?level=${level.id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((shared: LocksState) => { const s = { ...shared, ...gmOpenRef.current }; openLocksRef.current = s; setOpenLocks(s); return s; })
      .catch(err => { console.warn('Could not load the locks:', err); return openLocksRef.current; });
  }, [level]);
  useEffect(() => { void fetchLocks(); }, [fetchLocks]);

  /** An open safe's inside, read like any other card (its own id, so saving it is its own find). */
  const insideOf = useCallback((t: Target): Target | null => {
    const lock = level.locks?.[t.id];
    return lock ? { id: `${t.id}-inside`, entry: lock.opened, box: t.box } : null;
  }, [level]);

  const setLock = useCallback((id: string, relock = false): Promise<void> => {
    // Open at once here; the server's answer settles it.
    if (!relock) {
      const next = { ...openLocksRef.current, [id]: { by: author, at: Date.now() } };
      openLocksRef.current = next;
      setOpenLocks(next);
      // gamelord's opening is never shared or kept: the safe is shut again next time he comes in.
      if (isGamelord) { gmOpenRef.current = { ...gmOpenRef.current, [id]: next[id] }; return Promise.resolve(); }
    } else if (gmOpenRef.current[id]) {
      const rest = { ...gmOpenRef.current };
      delete rest[id];
      gmOpenRef.current = rest;
    }
    return fetch('/api/locks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: level.id, id, relock }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((shared: LocksState) => { const s = { ...shared, ...gmOpenRef.current }; openLocksRef.current = s; setOpenLocks(s); })
      .catch(err => console.error('Could not set the lock:', err));
  }, [level, author, isGamelord]);

  // A collection (filing cabinet, gun rack…) opens its contents, fetched afresh
  // each time; a typewriter opens a sheet to type on; anything else opens the
  // reading card.
  const openTarget = useCallback((t: Target) => {
    if (t.lightSwitch) { toggleSwitchRef.current?.(t.lightSwitch.id); return; }
    if (t.plea) { pleaRef.current?.(); return; }
    if (t.passage) { onTravelRef.current?.(t.passage.to, t.passage.arrive); return; }
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
    // The sanctums' key and gates, on the party's latest word: E takes the key
    // if it is still there; at a gate, E turns it if anyone has it, and reads
    // the sealed gate if no one does. gamelord shuts open gates again.
    const seal = level.sewer?.sanctumGate;
    if (t.seal && seal) {
      void fetchLocks().then(s => {
        if (t.seal === 'key') {
          if (s[seal.key]) { openReading({ ...t, id: `${t.id}-gone`, entry: { title: t.entry.title, text: 'Only its print is left in the silt at the bottom of the pool. Someone has taken it already.' } }); return; }
          setLock(seal.key);
          onShareRef.current(`found the ${t.entry.title.toLowerCase()} in the lair's pool`);
          openReading(t);
          return;
        }
        if (s[seal.gate]) {
          // One after the other: the store is read, changed and written whole each time.
          if (isGM) void setLock(seal.gate, true).then(() => setLock(seal.key, true));
          return;
        }
        if (s[seal.key]) {
          setLock(seal.gate);
          const keyTitle = level.examinables[seal.key]?.title.toLowerCase() ?? 'key';
          onShareRef.current(`turned the ${keyTitle} in the ${t.entry.title.toLowerCase()} — both gates swing open`);
          return;
        }
        openReading(t);
      });
      return;
    }
    // A safe: cracked open, E looks inside; still locked, E turns the dial —
    // unless someone else has opened it since, which the fresh state shows.
    // The shrine door, while it is sealed: nothing to work, only the sealed door to look at (gamelord excepted).
    if (t.id === level.sewer?.shrineLock && level.sewer.shrineSealed && !isGamelord) {
      openReading({ ...t, id: `${t.id}-sealed`, entry: level.sewer.shrineSealed });
      return;
    }
    if (level.locks?.[t.id]) {
      const inside = insideOf(t)!;
      // Something to take out of it: E takes it while it is there (on the party's latest word),
      // turned over in the hands; once gone, E reads the empty safe, and the GM puts it back.
      const item = level.locks[t.id].item;
      if (openLocksRef.current[t.id] && item) {
        void fetchLocks().then(s => {
          if (s[item.id]) {
            if (isGM) { void setLock(item.id, true); onShareRef.current(`put the ${item.title.toLowerCase()} back in the ${t.entry.title.toLowerCase()}`); }
            else openReading({ ...t, id: `${t.id}-gone`, entry: item.gone });
            return;
          }
          void setLock(item.id);
          onShareRef.current(`took the ${item.title.toLowerCase()} from the ${t.entry.title.toLowerCase()}`);
          setInspecting({ id: item.id, entry: { title: item.title, text: item.text }, box: t.box, inspect: { model: item.model, clues: {} } });
          setInspectUv(false);
          document.exitPointerLock?.();
        });
        return;
      }
      if (openLocksRef.current[t.id]) { openReading(inside); return; }
      setTyping(t);
      document.exitPointerLock?.();
      void fetchLocks().then(s => {
        if (s[t.id] && typingRef.current === t) { setTyping(null); openReading(inside); }
      });
      return;
    }
    // A typewriter, a person or a model to build takes the keyboard: each opens over the level in `typing`.
    if (level.typewriters?.[t.id] || t.npc || level.builders?.[t.id]) {
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
  }, [openReading, level, heldKey, insideOf, fetchLocks, setLock, isGM, isGamelord]);

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
    refreshModelsRef.current?.();
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

  // ── Lights ────────────────────────────────────────────────────────
  // Polled every 10 s while the tab is showing — every 5 s in a level with
  // room switches, which anyone in the party may be flipping.
  useEffect(() => {
    if (!level.lamps) return;
    let cancelled = false;
    const poll = () => {
      if (document.hidden) return;
      const sent = performance.now();
      fetch(`/api/lights?level=${encodeURIComponent(level.id)}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((l: { on?: unknown; switches?: Record<string, { on: boolean }> } | null) => {
          if (cancelled) return;
          if (sent > powerSetAt.current) setPower(l?.on !== false);
          for (const sw of level.lightSwitches ?? []) {
            if (sent < (switchSetAt.current[sw.id] ?? 0)) continue;
            const on = !!l?.switches?.[sw.id]?.on;
            sharedSwitchesRef.current[sw.id] = on;
            applySwitchRef.current?.(sw.id, on);
          }
        })
        .catch(() => {});
    };
    poll();
    const timer = window.setInterval(poll, level.lightSwitches?.length ? 5_000 : 10_000);
    document.addEventListener('visibilitychange', poll);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [level]);

  // gamelord throws the mains: it applies here at once, and reverts if it could not be saved.
  const togglePower = useCallback(async () => {
    const next = !powerRef.current;
    powerSetAt.current = performance.now();
    powerRef.current = next;
    setPower(next);
    setPowerError(false);
    try {
      const r = await fetch('/api/lights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.id, on: next }),
      });
      if (!r.ok) throw new Error(String(r.status));
    } catch (err) {
      console.error('Could not set the lights:', err);
      powerRef.current = !next;
      setPower(!next);
      setPowerError(true);
    }
  }, [level]);

  // ── Doors ─────────────────────────────────────────────────────────
  // Polled every 5 s: a door is the way on, so the party should not wait long for it.
  useEffect(() => {
    if (!hasGmDoors(level)) return;
    let cancelled = false;
    const poll = () => {
      if (document.hidden) return;
      const sent = performance.now();
      fetch(`/api/doors?level=${encodeURIComponent(level.id)}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((s: DoorsState | null) => {
          if (cancelled || !s || sent < doorSetAt.current) return;
          doorsStateRef.current = s;
          const open = Object.fromEntries(Object.entries(s).map(([id, d]) => [id, d.open]));
          doorsOpenRef.current = open;
          setDoorsOpen(open);
        })
        .catch(() => {});
    };
    poll();
    pollDoorsRef.current = poll;
    const timer = window.setInterval(poll, 5_000);
    document.addEventListener('visibilitychange', poll);
    return () => { cancelled = true; pollDoorsRef.current = null; window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [level]);

  // gamelord opens or shuts a door: it moves here at once, and goes back if it could not be saved.
  const toggleDoor = useCallback(async (id: string) => {
    const next = !doorsOpenRef.current[id];
    const apply = (open: boolean) => {
      doorsOpenRef.current = { ...doorsOpenRef.current, [id]: open };
      doorsStateRef.current = { ...doorsStateRef.current, [id]: { open, setAt: Date.now(), setBy: 'gamelord' } };
      setDoorsOpen(doorsOpenRef.current);
    };
    doorSetAt.current = performance.now();
    apply(next);
    setDoorError(false);
    try {
      const r = await fetch('/api/doors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.id, id, open: next }),
      });
      if (!r.ok) throw new Error(String(r.status));
      sendDoorsRef.current?.();
    } catch (err) {
      console.error('Could not set the door:', err);
      apply(!next);
      setDoorError(true);
    }
  }, [level]);

  // ── Set dressing ──────────────────────────────────────────────────
  // Read when the level opens, and again whenever gamelord says (over the
  // room) that it changed — never polled.
  useEffect(() => {
    let cancelled = false;
    const fetchDressing = () => {
      fetch(`/api/dressing?level=${encodeURIComponent(level.id)}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((s: DressingState | null) => {
          // gamelord's own copy is the newer one while a change of his waits to be saved.
          if (cancelled || !s || dressSaveTimer.current) return;
          dressItemsRef.current = s.items;
          setDressItems(s.items);
        })
        .catch(() => {});
    };
    fetchDressing();
    refetchDressingRef.current = fetchDressing;
    return () => { cancelled = true; refetchDressingRef.current = null; };
  }, [level]);
  useEffect(() => { dressRef.current?.show(dressItems); }, [dressItems]);

  const saveDressing = useCallback(async () => {
    window.clearTimeout(dressSaveTimer.current);
    dressSaveTimer.current = 0;
    try {
      const r = await fetch('/api/dressing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.id, items: dressItemsRef.current }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setDressError(false);
      sendDressingRef.current?.();
    } catch (err) {
      console.error('Could not save the set dressing:', err);
      setDressError(true);
    }
  }, [level]);

  // A change shows at once and is saved a moment later, so a turn held down is one write.
  const changeDressing = useCallback((next: DressedProp[]) => {
    const now = performance.now();
    const undo = dressUndo.current;
    // A run of quick changes (turning step by step) undoes as one.
    if (!undo.length || now - undo[undo.length - 1].at > 800) undo.push({ items: dressItemsRef.current, at: now });
    else undo[undo.length - 1].at = now;
    if (undo.length > 50) undo.shift();
    setCanUndoDress(true);
    dressItemsRef.current = next;
    setDressItems(next);
    window.clearTimeout(dressSaveTimer.current);
    dressSaveTimer.current = window.setTimeout(() => void saveDressing(), 400);
  }, [saveDressing]);

  const undoDressing = useCallback(() => {
    const last = dressUndo.current.pop();
    setCanUndoDress(dressUndo.current.length > 0);
    if (!last) return;
    dressItemsRef.current = last.items;
    setDressItems(last.items);
    window.clearTimeout(dressSaveTimer.current);
    dressSaveTimer.current = window.setTimeout(() => void saveDressing(), 400);
  }, [saveDressing]);

  // Into set dressing: the mouse is let go, for the tray. Out of it: anything unsaved goes now.
  const toggleDressing = useCallback(() => {
    if (!isGamelord) return;
    if (dressingRef.current) {
      setDressing(false);
      if (dressSaveTimer.current) void saveDressing();
      return;
    }
    if (document.pointerLockElement) document.exitPointerLock();
    setDressing(true);
  }, [isGamelord, saveDressing]);
  useEffect(() => () => window.clearTimeout(dressSaveTimer.current), []);

  // The wheel turns the dial of whatever wireless the crosshair is on, a channel a notch.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (dressingRef.current || typingRef.current || readingRef.current || browsingRef.current || invOpenRef.current) return;
      const target = focusRef.current;
      if (!target || !level.radios?.[target.id]?.dial || !e.deltaY) return;
      tuneRadioRef.current?.(target.id, e.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [level]);

  // Escape closes the reading card first, then the level. Pressing Escape to
  // leave pointer lock must not also close the modal, so a key arriving just
  // after the lock was released is ignored.
  useEffect(() => {
    const onKey = (e: Pick<KeyboardEvent, 'code' | 'key' | 'repeat' | 'preventDefault'>) => {
      // Set dressing has its own keys (SetDressing.tsx); only walking reaches the level.
      if (dressingRef.current) return;
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
      // , and . turn a wireless's dial down and up the band (held, they sweep).
      if ((e.code === 'Comma' || e.code === 'Period') && !readingRef.current && !browsingRef.current) {
        const target = focusRef.current;
        if (target && level.radios?.[target.id]?.dial) tuneRadioRef.current?.(target.id, e.code === 'Comma' ? -1 : 1);
      }
      // With a gun that reloads in hand, R reloads it (skills are still on the open card).
      if (e.code === 'KeyR' && !e.repeat && !readingRef.current && !browsingRef.current) {
        const gun = gunOf(level, carriedRef.current, heldItemRef.current, lampOutRef.current);
        if (gun?.reload || gun?.arms || gun?.revolver) { reloadRef.current?.(); return; }
      }
      // V turns a gun with arms over in the hands, to look it over.
      if (e.code === 'KeyV' && !e.repeat && !readingRef.current && !browsingRef.current) inspectRef.current?.();
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
      // P opens set dressing — gamelord only, with nothing open over the level.
      if (e.code === 'KeyP' && !e.repeat && isGamelord && !godot && !readingRef.current && !browsingRef.current && !invOpenRef.current) {
        toggleDressing();
        return;
      }
      // L throws the level's mains — gamelord only.
      if (e.code === 'KeyL' && !e.repeat && isGamelord && level.lamps) void togglePower();
      // Tab shows or hides the markers over interactive objects (and must not move browser focus).
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!e.repeat) setMarkersOn(v => !v);
      }
    };
    keyRef.current = onKey;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, openTarget, openReading, closeReading, closeBrowsing, canUseSkillOn, level, hasLamp, items, holdItem, applyItem, openInventory, closeInventory, closeInspect, onShare, isGamelord, togglePower, godot, toggleDressing]);

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

  // ── The dream ────────────────────────────────────────────────────
  // Asleep in a bed with a dream, the investigator is somewhere else: the
  // dream's iframe takes the pointer and keys, forwards E (wake) and Escape,
  // and says when it is over.
  useEffect(() => {
    if (!dreaming) return;
    document.exitPointerLock?.();
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== dreamRef.current?.contentWindow) return;
      let msg: GodotMessage;
      try {
        msg = (JSON.parse(String(e.data)) as { hearthboard?: GodotMessage }).hearthboard as GodotMessage;
      } catch {
        return;
      }
      if (!msg) return;
      switch (msg.type) {
        case 'ready':
          dreamRef.current?.focus();
          break;
        case 'error':
          console.error('The dream failed:', msg.message);
          setDreamFailed(true);
          break;
        case 'lock':
          if (!msg.locked) unlockedAtRef.current = performance.now();
          setDreamLocked(!!msg.locked);
          break;
        case 'key': {
          const code = String(msg.code);
          keyRef.current?.({ code, key: code === 'Escape' ? 'Escape' : '', repeat: false, preventDefault: () => {} });
          break;
        }
        case 'wake':
          // The dream ended itself, and badly.
          if (asleepRef.current === 'asleep') {
            sleepCmdRef.current = { wake: true };
            onShareRef.current('woke with a start, gasping for air');
          }
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [dreaming]);

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
    // Window glass built dark for night (`level.windowGlass`): by day it glows
    // with the sky, and lets the sun through.
    let panes: { mat: THREE.MeshStandardMaterial; night: THREE.Color; meshes: THREE.Mesh[] } | null = null;

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
    inspectRef.current = () => {
      const ear = ensureListener();
      gunSounds ??= createGunSounds(ear.context, ear.getInput());
      inHand.inspect(gunSounds);
    };
    // Where the shots land.
    const bulletHoles = createBulletHoles(scene);
    const shells = createShells(scene);
    let muzzleFlash = 0;
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
    // Jumping and crouching: rising speed while off the ground, the camera's
    // height over the feet (EYE standing, CROUCH_EYE down), and a jump asked for.
    let vy = 0;
    let airborne = false;
    let eye = EYE;
    let jumpAsked = false;
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
    const radios = new Map<string, { set: RadioSet; glow: THREE.PointLight; center: THREE.Vector3; tuner: Tuner | null; kc: number }>();
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
    // gamelord's doors, cut out of the architecture: how far each stands open
    // (0 shut … 1 open), and whether its leaf is among the walls just now. A
    // door with a `lockId` is padlocked instead: it opens once that lock is cracked.
    const doors: { id: string; lockId?: string; hidesPeeper: boolean; model: DoorModel; k: number; blocking: boolean }[] = [];
    let sewer: ReturnType<typeof createSewer> | null = null;
    // Where an investigator coming in from another level stands, by arrival id (see Passage).
    const arrivals = new Map<string, { at: THREE.Vector3; yaw: number }>();
    // Every lamp in the level, but only the nearest LAMP_POOL are lit by real
    // lights: each light costs every pixel, and 18 of them made the Archive
    // crawl. `w` fades a lamp in and out of the pool so none ever pops.
    const lamps: { name: string; on: boolean; pos: THREE.Vector3; color: THREE.Color; base: number; distance: number; dipUntil: number; w: number; d: number; slot: THREE.PointLight | null }[] = [];
    // Each switch: whether it is on, its model, and the bulb glow it governs.
    const switches = new Map<string, { sw: LightSwitch; on: boolean; set: (on: boolean) => void; glows: { group: { materialIndex?: number } }[] }>();
    const lampPool: THREE.PointLight[] = [];
    // Glowing bulb materials, put out while the mains are off.
    const bulbGlows: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
    let shownPower = true;
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
    const up = new THREE.Vector3(0, 1, 0);

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

    /** `tall` is how high the body reaches over `y`: less when crouched, so tables can be crept under. */
    const hitsFurniture = (x: number, z: number, y: number, tall = EYE + 0.1) => {
      for (const b of blockers) {
        if (b.max.y < y + 0.3 || b.min.y > y + tall) continue;
        if (x > b.min.x - RADIUS && x < b.max.x + RADIUS && z > b.min.z - RADIUS && z < b.max.z + RADIUS) return true;
      }
      return false;
    };

    /** Tries to move the feet by (dx, dz); returns whether it moved. */
    const tryMove = (dx: number, dz: number) => {
      const len = Math.hypot(dx, dz);
      if (len === 0) return false;
      const dir = tmpV.set(dx / len, 0, dz / len).clone();
      // Two rays: one clears stair risers (which sit below it), one catches walls and beams
      // (lower while crouched, so a crouch gets under a low beam).
      for (const h of [0.45, Math.min(1.3, eye - 0.2)]) {
        const origin = new THREE.Vector3(feet.x, feet.y + h, feet.z);
        if (wallDist(origin, dir, RADIUS + len + 0.01) < RADIUS + len) return false;
      }
      const nx = feet.x + dx;
      const nz = feet.z + dz;
      const g = groundAt(nx, nz, feet.y);
      if (g === -Infinity || g > feet.y + STEP) return false;
      // In the air, furniture is judged from the floor: landing on a table's box would trap you in it.
      if (hitsFurniture(nx, nz, airborne ? g : Math.max(g, feet.y), eye + 0.1)) return false;
      feet.x = nx;
      feet.z = nz;
      return true;
    };

    // Props from the library: each model loaded once, however many copies of it stand
    // in the level (placements and set dressing alike); each use clones it.
    const propModels = new Map<PropAssetId, Promise<THREE.Object3D>>();
    const loadProp = (asset: PropAssetId) => {
      let p = propModels.get(asset);
      if (!p) {
        p = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(PROP_LIBRARY[asset].model).then((gltf) => {
          gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          // A character's clips travel with its model; each copy plays its own (cloneProp).
          gltf.scene.userData.clips = gltf.animations;
          return gltf.scene;
        });
        propModels.set(asset, p);
      }
      return p;
    };
    const propRoots: THREE.Object3D[] = [];
    let dressing: Dressing | null = null;

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
        // "Collider*" stand-ins for a model too heavy to raycast (a photogrammetry
        // scan): walked on and run into, never drawn. Raycasts ignore visibility.
        arch?.traverse((o) => { if (o.name.startsWith('Collider')) o.visible = false; });
        // Doors gamelord works: cut out of the walls, standing as the party last left them.
        for (const [id, door] of Object.entries(level.doors ?? {})) {
          const dm = createDoor(model, scene, door);
          if (!dm) continue;
          const k = (door.lock ? openLocksRef.current[door.lock] : doorsOpenRef.current[id]) ? 1 : 0;
          dm.set(k);
          if (!k) walls.push(...dm.blocking);
          doors.push({ id, lockId: door.lock, hidesPeeper: !!door.hidesPeeper, model: dm, k, blocking: !k });
          owned.push(dm);
        }
        // The sewer behind the house's back door, solid underfoot like the rest.
        if (level.sewer) {
          sewer = createSewer(new THREE.Vector3(...level.sewer.at));
          scene.add(sewer.group);
          walls.push(...sewer.solids);
          owned.push(sewer);
          // The end of the outfall tunnel: out to the shore, and back in from it.
          const out = level.sewer.outfall;
          const outEntry = out && level.examinables[out.examine];
          if (out && outEntry) targets.push({ id: out.examine, entry: outEntry, box: sewer.outfall.box, passage: out });
          arrivals.set('outfall', sewer.outfall.arrive);
          // The outfall grate, which gamelord raises and lowers like a door.
          if (level.sewer.grate) {
            const k = doorsOpenRef.current[level.sewer.grate] ? 1 : 0;
            sewer.grate.set(k);
            if (!k) walls.push(...sewer.grate.blocking);
            doors.push({ id: level.sewer.grate, hidesPeeper: false, model: sewer.grate, k, blocking: !k });
          }
          // The shrine's door, padlocked: shut (and in the way) until the lock is cracked.
          const lockId = level.sewer.shrineLock;
          const lockEntry = lockId ? level.examinables[lockId] : undefined;
          if (lockId && lockEntry && level.locks?.[lockId]) {
            const dm = sewer.door;
            const k = openLocksRef.current[lockId] && !(level.sewer.shrineSealed && !unseenRef.current) ? 1 : 0;
            dm.set(k);
            if (!k) walls.push(...dm.blocking);
            doors.push({ id: lockId, lockId, hidesPeeper: false, model: dm, k, blocking: !k });
            targets.push({ id: lockId, entry: lockEntry, box: dm.lock });
          }
          // The sanctums' gates, sealed until the key from the lair turns in them.
          const seal = level.sewer.sanctumGate;
          const gateEntry = seal && level.examinables[seal.gate];
          const keyEntry = seal && level.examinables[seal.key];
          if (seal && gateEntry && keyEntry) {
            const gm = sewer.gates;
            const k = openLocksRef.current[seal.gate] ? 1 : 0;
            gm.set(k);
            if (!k) walls.push(...gm.blocking);
            doors.push({ id: seal.gate, lockId: seal.gate, hidesPeeper: false, model: gm, k, blocking: !k });
            for (const box of gm.locks) targets.push({ id: seal.gate, entry: gateEntry, box, seal: 'gate' });
            targets.push({ id: seal.key, entry: keyEntry, box: sewer.key.box, seal: 'key' });
          }
        }
        // The penned hunter's bars, from just in front of them to the back of its pen.
        const cage = level.hunter?.cage;
        const pleaEntry = cage?.plea && level.examinables[cage.plea.id];
        if (cage?.plea && pleaEntry) {
          const box = new THREE.Box3(
            new THREE.Vector3(cage.min[0] - 0.6, cage.at[1], cage.min[1]),
            new THREE.Vector3(cage.max[0], cage.at[1] + 2.2, cage.max[1]),
          );
          targets.push({ id: cage.plea.id, entry: pleaEntry, box, plea: true });
        }
        // The beach by the wreck, with the sewer's outfall culvert in its sea wall.
        if (level.shore) {
          const shore = createShore();
          scene.add(shore.group);
          walls.push(...shore.solids);
          owned.push(shore);
          const back = level.shore.culvert;
          const backEntry = level.examinables[back.examine];
          if (backEntry) targets.push({ id: back.examine, entry: backEntry, box: shore.culvert.box, passage: back });
          arrivals.set('culvert', shore.culvert.arrive);
        }
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

        // Models to build: the pieces in place (and those still loose) drawn
        // on the real table, from the party's shared progress — fetched now,
        // after the builder closes, and every 20 s while the level is open.
        if (level.builders) {
          const built = Object.values(level.builders).map(build => {
            const m = createModelInLevel(build);
            scene.add(m.group);
            owned.push(m);
            return { build, m };
          });
          const refresh = () => {
            for (const { build, m } of built) {
              fetch(`/api/models/${build.id}`)
                .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
                .then(s => { if (!disposed) m.update(s); })
                .catch(err => console.warn('Could not load the model:', build.id, err));
            }
          };
          refresh();
          refreshModelsRef.current = refresh;
          const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 20000);
          owned.push({ dispose: () => { window.clearInterval(timer); refreshModelsRef.current = null; } });
        }

        const start = model.getObjectByName('PlayerStart');
        if (start) {
          start.getWorldPosition(feet);
          const q = start.getWorldQuaternion(new THREE.Quaternion());
          yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
        }
        // Come in from another level: where that way in lets out.
        const arrival = arrive ? arrivals.get(arrive) : undefined;
        if (arrival) {
          feet.copy(arrival.at);
          yaw = arrival.yaw;
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
            // A lamp a switch works starts dark.
            const on = !level.lightSwitches?.some(sw => sw.lamps.includes(o.name));
            lamps.push({ name: o.name, on, pos: o.getWorldPosition(new THREE.Vector3()), color: new THREE.Color(color), base: intensity, distance, dipUntil: 0, w: 0, d: 0, slot: null });
          });
          for (let i = 0; i < Math.min(LAMP_POOL, lamps.length); i++) {
            const light = new THREE.PointLight(0xffffff, 0, 1, 2);
            scene.add(light);
            lampPool.push(light);
          }
        }

        // Light switches: a plate on the wall outside each room, and the glow
        // of that room's bulbs split off the level's glowing meshes so it can
        // go dark with them.
        if (level.lightSwitches?.length) {
          const lampAt = new Map(lamps.map(l => [l.name, l.pos]));
          for (const sw of level.lightSwitches) {
            const [fx, fz] = sw.from;
            const floor = groundAt(fx, fz, 0);
            const dir = new THREE.Vector3(sw.toward[0], 0, sw.toward[1]).normalize();
            ray.set(new THREE.Vector3(fx, (floor === -Infinity ? 0 : floor) + (sw.height ?? 1.35), fz), dir);
            ray.far = 6;
            const hit = ray.intersectObjects(walls, false)[0];
            if (!hit?.face) { console.warn('Light switch found no wall:', sw.id); continue; }
            const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
            const plate = createLightSwitch();
            plate.group.position.copy(hit.point);
            plate.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            scene.add(plate.group);
            owned.push(plate);
            plate.group.updateMatrixWorld(true);
            switches.set(sw.id, { sw, on: false, set: plate.set, glows: [] });
            targets.push({
              id: `switch-${sw.id}`, entry: { title: `${sw.room} light switch`, text: '' },
              box: new THREE.Box3().setFromObject(plate.group).expandByScalar(0.08), lightSwitch: sw,
            });
          }
          // Bulbs: triangles of a glowing material within reach of a switched
          // lamp go to that switch, and show unlit glass while it is off.
          const REACH_BULB = 0.9;
          const owner = (p: THREE.Vector3) => {
            for (const { sw } of switches.values()) {
              if (sw.lamps.some(n => { const at = lampAt.get(n); return !!at && at.distanceTo(p) < REACH_BULB; })) return sw.id;
            }
            return '';
          };
          const glowing: THREE.Mesh[] = [];
          model.traverse(o => {
            const mesh = o as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mesh.isMesh && !Array.isArray(mat) && mat.isMeshStandardMaterial && mat.emissive.getHex() !== 0 && mesh.geometry.index) glowing.push(mesh);
          });
          const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
          for (const mesh of glowing) {
            const geo = mesh.geometry;
            const index = geo.index!;
            const pos = geo.attributes.position;
            const byOwner = new Map<string, number[]>();
            for (let i = 0; i < index.count; i += 3) {
              a.fromBufferAttribute(pos, index.getX(i));
              b.fromBufferAttribute(pos, index.getX(i + 1));
              c.fromBufferAttribute(pos, index.getX(i + 2));
              const centre = a.add(b).add(c).divideScalar(3).applyMatrix4(mesh.matrixWorld);
              const id = owner(centre);
              let list = byOwner.get(id);
              if (!list) byOwner.set(id, (list = []));
              list.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
            }
            if (byOwner.size === 1 && byOwner.has('')) continue;
            // Re-order the triangles by owner, one draw group each.
            const lit = mesh.material as THREE.MeshStandardMaterial;
            const dark = lit.clone();
            dark.emissive.setHex(0x000000);
            dark.color.setHex(0x3a342c);
            dark.roughness = 0.25;
            owned.push(dark);
            const order: number[] = [];
            for (const [id, list] of byOwner) {
              geo.addGroup(order.length, list.length, id ? 1 : 0);
              const group = geo.groups[geo.groups.length - 1];
              if (id) switches.get(id)!.glows.push({ group });
              order.push(...list);
            }
            geo.setIndex(order);
            mesh.material = [lit, dark];
          }
          // Each room as the party left it.
          for (const [id, on] of Object.entries(sharedSwitchesRef.current)) setSwitch(id, on);
        }

        // The bulbs' glow, so the mains can put it out: any glowing material
        // with a vertex within reach of a lamp.
        if (lamps.length) {
          const v = new THREE.Vector3();
          const seen = new Set<THREE.Material>();
          model.traverse(o => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
            const glowing = mats.filter(m => m.isMeshStandardMaterial && m.emissive.getHex() !== 0 && !seen.has(m));
            if (!glowing.length) return;
            const pos = mesh.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
              if (lamps.some(l => l.pos.distanceTo(v) < 0.9)) {
                for (const m of glowing) { seen.add(m); bulbGlows.push({ mat: m, base: m.emissiveIntensity }); }
                return;
              }
            }
          });
          // The mains may have been thrown before the model arrived.
          for (const g of bulbGlows) g.mat.emissiveIntensity = shownPower ? g.base : 0;
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
          const center = tg.box.getCenter(new THREE.Vector3());
          // The dial's warm glow while the set is on.
          const glow = new THREE.PointLight(0xffb060, 0, 1.4, 2);
          glow.position.set(center.x, tg.box.max.y, center.z);
          scene.add(glow);
          radios.set(tg.id, { set, glow, center, tuner: null, kc: set.dial?.at ?? 0 });
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
            // The sewer's floors are its own, outside the level's model.
            (x, z, nearY) => {
              ray.set(tmpV.set(x, nearY + 0.3, z), down);
              ray.far = 1;
              const hit = ray.intersectObjects(sewer ? [loadedModel, ...sewer.solids] : [loadedModel], true)[0];
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

        // Props from the Blender library (src/lib/prop-library.ts), stood on the
        // floor. Each asset is fetched once however often it is placed. A
        // placement with an examinable id is a piece of its own — examined like
        // the level's furniture, and things can be set on it; the rest of the
        // copies are drawn instanced.
        const upY = new THREE.Vector3(0, 1, 0);
        const placementMatrix = (pl: Placement) => {
          const [x, z] = pl.at;
          const q = new THREE.Quaternion().setFromAxisAngle(upY, THREE.MathUtils.degToRad(pl.turnDeg ?? 0));
          let y = pl.y;
          if (y === undefined) {
            const base = pl.floorY ?? 0;
            ray.set(tmpV.set(x, base + STEP + 0.05, z), down);
            ray.far = 6;
            const floor = ray.intersectObjects(walls, false)[0];
            y = floor ? floor.point.y : base;
            // On a listing deck it leans with the floor, all four feet down.
            const slope = floor?.face?.normal.clone().transformDirection(floor.object.matrixWorld);
            if (slope && slope.y > 0.9) q.premultiply(new THREE.Quaternion().setFromUnitVectors(upY, slope));
          }
          return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3().setScalar(pl.scale ?? 1));
        };
        /** Every mesh of the prop as one InstancedMesh, a copy at each matrix. */
        const instanced = (template: THREE.Object3D, at: THREE.Matrix4[]) => {
          const group = new THREE.Group();
          const m = new THREE.Matrix4();
          template.updateMatrixWorld(true);
          template.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            const copies = new THREE.InstancedMesh(mesh.geometry, mesh.material, at.length);
            at.forEach((place, i) => copies.setMatrixAt(i, m.multiplyMatrices(place, mesh.matrixWorld)));
            copies.castShadow = true;
            copies.receiveShadow = true;
            copies.computeBoundingSphere();
            group.add(copies);
          });
          return group;
        };
        const placeAsset = async (asset: PropAssetId, list: Placement[]) => {
          const lib: LibraryProp = PROP_LIBRARY[asset];
          const template = await loadProp(asset);
          if (disposed) return;
          const shape = new THREE.Box3().setFromObject(template);
          const plain: THREE.Matrix4[] = [];
          for (const pl of list) {
            const at = placementMatrix(pl);
            const solid = pl.solid ?? lib.solid;
            // Plain copies of a still prop are instanced; a character's each need a skeleton of their own.
            if (!pl.id && !lib.clips) {
              plain.push(at);
              if (solid) blockers.push(shape.clone().applyMatrix4(at));
              continue;
            }
            const obj = cloneProp(asset, template);
            at.decompose(obj.position, obj.quaternion, obj.scale);
            scene.add(obj);
            propRoots.push(obj);
            obj.updateMatrixWorld(true);
            const box = propBox(obj);
            if (solid) blockers.push(box);
            if (!pl.id) continue;
            const entry = level.examinables[pl.id];
            if (entry) targets.push({ id: pl.id, entry, box, collection: level.collections?.[pl.id] });
            else console.warn('Placement has no examinable:', pl.id);
            pieceById.set(pl.id, obj);
          }
          if (plain.length) {
            const copies = instanced(template, plain);
            scene.add(copies);
            propRoots.push(copies);
          }
        };
        // Set dressing: gamelord's props, dropped on the level, its furniture and its props.
        dressing = createDressing({
          scene, camera, load: loadProp, blockers,
          surfaces: () => (model ? [model, ...propRoots] : propRoots),
        });
        dressRef.current = dressing;
        dressing.show(dressItemsRef.current);
        const byAsset = new Map<PropAssetId, Placement[]>();
        for (const pl of level.placements ?? []) byAsset.set(pl.asset, [...(byAsset.get(pl.asset) ?? []), pl]);
        const propLoads = Promise.all([...byAsset].map(([asset, list]) =>
          placeAsset(asset, list).catch(err => console.error('Prop failed to load:', asset, err)),
        ));

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
          // A skinned model's vertices follow its bones, which only catch up with a move when told.
          const settle = () => {
            obj.updateMatrixWorld(true);
            obj.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update(); });
          };
          settle();
          const box = new THREE.Box3().setFromObject(obj, true);
          const centre = box.getCenter(new THREE.Vector3());
          obj.position.set(x - centre.x, (hit ? hit.point.y : base.y) - box.min.y + 0.002, z - centre.z);
          scene.add(obj);
          settle();
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
          propLoads,
          // After the props, which some of them stand on.
          ...Object.entries(level.inspectables ?? {}).filter(([, insp]) => !insp.in).map(([id, insp]) =>
            propLoads.then(() => placeInspectable(id, insp)).catch(err => console.error('Inspectable failed to load:', id, err)),
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

    // A switch thrown, here or by someone else in the level: its button, its
    // room's lamps and its bulbs' glow.
    const setSwitch = (id: string, on: boolean) => {
      const s = switches.get(id);
      if (!s || s.on === on) return false;
      s.on = on;
      s.set(on);
      for (const l of lamps) if (s.sw.lamps.includes(l.name)) l.on = on;
      for (const { group } of s.glows) group.materialIndex = on ? 0 : 1;
      setSwitchesOn(prev => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });
      return true;
    };
    applySwitchRef.current = setSwitch;
    // Flipped here: it changes at once for this player, then for everyone once it is saved.
    // Audio is wired up on the first flip: browsers only let an AudioContext
    // start from a user gesture, and that key press is one.
    toggleSwitchRef.current = (id) => {
      const s = switches.get(id);
      if (!s) return;
      const on = !s.on;
      setSwitch(id, on);
      sharedSwitchesRef.current[id] = on;
      switchSetAt.current[id] = performance.now();
      const ear = ensureListener();
      gunSounds ??= createGunSounds(ear.context, ear.getInput());
      gunSounds.fire('click');
      fetch('/api/lights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.id, switch: id, on }),
      })
        .then(r => { if (!r.ok) throw new Error(String(r.status)); })
        .catch(err => console.error('Could not save the light switch:', err));
    };
    const showRadio = (id: string, on: boolean) => setRadiosOn(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
    toggleRadioRef.current = (id) => {
      const r = radios.get(id);
      if (!r) return;
      // Built on the first switch-on: sound needs a gesture. A record with no dial switches the set off when it ends.
      r.tuner ??= createTuner(r.set, ensureListener(), r.center, scene, () => {
        r.tuner?.setOn(false);
        r.glow.intensity = 0;
        showRadio(id, false);
      });
      r.tuner.tune(r.kc);
      const on = !r.tuner.on;
      r.tuner.setOn(on);
      r.glow.intensity = on ? 0.6 : 0;
      showRadio(id, on);
    };
    tuneRadioRef.current = (id, steps) => {
      const r = radios.get(id);
      if (!r?.set.dial) return;
      r.kc = THREE.MathUtils.clamp(r.kc + steps * DIAL_STEP, BAND[0], BAND[1]);
      r.tuner?.tune(r.kc);
      setRadioDial(prev => ({ ...prev, [id]: r.kc }));
    };

    // ── Input ───────────────────────────────────────────────────────
    const needsEar = !!(level.birds?.cries || level.weather || level.hunter?.sound || level.hunter?.chaseMusic || level.performers?.some(f => f.sound || f.speech));
    const onKeyDown = (e: KeyboardEvent) => {
      // A level with birds calling (or a hunter growling) needs sound from the start; a key press lets it begin.
      if (needsEar) ensureListener();
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        keys.add(e.code);
        if (e.code.startsWith('Arrow')) e.preventDefault();
      }
      // Space jumps and C crouches (held) — never while typing to someone.
      const field = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (!field && !typingRef.current && (e.code === 'Space' || e.code === 'KeyC')) {
        if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) jumpAsked = true; }
        else keys.add(e.code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
    const onBlur = () => { keys.clear(); jumpAsked = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      // Finer down the sights, in step with the zoom.
      const look = LOOK * camera.fov / 70;
      yaw -= e.movementX * look;
      pitch = Math.max(-1.35, Math.min(1.35, pitch - e.movementY * look));
    };
    // Set dressing frees the mouse for the tray, so the view turns with a drag instead.
    lookRef.current = (dx, dy) => {
      yaw -= dx * LOOK * 1.6;
      pitch = Math.max(-1.35, Math.min(1.35, pitch - dy * LOOK * 1.6));
    };
    // A gun with arms in hand: left button fires, right aims, and a click examines nothing.
    const armed = () => { const gun = gunOf(level, carriedRef.current, heldItemRef.current, lampOutRef.current); return !!(gun?.arms || gun?.revolver); };
    const onCanvasClick = () => {
      if (needsEar) ensureListener();
      if (readingRef.current || browsingRef.current || typingRef.current || invOpenRef.current || inspectingRef.current) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
      else if (focusRef.current && !armed()) openTarget(focusRef.current);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas || !armed()) return;
      if (readingRef.current || browsingRef.current || typingRef.current || invOpenRef.current || inspectingRef.current) return;
      const ear = ensureListener();
      gunSounds ??= createGunSounds(ear.context, ear.getInput());
      if (e.button === 0) inHand.setTrigger(true, gunSounds);
      if (e.button === 2) inHand.setAim(true);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) inHand.setTrigger(false);
      if (e.button === 2) inHand.setAim(false);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onLockChange = () => {
      const isLocked = document.pointerLockElement === canvas;
      if (!isLocked) { unlockedAtRef.current = performance.now(); keys.clear(); inHand.setTrigger(false); inHand.setAim(false); }
      setLocked(isLocked);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    // Hidden, the frame loop stops: give up leading the hunter at once, not on the next frame.
    const onVisibility = () => { if (document.visibilityState !== 'visible') presence.setHunterReady(false); };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    canvas.addEventListener('click', onCanvasClick);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);

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

    // Figures playing one clip where they are put (see Performer).
    const performers: {
      root: THREE.Object3D; mixer: THREE.AnimationMixer; spec: Performer;
      audio: { el: HTMLAudioElement; sound: THREE.PositionalAudio } | null;
      /** Its speech, once there is an ear for it; `armed` until it is said, and again once we walk off. */
      voice: { el: HTMLAudioElement; sound: THREE.PositionalAudio; armed: boolean } | null;
    }[] = [];
    let saying: string | null = null;   // the subtitle on screen, so it is set only when it changes
    const say = (text: string | null) => { if (text !== saying) { saying = text; setSubtitle(text); } };
    const performerAt = new THREE.Vector3();
    /** A performer's music, once there is an ear for it: streamed, looped, and placed where it is played. */
    const startPerformerSound = (f: (typeof performers)[number], ear: THREE.AudioListener) => {
      const spec = f.spec.sound!;
      const el = new Audio(spec.src);
      el.loop = true;
      el.crossOrigin = 'anonymous';
      // Broadcast time: wherever the tune has got to for everyone else.
      el.addEventListener('loadedmetadata', () => { if (el.duration > 0) el.currentTime = (Date.now() / 1000) % el.duration; }, { once: true });
      const sound = new THREE.PositionalAudio(ear);
      sound.setMediaElementSource(el);
      sound.setRefDistance(spec.refDistance);
      sound.setRolloffFactor(1.4);
      sound.setVolume(spec.volume);
      sound.position.set(...(spec.at ?? [0, 1, 0.6]));
      f.root.add(sound);
      el.play().catch(err => console.error('Performer sound failed to play:', spec.src, err));
      f.audio = { el, sound };
    };
    /** A performer's speech: loaded, placed at its mouth, and played when we come near. */
    const prepareVoice = (f: (typeof performers)[number], ear: THREE.AudioListener) => {
      const spec = f.spec.speech!;
      const el = new Audio(spec.src);
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      const sound = new THREE.PositionalAudio(ear);
      sound.setMediaElementSource(el);
      sound.setRefDistance(1.5);
      sound.setRolloffFactor(1.2);
      sound.setVolume(spec.volume ?? 1);
      sound.position.set(...(spec.at ?? [0, 1.2, 0.1]));
      f.root.add(sound);
      f.voice = { el, sound, armed: true };
    };
    // Each model loads once; figures sharing one (a congregation) are clones of it.
    const performerModels = new Map<string, Promise<GLTF>>();
    for (const f of level.performers ?? []) {
      if (!performerModels.has(f.model)) performerModels.set(f.model, new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(f.model));
      performerModels.get(f.model)!.then(gltf => {
        if (disposed) return;
        const root = cloneSkinned(gltf.scene);
        root.position.set(f.at[0], f.y ?? 0, f.at[1]);
        root.rotation.y = THREE.MathUtils.degToRad(f.turnDeg ?? 0);
        root.scale.setScalar(f.scale ?? 1);
        root.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.frustumCulled = false;   // skinned bounds are the rest pose's
          // MakeHuman hair, lashes and cloth edges are cut-outs: test alpha rather than blend (as avatars.ts does).
          for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
            if (mat.transparent) { mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true; }
          }
        });
        const mixer = new THREE.AnimationMixer(root);
        const clip = (f.clip && gltf.animations.find(a => a.name === f.clip)) || gltf.animations[0];
        if (clip) mixer.clipAction(clip).play().time = (f.phase ?? 0) % clip.duration;
        scene.add(root);
        performers.push({ root, mixer, spec: f, audio: null, voice: null });
      }).catch(err => console.error('Performer failed to load:', f.model, err));
    }

    // ── The ambush (see Ambush) ─────────────────────────────────────
    // Kept as a door (doorsOpenRef/doorsStateRef): while it is open the figure
    // stands at its spot, turned on whoever is nearest, and its speech plays
    // from the moment it was set off — for everyone, late comers part way in.
    const ambush = level.ambush;
    let ambushFig: { obj: THREE.Object3D; box: THREE.Box3; yaw: number } | null = null;
    let ambushLoading = false;
    let ambushVoice: { el: HTMLAudioElement; sound: THREE.PositionalAudio } | null = null;
    let ambushHeard = 0;      // the setting-off (its setAt) whose speech has been played, or skipped, here
    let ambushAsked = false;  // this investigator has asked the server to set it off
    let ambushOurs = 0;       // the setting-off we caused: heard from the top, whatever our clock says
    let cameUp = false;       // been below its trigger since the last time up
    let faceHim = 0;          // seconds left of turning our view onto him, as he starts to speak
    let previewing = false;   // gamelord is watching his own Preview: held and turned like an investigator
    const ambushTarget = new THREE.Vector3();
    /** In the house proper, not down in the sewer: where the ambush holds you and you hear him. */
    const inAmbush = (y: number) => !!ambush && y > ambush.trigger.aboveY - 0.2;
    const ambushSpeaking = () => !!ambushVoice && !ambushVoice.el.paused && !ambushVoice.el.ended;
    const dropAmbushVoice = () => {
      if (!ambushVoice) return;
      ambushVoice.el.pause();
      ambushVoice.sound.removeFromParent();
      ambushVoice = null;
    };
    owned.push({ dispose: dropAmbushVoice });
    const setOffAmbush = () => {
      if (!ambush || ambushAsked) return;
      ambushAsked = true;
      fetch('/api/doors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.id, id: ambush.id, ambush: true }),
      })
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((s: DoorsState) => {
          if (disposed) return;
          ambushOurs = s[ambush.id]?.setAt ?? 0;
          doorsStateRef.current = s;
          const open = Object.fromEntries(Object.entries(s).map(([id, d]) => [id, d.open]));
          doorsOpenRef.current = open;
          setDoorsOpen(open);
          sendDoorsRef.current?.();
        })
        // 409: the box is still in its safe. The next time up asks again.
        .catch(() => { ambushAsked = false; });
    };
    const updateAmbush = (dt: number) => {
      if (!ambush) return;
      // Set off by coming up out of the sewer into the house (gamelord never sets it off by walking).
      // Not while he's already there, nor once it has really happened (see DoorsState.fired).
      if (!unseenRef.current && !doorsStateRef.current[ambush.id]?.fired && !doorsOpenRef.current[ambush.id]) {
        if (feet.y < ambush.trigger.belowY) cameUp = true;
        else if (cameUp && feet.y > ambush.trigger.aboveY && feet.z > ambush.trigger.insideZ) {
          cameUp = false;
          setOffAmbush();
        }
      }
      // A preview runs the whole piece and a few seconds after, then he goes (unless he is really here).
      const shared = !!doorsOpenRef.current[ambush.id];
      if (ambushPreviewRef.current && Date.now() - ambushPreviewRef.current > (ambush.speech.duration + 4) * 1000) ambushPreviewRef.current = 0;
      const preview = shared ? 0 : ambushPreviewRef.current;
      previewing = !!preview;
      const here = shared || previewing;
      if (here && !ambushFig && !ambushLoading) {
        ambushLoading = true;
        loadProp(ambush.figure.asset).then(template => {
          ambushLoading = false;
          if (disposed || ambushFig || !(doorsOpenRef.current[ambush.id] || ambushPreviewRef.current)) return;
          const obj = cloneProp(ambush.figure.asset, template, ambush.figure.clip);
          const [x, z] = ambush.figure.at;
          const y = ambush.figure.y ?? 0;
          const yaw0 = THREE.MathUtils.degToRad(ambush.figure.turnDeg);
          obj.position.set(x, y, z);
          obj.rotation.y = yaw0;
          scene.add(obj);
          obj.updateMatrixWorld(true);
          // Solid where he stands — not out to the end of the levelled barrel.
          const box = new THREE.Box3(new THREE.Vector3(x - 0.3, y, z - 0.3), new THREE.Vector3(x + 0.3, y + 1.8, z + 0.3));
          blockers.push(box);
          // Whoever stands where he steps in is moved back, in front of him.
          if (Math.hypot(feet.x - x, feet.z - z) < 0.8 && Math.abs(feet.y - y) < 1) {
            feet.x = x + Math.sin(yaw0) * 1.3;
            feet.z = z + Math.cos(yaw0) * 1.3;
          }
          ambushFig = { obj, box, yaw: yaw0 };
        }).catch(err => { ambushLoading = false; console.error('The ambush figure failed to load:', err); });
      }
      if (!here && ambushFig) {
        ambushFig.obj.removeFromParent();
        const i = blockers.indexOf(ambushFig.box);
        if (i >= 0) blockers.splice(i, 1);
        ambushFig = null;
        dropAmbushVoice();
      }
      if (!ambushFig) return;

      // His piece, from when he was set off: heard once per setting-off, part way in if we came late.
      const setAt = shared ? doorsStateRef.current[ambush.id]?.setAt ?? 0 : preview;
      if (listener && setAt && ambushHeard !== setAt) {
        ambushHeard = setAt;
        const into = setAt === ambushOurs ? 0 : Math.max(0, (Date.now() - setAt) / 1000);
        if (into < ambush.speech.duration - 0.5) {
          dropAmbushVoice();
          const el = new Audio(ambush.speech.src);
          el.crossOrigin = 'anonymous';
          const sound = new THREE.PositionalAudio(listener);
          sound.setMediaElementSource(el);
          sound.setRefDistance(3);
          sound.setRolloffFactor(1);
          sound.setVolume(ambush.speech.volume ?? 1);
          sound.position.set(0, 1.6, 0.15);   // under the hood
          ambushFig.obj.add(sound);
          el.currentTime = into;
          el.play().catch(err => console.error('The ambush speech failed to play:', err));
          ambushVoice = { el, sound };
          if (into < 2 && inAmbush(feet.y) && (!unseenRef.current || previewing)) faceHim = 1.1;
        }
      }

      // Gun on whoever is nearest in the house.
      const { obj } = ambushFig;
      let best = 14;
      let tx = 0, tz = 0;
      const consider = (x: number, y: number, z: number) => {
        if (!inAmbush(y)) return;
        const d = Math.hypot(x - obj.position.x, z - obj.position.z);
        if (d < best) { best = d; tx = x; tz = z; }
      };
      if (!unseenRef.current) consider(feet.x, feet.y, feet.z);
      for (const { peer } of avatars.values()) if (peer.pose) consider(...peer.pose.p);
      if (best < 14) {
        const want = Math.atan2(tx - obj.position.x, tz - obj.position.z);
        const turn = THREE.MathUtils.euclideanModulo(want - ambushFig.yaw + Math.PI, Math.PI * 2) - Math.PI;
        ambushFig.yaw += THREE.MathUtils.clamp(turn, -2.5 * dt, 2.5 * dt);
        obj.rotation.y = ambushFig.yaw;
      }

      // As he starts to speak, our view comes round onto him.
      if (faceHim > 0) {
        faceHim -= dt;
        obj.getWorldPosition(ambushTarget);
        const lookYaw = Math.atan2(-(ambushTarget.x - feet.x), -(ambushTarget.z - feet.z));
        const turn = THREE.MathUtils.euclideanModulo(lookYaw - yaw + Math.PI, Math.PI * 2) - Math.PI;
        yaw += turn * Math.min(1, dt * 4);
        pitch += (0 - pitch) * Math.min(1, dt * 4);
      }
    };
    /** Held at gunpoint: no walking while he speaks to the house. */
    const heldByAmbush = () => ambushSpeaking() && (!unseenRef.current || previewing) && inAmbush(feet.y);

    // Something hunting the investigator (see Hunter). It walks by the same collision.
    const litChest = new THREE.Vector3();
    const toLamp = new THREE.Vector3();
    const hunter = level.hunter ? createHunter(level.hunter, scene, el, {
      groundAt, wallDist, hitsFurniture, radius: RADIUS, step: STEP, listener: () => listener,
      // In lamplight: near a lit bulb on this storey, with nothing between.
      litAt: (p) => lamps.some(l => {
        if (!l.on || !powerRef.current || l.pos.y < p.y || l.pos.y - p.y > 3.4) return false;
        litChest.set(p.x, p.y + 1.2, p.z);
        const dist = l.pos.distanceTo(litChest);
        if (dist > l.distance * 0.55) return false;
        toLamp.subVectors(litChest, l.pos).normalize();
        return wallDist(l.pos.clone(), toLamp, dist) >= dist - 0.1;
      }),
    }) : null;
    const hunterLook = new THREE.Vector3();
    let hunterLeads = true;
    /** The hunter's bars: down and in the way. */
    const cageShut = () => !!level.hunter?.cage && !!doors.find(d => d.id === level.hunter!.cage!.door)?.blocking;
    // What it says from behind them (cage.plea): loaded on the first E, heard from where it stands.
    let plea: { el: HTMLAudioElement; sound: THREE.PositionalAudio } | null = null;
    pleaRef.current = () => {
      const spec = level.hunter?.cage?.plea;
      const ear = ensureListener();
      if (!spec || !ear) return;
      if (!plea) {
        const el = new Audio(spec.src);
        el.crossOrigin = 'anonymous';
        el.preload = 'auto';
        const sound = new THREE.PositionalAudio(ear);
        sound.setMediaElementSource(el);
        sound.setRefDistance(2.5);
        sound.setRolloffFactor(1);
        sound.setVolume(spec.volume ?? 1);
        sound.position.set(level.hunter!.cage!.at[0], level.hunter!.cage!.at[1] + 1.6, level.hunter!.cage!.at[2]);
        scene.add(sound);
        plea = { el, sound };
      }
      // Once it has begun, it says it through; E again after it has finished hears it again.
      if (!plea.el.paused) return;
      plea.el.currentTime = 0;
      plea.el.play().catch(err => console.error('Hunter plea failed to play:', spec.src, err));
    };
    /** Up and about in the level: not loading, reading, asleep or in a pane. */
    const hunterAwake = () => !!model && !sleep && !readingRef.current && !browsingRef.current && !typingRef.current && !invOpenRef.current && !inspectingRef.current;
    // Everyone in the room, gamelord too: whoever leads the hunter shares it in their presence.
    let peersNow: Peer[] = [];
    const onPeers = (all: Peer[]) => {
      if (disposed) return;
      peersNow = all;
      // gamelord is never shown, even if an old tab of his still shares where he is.
      const peers = all.filter(p => p.userId !== 'gamelord');
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
    // A shot that struck the hunter: whoever leads it takes the wound.
    const presence = joinLevel(level.id, onPeers, () => hunter?.hit(), by => { if (hunterLeads) hunter?.wound(by, null); }, () => refetchDressingRef.current?.(), () => pollDoorsRef.current?.());
    sendDoorsRef.current = () => presence.sendDoors();
    owned.push({ dispose: () => { sendDoorsRef.current = null; } });
    sendDressingRef.current = () => presence.sendDressing();
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
        if (model && !panes && level.windowGlass) {
          const meshes: THREE.Mesh[] = [];
          let mat: THREE.MeshStandardMaterial | null = null;
          model.traverse(o => {
            const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if (m && m.name === level.windowGlass && m.isMeshStandardMaterial) { mat = m; meshes.push(o as THREE.Mesh); }
          });
          if (mat) {
            // Daylight in the glass is not lost in the room's haze.
            (mat as THREE.MeshStandardMaterial).fog = false;
            (mat as THREE.MeshStandardMaterial).needsUpdate = true;
            panes = { mat, night: (mat as THREE.MeshStandardMaterial).emissive.clone(), meshes };
          }
        }
        if (panes) {
          const daylight = 1 - sky.stars;
          panes.mat.emissive.copy(panes.night).lerp(goal.copy(sky.horizon), daylight);
          for (const m of panes.meshes) m.castShadow = daylight < 0.5;
        }
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
        // At gunpoint: stand still while he speaks.
        if (heldByAmbush()) { f = 0; s = 0; jumpAsked = false; }
        // On a ladder: W climbs, S climbs down, and no falling. Only at its
        // head or foot can you step off (or on).
        const ladderAt = () => sewer?.ladders.find(l =>
          feet.x > l.min[0] && feet.x < l.max[0] && feet.z > l.min[1] && feet.z < l.max[1]
          && feet.y > l.bottom - 0.1 && feet.y < l.top + 0.1);
        const ladder = ladderAt();
        if (ladder) {
          feet.y = THREE.MathUtils.clamp(feet.y + f * CLIMB * dt, ladder.bottom, ladder.top);
          if (feet.y > ladder.bottom + 0.05 && feet.y < ladder.top - 0.05) f = s = 0;
        }
        if (f || s) {
          // Wading: water over the feet halves the pace, running or walking.
          const wading = sewer?.pools.some(w =>
            feet.x > w.min[0] && feet.x < w.max[0] && feet.z > w.min[1] && feet.z < w.max[1] && feet.y < w.surface - 0.05);
          const crouched = eye < EYE - 0.05;
          const speed = (crouched ? WALK * CROUCH_PACE : keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK) * (wading ? WADE : 1) * dt;
          const n = Math.hypot(f, s);
          const sin = Math.sin(yaw), cos = Math.cos(yaw);
          const dx = (-sin * f + cos * s) / n * speed;
          const dz = (-cos * f - sin * s) / n * speed;
          // Slide along walls: if the full step is blocked, try each axis alone.
          if (!tryMove(dx, dz)) { tryMove(dx, 0); tryMove(0, dz); }
        }
        // Settle onto whatever is underfoot (stairs up, or a drop).
        // (Stepping onto its head this frame counts: the shaft is no drop.)
        const onLadder = !!(ladder || ladderAt());
        const g = onLadder ? -Infinity : groundAt(feet.x, feet.z, feet.y);
        // Jump: only from solid ground, never off a ladder, and not with a ceiling just overhead.
        if (jumpAsked && !airborne && !onLadder && g !== -Infinity && feet.y - g < 0.05) {
          vy = JUMP;
          airborne = true;
        }
        jumpAsked = false;
        if (airborne) {
          vy -= GRAVITY * dt;
          // A head hitting the ceiling stops the rise.
          if (vy > 0 && wallDist(tmpV.set(feet.x, feet.y + eye, feet.z), up, 0.25 + vy * dt) < Infinity) vy = 0;
          feet.y += vy * dt;
          if (onLadder) { airborne = false; vy = 0; }
          else if (g !== -Infinity && feet.y <= g) { feet.y = g; airborne = false; vy = 0; }
        } else if (g !== -Infinity) feet.y = g > feet.y ? g : Math.max(g, feet.y - 4 * dt);
        // Crouch while C is held; stand again only where there's headroom.
        const wantDown = keys.has('KeyC');
        const roomToStand = () =>
          wallDist(tmpV.set(feet.x, feet.y + eye, feet.z), up, EYE - eye + 0.12) === Infinity
          && !hitsFurniture(feet.x, feet.z, feet.y, EYE + 0.1);
        const goal = wantDown || (eye < EYE - 0.01 && !roomToStand()) ? CROUCH_EYE : EYE;
        eye += (goal - eye) * (1 - Math.exp(-dt * 12));
      }

      camera.position.set(feet.x, feet.y + eye + Math.sin(t * 1.3) * 0.004, feet.z);
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
        camera.position.set(feet.x, feet.y + eye, feet.z).lerp(sleep.lie, e);
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
        // gamelord walks unseen: nobody draws him, but the hunter is told where he is.
        const pose = {
          p: [feet.x, feet.y, feet.z] as [number, number, number], yaw, pitch, gait: shownGait, lamp: uvOwn.power > 0.3 ? pitch : undefined,
          crouch: eye < (EYE + CROUCH_EYE) / 2 || undefined,
          torch: (torchRef.current && !woods?.visible) || undefined,
          busy: !hunterAwake() || undefined,
        } as const;
        if (unseenRef.current) presence.setPrey(pose); else presence.setPose(pose);
      }
      for (const { avatar, peer } of avatars.values()) {
        if (!avatar) continue;
        avatar.group.visible = !!peer.pose;
        if (peer.pose) avatar.setTarget(tmpFeet.fromArray(peer.pose.p), peer.pose.yaw, peer.pose.gait, !!peer.pose.crouch);
        avatar.update(dt);
      }
      tickProps(scene, dt);
      updateAmbush(dt);
      for (const f of performers) {
        f.mixer.update(dt);
        if (f.spec.sound && !f.audio && listener) startPerformerSound(f, listener);
        const speech = f.spec.speech;
        if (speech && !f.voice && listener) prepareVoice(f, listener);
        if (speech && f.voice) {
          const v = f.voice;
          f.root.getWorldPosition(performerAt);
          const d = Math.hypot(feet.x - performerAt.x, feet.z - performerAt.z);
          const sameFloor = Math.abs(feet.y - performerAt.y) < 1.5;
          if (v.armed && sameFloor && d < speech.near) {
            v.armed = false;
            v.el.currentTime = 0;
            v.el.play().catch(err => console.error('Performer speech failed to play:', speech.src, err));
          } else if (!v.armed && v.el.paused && (!sameFloor || d > speech.near + 2)) {
            v.armed = true;
          }
        }
      }
      // Subtitles for whichever performer is speaking.
      {
        let line: string | null = null;
        for (const f of performers) {
          const v = f.voice;
          if (!v || v.el.paused || v.el.ended) continue;
          for (const l of f.spec.speech!.lines) if (l.t <= v.el.currentTime) line = l.text;
        }
        const pleaLines = level.hunter?.cage?.plea?.lines;
        if (plea && pleaLines && !plea.el.paused && !plea.el.ended) {
          for (const l of pleaLines) if (l.t <= plea.el.currentTime) line = l.text;
        }
        // The ambush's speech, for whoever is up in the house with him.
        if (ambush && ambushVoice && ambushSpeaking() && (inAmbush(feet.y) || unseenRef.current)) {
          for (const l of ambush.speech.lines) if (l.t <= ambushVoice.el.currentTime) line = l.text;
        }
        say(line);
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
      if (hunter) {
        camera.getWorldDirection(hunterLook);
        const selfId = presence.selfId();
        // The others, as their presence tells it.
        const others: HunterSense[] = [];
        for (const peer of peersNow) {
          const pose = peer.pose ?? peer.prey;
          if (!pose) continue;
          const pp = pose.pitch ?? 0;
          const at = new THREE.Vector3().fromArray(pose.p);
          others.push({
            id: peer.id, active: !pose.busy, feet: at,
            eye: at.clone().setY(at.y + (pose.crouch ? CROUCH_EYE : EYE)),
            look: new THREE.Vector3(-Math.sin(pose.yaw) * Math.cos(pp), Math.sin(pp), -Math.cos(pose.yaw) * Math.cos(pp)),
            torchOn: !!pose.torch,
            noise: pose.crouch || pose.gait === 'idle' ? 0 : pose.gait === 'run' ? 2 : 1,
          });
        }
        // Its leader: the lowest connection id with it loaded. Anyone else shows it where that one says.
        const leader = peersNow.filter(p => p.hunter).sort((a, b) => a.id - b.id)[0];
        // A tab in the background stops drawing, and would stop the hunter for everyone: it hands it on.
        const canLead = hunter.ready && document.visibilityState === 'visible';
        const lead = leadsHunter(selfId, canLead, peersNow);
        hunterLeads = lead;
        const crouched = eye < (EYE + CROUCH_EYE) / 2;
        hunter.update(dt, {
          local: {
            id: selfId ?? -1, active: hunterAwake(),
            feet, eye: camera.position, look: hunterLook,
            torchOn: torchRef.current && !woods?.visible,
            noise: crouched || shownGait === 'idle' ? 0 : shownGait === 'run' ? 2 : 1,
          },
          others, lead, follow: leader?.hunter ?? null,
          // A raised voice carries from where they stand, even while they talk.
          voice: voiceRef.current && voiceRef.current.until > performance.now() ? { feet, level: voiceRef.current.level } : null,
          onBlow: (id) => presence.sendHit(id),
          // Its bars: down and in the way.
          cageShut: cageShut(),
        });
        hunter.hushed = !!plea && !plea.el.paused;
        presence.setHunter(lead && selfId !== null ? hunter.snapshot() : null);
        presence.setHunterReady(canLead);
        camera.position.add(hunter.jolt);
      }

      // People turn to watch whoever comes near, and settle back when they leave.
      // Their names show only close to, so a name never gives them away through a wall.
      for (const { avatar, home, homeYaw } of npcs) {
        if (!avatar) continue;
        const dx = camera.position.x - home.x;
        const dz = camera.position.z - home.z;
        const near = Math.hypot(dx, dz) < 5 && Math.abs(camera.position.y - eye - home.y) < 1;
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
      // Shots: the flash lights the room ahead, the round lands, the sound.
      const fired = inHand.takeShots();
      for (let i = 0; i < fired.shots; i++) {
        gunSounds?.fire(fired.report);
        muzzleFlash = 1;
        // Radians across: loose from the hip, tight down the sights, all but none down a scope.
        const spread = 0.07 * (1 - inHand.aim * 0.88) * (1 - (inHand.scoped?.k ?? 0) * 0.95);
        camera.getWorldDirection(lookDir);
        lookDir.x += (Math.random() - 0.5) * spread;
        lookDir.y += (Math.random() - 0.5) * spread;
        lookDir.z += (Math.random() - 0.5) * spread;
        lookDir.normalize();
        ray.set(camera.position, lookDir);
        ray.far = 60;
        const wall = ray.intersectObjects(walls, false)[0];
        let near = wall ? wall.distance : Infinity;
        let piece: THREE.Vector3 | null = null;
        for (const b of blockers) {
          const at = ray.ray.intersectBox(b, tmpV);
          if (!at) continue;
          const d = at.distanceTo(camera.position);
          if (d < near && d > 0.3) { near = d; piece = at.clone(); }
        }
        // The hunter, if it stands nearer than whatever else the round would hit.
        const struck = hunter?.struck(ray.ray, near);
        if (struck) {
          if (hunterLeads) hunter!.wound(presence.selfId() ?? -1, struck);
          else { hunter!.showShot(struck); presence.sendShot(); }
        } else if (piece) bulletHoles.hit(piece, null);
        else if (wall?.face) bulletHoles.hit(wall.point, wall.face.normal.clone().transformDirection(wall.object.matrixWorld));
      }
      if (fired.dry) gunSounds?.fire('dry');
      // Spent cases: from the hands' view into the level, then onto the floor.
      for (const c of fired.cases) shells.throw(c.at.applyMatrix4(camera.matrixWorld), c.dir.applyMatrix4(new THREE.Matrix4().extractRotation(camera.matrixWorld)), c.shell, c.drop);
      shells.update(dt, () => feet.y, loud => gunSounds?.fire('tink', 0.25 + loud * 0.5));
      if (muzzleFlash > 0) {
        torch.intensity = Math.max(torch.intensity, muzzleFlash * 90);
        muzzleFlash = Math.max(0, muzzleFlash - dt / 0.06);
      }
      bulletHoles.update(dt);
      // Down the sights the view narrows; down a scope, to the scope's, once its reticle is up.
      const scoped = inHand.scoped;
      const scopeK = scoped ? THREE.MathUtils.smoothstep(scoped.k, SCOPE_IN, 1) : 0;
      const fov = scoped && scoped.k > SCOPE_IN ? THREE.MathUtils.lerp(52, scoped.fov, scopeK) : 70 - 18 * inHand.aim;
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      if (scopeRef.current) {
        const op = scoped && scoped.k > SCOPE_IN ? Math.min(1, scopeK * 1.5).toFixed(3) : '0';
        if (scopeRef.current.style.opacity !== op) scopeRef.current.style.opacity = op;
      }
      const ammo = inHand.ammo;
      const ammoText = ammo ? `${ammo.rounds} / ${ammo.max}${inHand.reloading ? ' · reloading' : ''}` : '';
      if (ammoRef.current && ammoRef.current.textContent !== ammoText) ammoRef.current.textContent = ammoText;
      // Doors swing over a second and a half. A shut door blocks once it is home;
      // an opening one stops blocking at once.
      for (const d of doors) {
        // A sealed shrine door stays shut for all but gamelord.
        const sealed = d.lockId === level.sewer?.shrineLock && !!level.sewer?.shrineSealed && !unseenRef.current;
        const want = !sealed && (d.lockId ? openLocksRef.current[d.lockId] : doorsOpenRef.current[d.id]) ? 1 : 0;
        if (d.k !== want) {
          d.k = want > d.k ? Math.min(1, d.k + dt / 1.5) : Math.max(0, d.k - dt / 1.5);
          d.model.set(d.k);
        }
        const block = want === 0 && d.k === 0;
        if (block !== d.blocking) {
          d.blocking = block;
          if (block) walls.push(...d.model.blocking);
          else for (const b of d.model.blocking) walls.splice(walls.indexOf(b), 1);
        }
      }
      if (sewer && level.sewer?.sanctumGate) sewer.key.show(!openLocksRef.current[level.sewer.sanctumGate.key]);
      sewer?.update(dt, camera.position, { camera, lit: torch.intensity > 0 || (woods?.power ?? 0) > 0.05 });
      // The Deep One: slide in behind the hole from one side, stare, withdraw —
      // unless the door it watches through stands open, and there is nothing there.
      if (peeper && doors.some(d => d.hidesPeeper && d.k > 0)) {
        peeper.head.group.visible = false;
        Object.assign(peek, { phase: 'away', t: 0, next: 2 + Math.random() * 2 });
      } else if (peeper && level.peeper) {
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

      for (const r of radios.values()) if (r.tuner?.on) r.glow.intensity = 0.55 + Math.random() * 0.1;
      // Old wiring: now and then a bulb browns out for a moment.
      if (powerRef.current !== shownPower) {
        shownPower = powerRef.current;
        for (const g of bulbGlows) g.mat.emissiveIntensity = shownPower ? g.base : 0;
      }
      if (lamps.length) {
        // The nearest lamps get the lights; one already lit keeps its light
        // until another is a metre nearer, so two lamps never trade back and forth.
        for (const l of lamps) l.d = l.pos.distanceTo(camera.position) - (l.slot ? 1 : 0);
        const wanted = new Set(lamps.filter(l => l.on && powerRef.current).sort((a, b) => a.d - b.d).slice(0, lampPool.length));
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
        const seal = level.sewer?.sanctumGate;
        for (const tg of targets) {
          if (tg.uv && uvLightAt(uvLamps, tg.uv.point, tg.uv.normal) < UV_SEEN) continue;
          // The key once taken; an open gate, for all but the GM, who can shut it again.
          if (tg.seal && seal && openLocksRef.current[tg.seal === 'key' ? seal.key : seal.gate] && (tg.seal === 'key' || !isGMRef.current)) continue;
          // The hunter speaks only from behind its bars.
          if (tg.plea && !(hunter?.caged && cageShut())) continue;
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
      // Facing the hunter blurs too; the stronger of the two wins.
      const hunterBlur = hunter ? hunter.blur * (1 + 0.15 * Math.sin(t * 2.3)) : 0;
      const eased = Math.max(dread * dread * (3 - 2 * dread), hunter ? hunter.blur / 3.5 : 0);
      const blur = Math.max(dreadHazard ? eased * dreadHazard.maxBlurPx * (1 + 0.15 * Math.sin(t * 2.3)) : 0, hunterBlur);
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
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.style.filter = '';
      window.removeEventListener('resize', onResize);
      toggleRadioRef.current = null;
      tuneRadioRef.current = null;
      toggleSwitchRef.current = null;
      pleaRef.current = null;
      if (plea) {
        plea.el.pause();
        plea.el.removeAttribute('src');
        plea.sound.disconnect();
        scene.remove(plea.sound);
      }
      applySwitchRef.current = null;
      reloadRef.current = null;
      refreshPinsRef.current = null;
      window.clearInterval(pinTimer);
      pinboard?.dispose();
      markers?.dispose();
      stains?.dispose();
      for (const p of npcs) p.avatar?.dispose();
      for (const f of performers) {
        for (const a of [f.audio, f.voice]) {
          if (!a) continue;
          a.el.pause();
          a.el.removeAttribute('src');
          a.sound.disconnect();
        }
        f.mixer.stopAllAction();
        f.root.removeFromParent();
        f.root.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          for (const mat of [m.material].flat()) {
            for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
            mat.dispose();
          }
        });
      }
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
      for (const r of radios.values()) r.tuner?.dispose();
      setRadiosOn(new Set());
      setRadioDial({});
      setSwitchesOn(new Set());
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
      hunter?.dispose();
      bulletHoles.dispose();
      shells.dispose();
      inspectRef.current = null;
      dressing?.dispose();
      dressRef.current = null;
      lookRef.current = null;
      sendDressingRef.current = null;
      // The library's models, shared by every copy of them in the level.
      for (const p of propModels.values()) {
        p.then(t => t.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          for (const m of [mesh.material].flat()) {
            for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
            m.dispose();
          }
        })).catch(() => {});
      }
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      renderer.dispose();
      canvasRef.current = null;
      if (el.contains(canvas)) el.removeChild(canvas);
    };
  }, [openTarget, webgl, level, godot, arrive]);

  const hint = !webgl ? '3D unavailable' : !loaded
    ? loadError ? level.errorText : `${level.loadingText} ${Math.round(progress * 100)}%`
    : locked
      ? `WASD move · Shift run · Space jump · C crouch · Mouse look · ${fires ? 'E examine · click fire · right-click aim · R reload · V inspect' : `E / click examine${carriedPickup?.view.reload ? ' · R reload' : canCheck ? ' · R use a skill' : ''}`}${heldItem ? ' · U use item' : ''} · I inventory · F ${lampOut ? 'lamp switch' : 'torch'}${hasLamp ? " · Q Wood's lamp" : ''} · Tab markers · Esc release`
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
          {/* gamelord throws the mains here (or with L) for everyone in the level. */}
          {level.lamps && isGamelord && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: level.weather && isGM ? 0 : 'auto', marginRight: 12 }}>
              {powerError && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--blood)' }}>Not saved</span>
              )}
              <button
                onClick={() => void togglePower()}
                aria-pressed={power}
                title="Turn every lamp in the level on or off, for everyone [L]"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                  padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  background: power ? 'rgba(201,148,79,0.18)' : 'transparent',
                  border: `1px solid ${power ? 'var(--brass)' : 'var(--line)'}`,
                  color: power ? 'var(--brass)' : 'var(--ink-text-2)',
                }}
              >
                Lights {power ? 'on' : 'off'} [L]
              </button>
            </div>
          )}
          {/* gamelord opens and shuts the level's doors here, for everyone in it. */}
          {hasGmDoors(level) && isGamelord && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: (level.weather && isGM) || level.lamps ? 0 : 'auto', marginRight: 12 }}>
              {doorError && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--blood)' }}>Not saved</span>
              )}
              {[
                ...Object.entries(level.doors ?? {}).filter(([, d]) => !d.lock),
                ...(level.sewer?.grate ? [[level.sewer.grate, { label: 'Grate' }] as const] : []),
                ...(level.ambush ? [[level.ambush.id, { label: level.ambush.label }] as const] : []),
              ].map(([id, door]) => (
                <button
                  key={id}
                  onClick={() => void toggleDoor(id)}
                  aria-pressed={!!doorsOpen[id]}
                  title={id === level.ambush?.id
                    ? `Set off the ${door.label.toLowerCase()}'s ambush, or dismiss him, for everyone`
                    : `Open or shut the ${door.label.toLowerCase()}, for everyone`}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                    padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    background: doorsOpen[id] ? 'rgba(201,148,79,0.18)' : 'transparent',
                    border: `1px solid ${doorsOpen[id] ? 'var(--brass)' : 'var(--line)'}`,
                    color: doorsOpen[id] ? 'var(--brass)' : 'var(--ink-text-2)',
                  }}
                >
                  {door.label} {id === level.ambush?.id ? (doorsOpen[id] ? 'here' : 'gone') : doorsOpen[id] ? 'open' : 'shut'}
                </button>
              ))}
              {level.ambush && (
                <button
                  onClick={() => { ambushPreviewRef.current = Date.now(); }}
                  title={`Play the ${level.ambush.label.toLowerCase()}'s ambush on your screen only — nobody else sees it, and nothing is saved`}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                    padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    background: 'transparent', border: '1px dashed var(--brass-dim)', color: 'var(--ink-text-2)',
                  }}
                >
                  Preview {level.ambush.label.toLowerCase()}
                </button>
              )}
            </div>
          )}
          {/* gamelord dresses the level with props from the library, for everyone. */}
          {isGamelord && webgl && !godot && (
            <button
              onClick={toggleDressing}
              disabled={!loaded}
              aria-pressed={dressing}
              title="Set props from the library down in this level, for everyone [P]"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: loaded ? 'pointer' : 'default', marginRight: 12,
                marginLeft: (level.weather && isGM) || level.lamps || hasGmDoors(level) ? 0 : 'auto',
                background: dressing ? 'rgba(201,148,79,0.18)' : 'transparent',
                border: `1px solid ${dressing ? 'var(--brass)' : 'var(--line)'}`,
                color: dressing ? 'var(--brass)' : 'var(--ink-text-2)', opacity: loaded ? 1 : 0.5,
              }}
            >
              Set dressing [P]
            </button>
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

          {/* Down a telescopic sight: the round field of the lens, its crosshair, and the dark of the tube round it. */}
          {loaded && gunView?.arms?.scope && (
            <div ref={scopeRef} style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}>
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  <mask id="scope-lens">
                    <rect width="100%" height="100%" fill="#fff" />
                    <circle cx="50%" cy="50%" r="43vmin" fill="#000" />
                  </mask>
                  <radialGradient id="scope-shade">
                    <stop offset="78%" stopColor="#000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.75" />
                  </radialGradient>
                </defs>
                <circle cx="50%" cy="50%" r="43vmin" fill="url(#scope-shade)" />
                <rect width="100%" height="100%" fill="#000" mask="url(#scope-lens)" />
              </svg>
              {/* The posts: heavy from the edge, a fine wire across the middle. */}
              <div style={{ position: 'absolute', left: 'calc(50% - 43vmin)', width: '36vmin', top: 'calc(50% - 3px)', height: 6, background: '#000' }} />
              <div style={{ position: 'absolute', right: 'calc(50% - 43vmin)', width: '36vmin', top: 'calc(50% - 3px)', height: 6, background: '#000' }} />
              <div style={{ position: 'absolute', top: 'calc(50% - 43vmin)', height: '36vmin', left: 'calc(50% - 3px)', width: 6, background: '#000' }} />
              <div style={{ position: 'absolute', top: 'calc(50% + 7vmin)', height: '36vmin', left: 'calc(50% - 3px)', width: 6, background: '#000' }} />
              <div style={{ position: 'absolute', left: 'calc(50% - 7vmin)', width: '14vmin', top: 'calc(50% - 0.5px)', height: 1, background: '#000' }} />
              <div style={{ position: 'absolute', top: 'calc(50% - 7vmin)', height: '14vmin', left: 'calc(50% - 0.5px)', width: 1, background: '#000' }} />
            </div>
          )}

          {loaded && locked && asleep === 'no' && !reading && !browsing && !typing && !inspecting && (
            <div style={{
              position: 'absolute', left: '50%', top: '50%', width: 6, height: 6,
              marginLeft: -3, marginTop: -3, borderRadius: '50%', pointerEvents: 'none',
              background: focus ? 'var(--brass)' : 'rgba(232,220,200,0.45)',
              boxShadow: focus ? '0 0 8px var(--brass)' : 'none',
            }} />
          )}

          {loaded && focus && !dressing && asleep === 'no' && !reading && !browsing && !typing && !invOpen && !inspecting && (
            <div style={{
              position: 'absolute', left: '50%', top: 'calc(50% + 22px)', transform: 'translateX(-50%)',
              pointerEvents: 'none', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.5px',
              color: 'var(--parchment)', textShadow: '0 1px 4px #000',
            }}>
              {focus.npc ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Speak to {focus.entry.title.replace(/^The /, 'the ')}</>
              ) : focus.passage ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> {focus.passage.prompt}</>
              ) : focus.plea ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Listen to the {focus.entry.title.charAt(0).toLowerCase()}{focus.entry.title.slice(1)}</>
              ) : focus.lightSwitch ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Switch the {focus.lightSwitch.room} lights {switchesOn.has(focus.lightSwitch.id) ? 'off' : 'on'}</>
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
              ) : focus.seal === 'key' ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Take the {focus.entry.title.toLowerCase()}</>
              ) : focus.seal && level.sewer?.sanctumGate && openLocks[level.sewer.sanctumGate.gate] ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Seal the gates again<span style={{ color: 'var(--ink-text-2)' }}> · GM · the key goes back to the lair</span></>
              ) : focus.seal && level.sewer?.sanctumGate && openLocks[level.sewer.sanctumGate.key] ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Unlock the gates with the {level.examinables[level.sewer.sanctumGate.key]?.title.toLowerCase() ?? 'key'}</>
              ) : focus.id === level.sewer?.shrineLock && level.sewer.shrineSealed && !isGamelord ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Examine {level.sewer.shrineSealed.title}</>
              ) : level.locks?.[focus.id]?.item && openLocks[focus.id] ? (
                openLocks[level.locks[focus.id].item!.id]
                  ? isGM
                    ? <><span style={{ color: 'var(--brass)' }}>[E]</span> Put the {level.locks[focus.id].item!.title.toLowerCase()} back<span style={{ color: 'var(--ink-text-2)' }}> · GM</span></>
                    : <><span style={{ color: 'var(--brass)' }}>[E]</span> Look inside the {focus.entry.title.toLowerCase()}</>
                  : <><span style={{ color: 'var(--brass)' }}>[E]</span> Take the {level.locks[focus.id].item!.title.toLowerCase()}</>
              ) : level.locks?.[focus.id] ? (
                openLocks[focus.id]
                  ? <><span style={{ color: 'var(--brass)' }}>[E]</span> {level.locks[focus.id].prompt?.open ?? `Look inside the ${focus.entry.title.toLowerCase()}`}</>
                  : <><span style={{ color: 'var(--brass)' }}>[E]</span> {level.locks[focus.id].prompt?.locked ?? `Crack the ${focus.entry.title.toLowerCase()}`}</>
              ) : level.builders?.[focus.id] ? (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Work on the {focus.entry.title.charAt(0).toLowerCase()}{focus.entry.title.slice(1)}</>
              ) : level.radios?.[focus.id] ? (
                <>
                  <span style={{ color: 'var(--brass)' }}>[E]</span> Turn {radiosOn.has(focus.id) ? 'off' : 'on'} {focus.entry.title}
                  {level.radios[focus.id].dial && <> · <span style={{ color: 'var(--brass)' }}>[wheel]</span> or <span style={{ color: 'var(--brass)' }}>[, .]</span> tune</>}
                  <span style={{ color: 'var(--ink-text-2)' }}> · click to examine</span>
                  {level.radios[focus.id].dial && <RadioDial set={level.radios[focus.id]} kc={radioDial[focus.id] ?? level.radios[focus.id].dial!.at} />}
                </>
              ) : (
                <><span style={{ color: 'var(--brass)' }}>[E]</span> Examine {focus.entry.title}</>
              )}
              {canUseSkillOn(focus) && !carriedPickup?.view.reload && !fires && (
                <span style={{ color: 'var(--ink-text-2)' }}> · <span style={{ color: 'var(--brass)' }}>[R]</span> use a skill</span>
              )}
              {(carriedPickup || heldItem) && !focus.pickup && (
                <span style={{ color: 'var(--ink-text-2)' }}> · <span style={{ color: 'var(--brass)' }}>[U]</span> use {carriedPickup ? `the ${carriedPickup.title}` : heldItem}</span>
              )}
            </div>
          )}

          {/* What a performer near us is saying (Performer.speech). */}
          {loaded && subtitle && !dreaming && (
            <div style={{
              position: 'absolute', left: '50%', bottom: 64, transform: 'translateX(-50%)', width: 'min(720px, 86%)',
              pointerEvents: 'none', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.4,
              color: 'var(--parchment)', textShadow: '0 1px 3px #000, 0 0 8px #000',
            }}>
              <span style={{ background: 'rgba(0,0,0,0.55)', padding: '3px 10px', borderRadius: 'var(--r-sm)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>
                {subtitle}
              </span>
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
                {fires && <span style={{ color: 'var(--ink-text-2)' }}> · <span ref={ammoRef} style={{ color: 'var(--brass)' }} /></span>}
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

          {/* The dream, over the dark. */}
          {dreaming && (
            <>
              <iframe
                ref={dreamRef}
                src={level.dream}
                title="Asleep"
                onLoad={() => setDreamLocked(false)}
                allow="autoplay; fullscreen"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: 'block', background: '#000' }}
              />
              {!dreamLocked && (
                <div style={{
                  position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', pointerEvents: 'none',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase',
                  color: 'rgba(232,220,200,0.55)', textShadow: '0 1px 4px #000', whiteSpace: 'nowrap',
                }}>
                  Click to look · WASD swim · Space rise · <span style={{ color: 'var(--brass)' }}>[E]</span> wake
                </div>
              )}
            </>
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

          {dressing && loaded && (
            <SetDressing
              api={dressRef}
              items={dressItems}
              onChange={changeDressing}
              onUndo={undoDressing}
              canUndo={canUndoDress}
              onLook={(dx, dy) => lookRef.current?.(dx, dy)}
              onExit={toggleDressing}
              saveError={dressError}
              onRetry={() => void saveDressing()}
            />
          )}

          {webgl && loaded && !locked && !dressing && !dreaming && !reading && !browsing && !typing && !invOpen && !inspecting && (
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

          {typing?.npc && (freeTalkWith === typing
            ? <NpcConversation npc={typing.npc} onClose={closeTyping} />
            : <DialoguePane
                npc={typing.npc}
                onClose={closeTyping}
                onSpeakFreely={() => setFreeTalkWith(typing)}
                onNoise={level => { voiceRef.current = { level, until: performance.now() + 4000 }; }}
              />)}

          {typing && level.builders?.[typing.id] && (
            <ModelBuilder
              title={typing.entry.title}
              text={typing.entry.text}
              build={level.builders[typing.id]}
              isGM={isGM}
              onPlaced={piece => onShareRef.current(`set ${piece.title} into the ${typing.entry.title.charAt(0).toLowerCase()}${typing.entry.title.slice(1)}`)}
              onClose={closeTyping}
            />
          )}

          {typing && level.locks?.[typing.id] && (
            <SafeCracker
              title={typing.entry.title}
              text={typing.entry.text}
              lock={level.locks[typing.id]}
              onOpened={() => {
                setLock(typing.id);
                onShareRef.current(`cracked the ${typing.entry.title.toLowerCase()}`);
              }}
              // Opened, it steps straight to what is inside; otherwise back into the level.
              onClose={() => {
                const inside = openLocksRef.current[typing.id] ? insideOf(typing) : null;
                setTyping(null);
                if (inside) openReading(inside); else closeTyping();
              }}
            />
          )}

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
                  {isGM && reading.id.endsWith('-inside') && level.locks?.[reading.id.slice(0, -'-inside'.length)] && (
                    <button
                      onClick={() => { setLock(reading.id.slice(0, -'-inside'.length), true); closeReading(); }}
                      title="GM: shut the safe again for everyone"
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                        padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                        background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-text-2)',
                      }}
                    >
                      Lock it again
                    </button>
                  )}
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

/** A wireless's dial under the prompt: the band, its stations' ticks, the needle, and what it reads. */
function RadioDial({ set, kc }: { set: RadioSet; kc: number }) {
  const at = (f: number) => `${((f - BAND[0]) / (BAND[1] - BAND[0])) * 100}%`;
  const station = stationAt(set, kc);
  return (
    <div style={{ marginTop: 6, width: 260, marginInline: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <div style={{ position: 'relative', height: 14, borderBottom: '1px solid var(--brass-dim)' }}>
        {[600, 800, 1000, 1200, 1400, 1600].map(f => (
          <span key={f} style={{ position: 'absolute', left: at(f), bottom: 0, width: 1, height: 5, background: 'var(--brass-dim)' }} />
        ))}
        <span style={{ position: 'absolute', left: at(kc), bottom: 0, width: 2, height: 14, marginLeft: -1, background: 'var(--blood)', transition: 'left 80ms' }} />
      </div>
      <div style={{ marginTop: 3, color: station ? 'var(--brass)' : 'var(--ink-text-2)' }}>
        {kc} kc · {station ? station.name : 'static'}
      </div>
    </div>
  );
}
