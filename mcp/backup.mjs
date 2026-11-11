#!/usr/bin/env node
// Saves a snapshot of the app's shared JSON state to backups/ — run before writing to production.
//   HEARTHBOARD_BASE=https://hearthboard-vtt.vercel.app node mcp/backup.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.env.HEARTHBOARD_BASE || 'http://localhost:3000').replace(/\/+$/, '');
const USER = process.env.HEARTHBOARD_USERNAME || 'gamelord';
const pw = process.env.HEARTHBOARD_PASSWORD
  || fs.readFileSync(path.join(os.homedir(), '.config/hearthboard/gamelord-password'), 'utf8').trim();

const jar = new Map();
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const keep = (res) => { for (const l of res.headers.getSetCookie?.() ?? []) { const [p] = l.split(';'); const i = p.indexOf('='); jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } };

const c = await fetch(`${BASE}/api/auth/csrf`); keep(c);
const { csrfToken } = await c.json();
keep(await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie() },
  body: new URLSearchParams({ csrfToken, username: USER, password: pw, json: 'true' }),
}));

const routes = ['admin/locations', 'notes', 'characters', 'resources/unlocked', 'resources/custom', 'characters/assignments', 'board'];
const out = { takenAt: new Date().toISOString(), base: BASE };
for (const r of routes) {
  const res = await fetch(`${BASE}/api/${r}`, { headers: { Cookie: cookie() }, redirect: 'manual' });
  out[r] = res.ok ? await res.json() : { error: res.status };
}
fs.mkdirSync('backups', { recursive: true });
const file = `backups/prod-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(file, fs.statSync(file).size, 'bytes;', Object.entries(out).filter(([, v]) => v?.error).map(([k, v]) => `${k}: ${v.error}`).join(', ') || 'all routes ok');
