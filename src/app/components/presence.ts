import { createClient, type Client } from '@liveblocks/client';
import type { Gait } from './avatars';

/**
 * Live presence in a walkthrough level: who else is in it and where they
 * stand. Each level is its own Liveblocks room ("hearthboard:walk:<level>"),
 * entered when the level opens and left when it closes. Positions go out at
 * most every 100 ms; there is no stored state, only presence.
 *
 * Tokens come from /api/liveblocks-auth. Without LIVEBLOCKS_SECRET_KEY that
 * refuses, and the level carries on single-player.
 */

export type Pose = { p: [number, number, number]; yaw: number; gait: Gait };
export type Peer = { id: number; userId: string; name: string; slug: string | null; pose: Pose | null };

type Presence = { pose: Pose | null };
type UserMeta = { id: string; info: { name: string; slug: string | null } };

let client: Client<UserMeta> | null = null;
function getClient() {
  client ??= createClient<UserMeta>({ authEndpoint: '/api/liveblocks-auth', throttle: 100 });
  return client;
}

export type LevelPresence = {
  /** Call every frame; it only sends when the pose has changed, and Liveblocks batches to the throttle. */
  setPose: (pose: Pose) => void;
  leave: () => void;
};

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
export function joinLevel(levelId: string, onPeers: (peers: Peer[]) => void): LevelPresence {
  let live: { room: Room; leave: () => void; unsub: () => void } | null = null;
  let left = false;
  let last = '';
  void presenceEnabled().then(ok => {
    if (!ok || left) return;
    const { room, leave } = getClient().enterRoom<Presence>(`hearthboard:walk:${levelId}`, {
      initialPresence: { pose: null },
    });
    const unsub = subscribeOthers(room, onPeers);
    live = { room, leave, unsub };
  });
  return {
    setPose(pose) {
      if (!live) return;
      // Round so a player standing still sends nothing.
      const r = (n: number) => Math.round(n * 100) / 100;
      const next: Pose = { p: [r(pose.p[0]), r(pose.p[1]), r(pose.p[2])], yaw: r(pose.yaw), gait: pose.gait };
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      live.room.updatePresence({ pose: next });
    },
    leave() {
      left = true;
      live?.unsub();
      live?.leave();
      live = null;
    },
  };
}

type Room = ReturnType<Client<UserMeta>['enterRoom']>['room'];

function subscribeOthers(room: Room, onPeers: (peers: Peer[]) => void) {
  return room.subscribe('others', others => {
    onPeers(others.map(o => ({
      id: o.connectionId,
      userId: o.id,
      name: o.info?.name ?? o.id,
      slug: o.info?.slug ?? null,
      pose: (o.presence as Presence).pose,
    })));
  });
}
