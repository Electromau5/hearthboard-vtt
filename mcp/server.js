#!/usr/bin/env node
/**
 * Hearthboard VTT MCP server (stdio). A thin proxy over the app's own HTTP API,
 * so the app's routes stay the only gatekeeper for its data. It signs in as the
 * gamelord account the way the login page does and carries the session cookie.
 *
 *   HEARTHBOARD_BASE      the app's origin. Default http://localhost:3000;
 *                         production is https://hearthboard-vtt.vercel.app
 *   HEARTHBOARD_USERNAME  default "gamelord"
 *   HEARTHBOARD_PASSWORD  or put the password in ~/.config/hearthboard/gamelord-password
 *                         (chmod 600) so it never sits in ~/.claude.json
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const BASE = (process.env.HEARTHBOARD_BASE || 'http://localhost:3000').replace(/\/+$/, '');
const USERNAME = process.env.HEARTHBOARD_USERNAME || 'gamelord';
const LIVE = !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE);

function password() {
  if (process.env.HEARTHBOARD_PASSWORD) return process.env.HEARTHBOARD_PASSWORD;
  const file = path.join(os.homedir(), '.config', 'hearthboard', 'gamelord-password');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { /* handled below */ }
  throw new Error(`No ${USERNAME} password: set HEARTHBOARD_PASSWORD or write it to ${file}`);
}

// ── Session ────────────────────────────────────────────────────────
const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
function storeCookies(res) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    if (i < 0) continue;
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (value === '' || /max-age=0/i.test(line)) jar.delete(name); else jar.set(name, value);
  }
}

async function login() {
  jar.clear();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: 'manual' });
  storeCookies(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, username: USERNAME, password: password(), json: 'true' }),
  });
  storeCookies(res);
  const check = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookieHeader() } });
  const session = await check.json().catch(() => null);
  if (session?.user?.id !== USERNAME) {
    throw new Error(`Login to ${BASE} as ${USERNAME} failed (wrong password?). Callback answered ${res.status}.`);
  }
}

/** Calls the app's API; signs in first, and again once if the session has lapsed. */
async function api(method, route, body) {
  const call = () => fetch(`${BASE}${route}`, {
    method,
    redirect: 'manual',
    headers: { Cookie: cookieHeader(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (jar.size === 0) await login();
  let res = await call();
  // Signed-out requests are answered with a redirect to /login (the proxy) or a 401.
  if (res.status === 401 || (res.status >= 300 && res.status < 400)) {
    await login();
    res = await call();
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ── Tools ──────────────────────────────────────────────────────────
const SECTIONS = ['Documents', 'Patient Files', 'Artifacts', 'Weapons & Hardware', 'Medical'];
const WARN = `Takes effect immediately on ${LIVE ? 'the LIVE production server, visible to every player' : 'the local server'} and cannot be undone. Confirm with the user first.`;
const str = (description) => ({ type: 'string', description });
const obj = (properties, required = []) => ({ type: 'object', properties, required });

const resourceProps = {
  name: str('Display name.'),
  section: { type: 'string', enum: SECTIONS, description: 'Which All Resources tab it belongs to.' },
  kind: { type: 'string', enum: ['item', 'image', 'video', 'audio'], description: 'item = a catalogue row with no viewer (default). image/video/audio need src.' },
  status: { type: 'string', enum: ['active', 'archived', 'basecamp'], description: 'active = carried in the field (default); archived = held at the Black Archive; basecamp = an investigator\'s stash at basecamp.' },
  carriedBy: str("The investigator's name, for active and basecamp items (e.g. \"Dr. Alissa Finch\")."),
  detail: str('One-line description shown under the name.'),
  note: str("The GM's standing note on the item."),
  group: str('Sub-section within its tab (e.g. "Firearms & Blades").'),
  src: str('Path under public/ or a URL, for image/video/audio.'),
  pages: { type: 'array', items: { type: 'string' }, description: 'Every image of a paged report, in reading order.' },
};

const TOOLS = [
  { name: 'list_custom_resources', description: 'List the resources added through this connection (the live custom list). Built-in resources in src/lib/resources.ts are not included.', inputSchema: obj({}), run: () => api('GET', '/api/resources/custom') },
  { name: 'create_resource', description: `Add a resource to All Resources. Players see it the next time they open the panel. ${WARN}`, inputSchema: obj(resourceProps, ['name', 'section']), run: (a) => api('POST', '/api/resources/custom', a) },
  { name: 'update_resource', description: `Change fields of a custom resource; omitted fields are kept. ${WARN}`, inputSchema: obj({ id: str('The custom resource id, e.g. "custom-1a2b3c4d".'), ...resourceProps }, ['id']), run: ({ id, ...rest }) => api('PATCH', `/api/resources/custom/${encodeURIComponent(id)}`, rest) },
  { name: 'delete_resource', description: `DESTRUCTIVE: permanently delete a custom resource. ${WARN}`, inputSchema: obj({ id: str('The custom resource id.') }, ['id']), run: ({ id }) => api('DELETE', `/api/resources/custom/${encodeURIComponent(id)}`) },
  { name: 'list_released_resources', description: 'List the ids of archived resources the gamelord has released to the party.', inputSchema: obj({}), run: () => api('GET', '/api/resources/unlocked') },
  { name: 'set_resource_released', description: `Release an archived resource to the party (released: true) or return it to the Archive. ${WARN}`, inputSchema: obj({ id: str('Resource id.'), released: { type: 'boolean' } }, ['id', 'released']), run: ({ id, released }) => api('POST', '/api/resources/unlocked', { id, unlocked: released }) },

  { name: 'list_locations', description: 'List campaign locations, with stored edits applied.', inputSchema: obj({}), run: () => api('GET', '/api/admin/locations') },
  { name: 'create_location', description: `Add a location. ${WARN}`, inputSchema: obj({ name: str('Name.'), description: str('Description.') }, ['name']), run: (a) => api('POST', '/api/admin/locations', a) },
  { name: 'update_location', description: `Edit a location's name, description or primaryImage. ${WARN}`, inputSchema: obj({ id: str('Location id.'), name: str('New name.'), description: str('New description.'), primaryImage: str('Image URL.') }, ['id']), run: ({ id, ...rest }) => api('PATCH', `/api/admin/locations/${encodeURIComponent(id)}`, rest) },
  { name: 'delete_location', description: `DESTRUCTIVE: delete a location added after the build (the campaign's own locations are refused). ${WARN}`, inputSchema: obj({ id: str('Location id.') }, ['id']), run: ({ id }) => api('DELETE', `/api/admin/locations/${encodeURIComponent(id)}`) },

  { name: 'list_notes', description: "List the board's sticky notes.", inputSchema: obj({}), run: () => api('GET', '/api/notes') },
  { name: 'create_note', description: `Pin a sticky note on a scene's map. ${WARN}`, inputSchema: obj({ text: str('Note text.'), x: { type: 'number', description: 'Map x, 0-100 (%).' }, y: { type: 'number', description: 'Map y, 0-100 (%).' }, sceneId: str('Scene id, e.g. "miskatonic".') }, ['text', 'x', 'y', 'sceneId']), run: (a) => api('POST', '/api/notes', a) },
  { name: 'update_note', description: `Change a note's text or position. ${WARN}`, inputSchema: obj({ id: str('Note id.'), text: str('New text.'), x: { type: 'number' }, y: { type: 'number' } }, ['id']), run: ({ id, ...rest }) => api('PATCH', `/api/notes/${encodeURIComponent(id)}`, rest) },
  { name: 'delete_note', description: `DESTRUCTIVE: delete a sticky note. ${WARN}`, inputSchema: obj({ id: str('Note id.') }, ['id']), run: ({ id }) => api('DELETE', `/api/notes/${encodeURIComponent(id)}`) },

  { name: 'list_characters', description: 'List every investigator with stored sheet edits applied.', inputSchema: obj({}), run: () => api('GET', '/api/characters') },
  { name: 'get_character', description: 'Get one investigator\'s sheet by slug (e.g. "silas-vance").', inputSchema: obj({ slug: str('Character slug.') }, ['slug']), run: ({ slug }) => api('GET', `/api/admin/characters/${encodeURIComponent(slug)}`) },
  { name: 'update_character', description: `Edit an investigator's sheet. \`changes\` is a partial Character (name, equipment, skills, hp, ...); arrays you send replace the stored ones whole. ${WARN}`, inputSchema: obj({ slug: str('Character slug.'), changes: { type: 'object', description: 'Fields to change.' } }, ['slug', 'changes']), run: ({ slug, changes }) => api('PATCH', `/api/admin/characters/${encodeURIComponent(slug)}`, changes) },
];

const server = new Server({ name: 'hearthboard', version: '0.1.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  const tool = TOOLS.find((t) => t.name === params.name);
  if (!tool) return { isError: true, content: [{ type: 'text', text: `Unknown tool ${params.name}` }] };
  try {
    const out = await tool.run(params.arguments ?? {});
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: String(e?.message ?? e) }] };
  }
});
await server.connect(new StdioServerTransport());
