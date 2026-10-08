import { createClient, type Client } from '@liveblocks/client';
import type { Gait } from './avatars';
import type { HunterSnapshot } from './hunter';

/**
 * Live presence in a walkthrough level: who else is in it and where they
 * stand. Each level is its own Liveblocks room ("hearthboard:walk:<level>"),
 * entered when the level opens and left when it closes. Positions go out at
 * most every 100 ms; there is no stored state, only presence.
 *
 * A level's hunter is shared the same way: one client leads it (see
 * `leadsHunter`) and puts where it is in its presence; its blows go out as
 * room events to whoever they land on.
 *
 * Tokens come from /api/liveblocks-auth. Without LIVEBLOCKS_SECRET_KEY that
 * refuses, and the level carries on single-player.
 */

/**
 * `lamp` is present while their Wood's lamp is lit: the pitch it is aimed at (it points where they look).
 * `crouch` is present while they are crouched (C), `torch` while their torch is on, and `busy`
 * while they are reading, typing or asleep (the hunter leaves them be). `pitch` is where they look.
 */
export type Pose = { p: [number, number, number]; yaw: number; pitch?: number; gait: Gait; lamp?: number; crouch?: true; torch?: true; busy?: true };
/** `hunter`: where the level's hunter is, when this peer leads it; `ready`: its hunter has loaded and could lead. */
export type Peer = { id: number; userId: string; name: string; slug: string | null; pose: Pose | null; hunter: HunterSnapshot | null; ready: boolean };
/** A blow from the hunter, sent by whoever leads it to the one it landed on. */
export type HunterHit = { type: 'hunter-hit'; to: number };

type Presence = { pose: Pose | null; hunter?: HunterSnapshot | null; hr?: boolean };
type UserMeta = { id: string; info: { name: string; slug: string | null } };

let client: Client<UserMeta> | null = null;
function getClient() {
  client ??= createClient<UserMeta>({ authEndpoint: '/api/liveblocks-auth', throttle: 100 });
  return client;
}

export type LevelPresence = {
  /** Call every frame; it only sends when the pose has changed, and Liveblocks batches to the throttle. */
  setPose: (pose: Pose) => void;
  /** Where the hunter is, while this client leads it (null once it doesn't); also every frame. */
  setHunter: (snap: HunterSnapshot | null) => void;
  /** This client's hunter has loaded, so it can lead. */
  setHunterReady: (ready: boolean) => void;
  /** This client's connection id, or null while it is not connected (alone). */
  selfId: () => number | null;
  /** Tells `to` that the hunter's blow landed on them. */
  sendHit: (to: number) => void;
  leave: () => void;
};

/**
 * Who leads the hunter: the lowest connection id among the clients whose
 * hunter is ready, this one included. Alone (or offline), this one does.
 */
export function leadsHunter(selfId: number | null, selfReady: boolean, peers: Peer[]) {
  if (selfId === null) return true;
  if (!selfReady) return false;
  return peers.every(p => !p.ready || p.id > selfId);
}

let enabled: Promise<boolean> | null = null;
/** Asked once per page: is LIVEBLOCKS_SECRET_KEY set? Saves a doomed connection and its console errors. */
function presenceEnabled() {
  enabled ??= fetch('/api/liveblocks-auth', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : { enabled: false }))
    .then((d: { enabled?: boolean }) => !!d.enabled)
    .catch(() => false);
  return enabled;
}

/**
 * Joins the level's room if presence is set up. Until (or unless) it connects,
 * setPose is a no-op and onPeers is never called.
 */
export function joinLevel(levelId: string, onPeers: (peers: Peer[]) => void, onHit?: () => void): LevelPresence {
  let live: { room: Room; leave: () => void; unsub: () => void } | null = null;
  let left = false;
  let last = '';
  let lastHunter = '';
  let ready = false;
  void presenceEnabled().then(ok => {
    if (!ok || left) return;
    const { room, leave } = enterLevelRoom(levelId, ready);
    const unsubOthers = subscribeOthers(room, onPeers);
    const unsubEvents = room.subscribe('event', ({ event }) => {
      if (event?.type === 'hunter-hit' && event.to === room.getSelf()?.connectionId) onHit?.();
    });
    live = { room, leave, unsub: () => { unsubOthers(); unsubEvents(); } };
  });
  return {
    setPose(pose) {
      if (!live) return;
      // Round so a player standing still sends nothing.
      const r = (n: number) => Math.round(n * 100) / 100;
      const next: Pose = { p: [r(pose.p[0]), r(pose.p[1]), r(pose.p[2])], yaw: r(pose.yaw), gait: pose.gait };
      if (pose.lamp !== undefined) next.lamp = r(pose.lamp);
      if (pose.pitch !== undefined) next.pitch = Math.round(pose.pitch * 20) / 20;
      if (pose.crouch) next.crouch = true;
      if (pose.torch) next.torch = true;
      if (pose.busy) next.busy = true;
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      live.room.updatePresence({ pose: next });
    },
    setHunter(snap) {
      if (!live) return;
      const r = (n: number) => Math.round(n * 100) / 100;
      const next = snap && { ...snap, p: [r(snap.p[0]), r(snap.p[1]), r(snap.p[2])] as [number, number, number], yaw: r(snap.yaw), pace: r(snap.pace) };
      const key = JSON.stringify(next);
      if (key === lastHunter) return;
      lastHunter = key;
      live.room.updatePresence({ hunter: next });
    },
    setHunterReady(on) {
      if (on === ready) return;
      ready = on;
      live?.room.updatePresence({ hr: on });
    },
    selfId() {
      return live?.room.getSelf()?.connectionId ?? null;
    },
    sendHit(to) {
      live?.room.broadcastEvent({ type: 'hunter-hit', to });
    },
    leave() {
      left = true;
      live?.unsub();
      live?.leave();
      live = null;
    },
  };
}

const enterLevelRoom = (levelId: string, ready: boolean) =>
  getClient().enterRoom<Presence, never, HunterHit>(`hearthboard:walk:${levelId}`, {
    initialPresence: { pose: null, hunter: null, hr: ready },
  });
type Room = ReturnType<typeof enterLevelRoom>['room'];

function subscribeOthers(room: Room, onPeers: (peers: Peer[]) => void) {
  return room.subscribe('others', others => {
    onPeers(others.map(o => ({
      id: o.connectionId,
      userId: o.id,
      name: o.info?.name ?? o.id,
      slug: o.info?.slug ?? null,
      pose: (o.presence as Presence).pose,
      hunter: (o.presence as Presence).hunter ?? null,
      ready: !!(o.presence as Presence).hr,
    })));
  });
}
