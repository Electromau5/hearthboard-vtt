/**
 * Client-side access to the shared case board (`/api/board`): reading it, and
 * filing a note onto it from somewhere other than the board itself — the
 * Black Archive's typewriter, or a clue an investigator turned up with a skill
 * in a walkthrough.
 */

export type BoardItem = {
  id: string; type: 'note' | 'image'; x: number; y: number; rotation?: number;
  text?: string; imageUrl?: string; caption?: string; color?: string; author?: string;
};
export type BoardState = { items: BoardItem[]; connections: { fromId: string; toId: string; color: string }[] };

/** How big the case board draws each kind of item, in board pixels. */
export const NOTE_SIZE = { note: { w: 160, h: 90 }, image: { w: 180, h: 140 } };

/**
 * Id prefixes of notes filed from elsewhere: `tw` typed at the Archive's
 * typewriter, `clue` saved from a skill check. They share one grid.
 */
const FILED = ['tw', 'clue'];

export async function fetchBoard(): Promise<BoardState> {
  const res = await fetch('/api/board', { cache: 'no-store' });
  if (!res.ok) throw new Error(`board ${res.status}`);
  return res.json();
}

/**
 * Pin a note to the case board, in a grid of filed notes below the players'
 * own arrangement, so it never lands on top of anything they placed.
 */
export async function fileNote(text: string, author: string, opts: { prefix: 'tw' | 'clue'; color: string }): Promise<void> {
  const board = await fetchBoard();
  const { w, h } = NOTE_SIZE.note;
  const theirs = board.items.filter(i => !FILED.some(p => i.id.startsWith(p)));
  const filed = board.items.length - theirs.length;
  const bottom = theirs.length ? Math.max(...theirs.map(i => i.y + NOTE_SIZE[i.type].h)) : 0;
  const left = theirs.length ? Math.min(...theirs.map(i => i.x)) : 40;
  const item: BoardItem = {
    id: opts.prefix + Date.now(),
    type: 'note',
    x: left + (filed % 5) * (w + 20),
    y: bottom + 40 + Math.floor(filed / 5) * (h + 30),
    rotation: (Math.random() - 0.5) * 4,
    color: opts.color,
    text,
    author,
  };
  const res = await fetch('/api/board', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'add-item', item }),
  });
  if (!res.ok) throw new Error(`board ${res.status}`);
}
