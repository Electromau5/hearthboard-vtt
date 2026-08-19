import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

/**
 * Reads NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY from the environment.
 * Until a real key from https://liveblocks.io/dashboard is added to
 * .env.local, this stays a placeholder and the client will simply fail to
 * authenticate — components using these hooks are written to degrade
 * gracefully (see LOCAL FALLBACK notes in consuming components) rather than
 * crash when that happens.
 */
const publicApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY ?? "";

export const LIVEBLOCKS_CONFIGURED =
  publicApiKey.length > 0 && publicApiKey.startsWith("pk_");

const client = createClient({
  publicApiKey: LIVEBLOCKS_CONFIGURED ? publicApiKey : "pk_placeholder_not_configured",
});

/** Cursor position in "unscaled" map/canvas coordinates, or null when off-canvas. */
type Cursor = { x: number; y: number } | null;

// One entry per connected user, broadcast automatically by Liveblocks.
type Presence = {
  cursor: Cursor;
  name: string;
  color: string;
};

// Shared, persisted document state for a room (a single game/table).
// Extended in later layers (tokens in Layer 3, etc.) — kept minimal for
// Layer 1 so the sync sandbox only pulls in what it needs.
type Storage = Record<string, never>;

// Static user info, not needed yet.
type UserMeta = {
  id?: string;
  info?: {
    name?: string;
    color?: string;
  };
};

// Fire-and-forget events broadcast to everyone in the room (used from
// Layer 4 onward for chat + dice rolls).
type RoomEvent = Record<string, never>;

export const {
  RoomProvider,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOthersMapped,
  useSelf,
  useStorage,
  useMutation,
  useBroadcastEvent,
  useEventListener,
  useStatus,
  useRoom,
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(client);
