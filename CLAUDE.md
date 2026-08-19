@AGENTS.md

# Hearthboard VTT — Project Guide

A browser-based Virtual Tabletop (VTT) for the *Echoes of Darkness* Call of Cthulhu campaign. Built with Next.js 16.3.1 and Auth.js v5. Runs fully in production with no external database — all state lives in the source or in `data/` (gitignored).

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.1 (App Router, Turbopack) |
| Auth | NextAuth / Auth.js v5 (`next-auth@^5.0.0-beta`) |
| Password hashing | bcryptjs (cost factor 12) |
| Styling | Tailwind CSS v4 + custom CSS variables |
| Language | TypeScript 5 / React 19 |
| Runtime | Node.js for API routes; Edge Runtime for `src/proxy.ts` |

## Running the App

```bash
npm run dev      # starts on http://localhost:3000
npm run build
npm run start
```

`AUTH_SECRET` must be set in `.env.local` (already configured, never commit this file).

## Project Structure

```
src/
  app/
    page.tsx                      # Main VTT board (client component, ~570 lines)
    layout.tsx                    # Root layout — Google Fonts, <Providers> wrapper
    globals.css                   # All CSS variables and component styles (~500 lines)
    providers.tsx                 # SessionProvider wrapper ('use client')
    login/page.tsx                # Login page (username + password)
    characters/
      page.tsx                    # Investigator dossier grid — all 7 characters
      [slug]/page.tsx             # Individual character sheet page
    admin/
      users/page.tsx              # Admin role management panel
    api/
      auth/[...nextauth]/route.ts # NextAuth route handler
      admin/users/route.ts        # GET/PATCH — list users and toggle roles
  auth.ts                         # Full NextAuth config (Node.js runtime only)
  auth.config.ts                  # Edge-safe config (no fs/bcrypt) — used by proxy
  proxy.ts                        # Next.js 16 edge middleware (replaces middleware.ts)
  lib/
    users.ts                      # Fixed account definitions + role override helpers
    characters.ts                 # All 7 investigator character data (typed)
  types/
    next-auth.d.ts                # Session/JWT type augmentation
data/
  roles.json                      # Runtime role overrides (gitignored, auto-created)
```

## Authentication

### Accounts

Four hardcoded accounts — no registration, no email, no external database. Credentials are embedded as bcrypt hashes directly in `src/lib/users.ts`.

| Username | Default Role | Notes |
|---|---|---|
| `gamelord` | Admin | Protected — role cannot be changed at runtime |
| `shay` | Player | Promotable to Admin by gamelord |
| `greg` | Player | Promotable to Admin by gamelord |
| `sanch` | Player | Promotable to Admin by gamelord |

Passwords were set in August 2026 and written down by the game master. To change a password, generate a new bcrypt hash (`node -e "require('bcryptjs').hash('newpass', 12).then(console.log)"`) and replace the `passwordHash` field for that account in `src/lib/users.ts`.

### Architecture — Edge Runtime Split

Next.js 16 runs `src/proxy.ts` on the **Edge Runtime**, which cannot import Node.js built-ins (`fs`, `path`, `bcrypt`, `crypto`). The solution is a two-file split:

- **`src/auth.config.ts`** — edge-safe config (no Node.js imports). Contains JWT/session callbacks and page routes. Used by `proxy.ts`.
- **`src/auth.ts`** — full config. Imports `auth.config.ts`, adds the Credentials provider, and calls `bcryptjs`. Used by API routes and server components.

### Role Persistence

When `gamelord` promotes a player to Admin, the override is written to `data/roles.json`. This file is gitignored. On each request, `src/lib/users.ts` reads the file to merge overrides with the fixed default roles.

### Proxy / Route Protection

`src/proxy.ts` (Next.js 16 replaces `middleware.ts` with this filename) protects all routes. Unauthenticated users are redirected to `/login`. Requests to `/admin/*` from non-admin users are redirected to `/`.

```
Public routes (no auth required): /login
Protected routes: everything else
Admin-only routes: /admin/*
```

### Session Shape

```ts
session.user = {
  id: string;        // same as username (e.g. "gamelord")
  name: string;      // display name (same as username)
  username: string;  // username
  role: "admin" | "user";
}
```

## Character Sheets

All 7 investigator dossiers for the *Echoes of Darkness* campaign are defined as typed data in `src/lib/characters.ts` and rendered at:

- `/characters` — card grid overview (accessible to all authenticated users)
- `/characters/[slug]` — full character sheet

### Characters

| Slug | Name | Class |
|---|---|---|
| `dr-alistair-finch` | Dr. Alistair Finch | The Disgraced Mortician |
| `silas-vance` | Silas "The Great" Vance | The Blackmailed Illusionist |
| `julian-sterling` | Julian Sterling | The Desperate Auteur |
| `thomas-callahan` | Thomas "Mack" Callahan | The Amnesiac Detective |
| `richard-graves` | Richard Pickman Graves | The Macabre Visionary |
| `arthur-wright` | Arthur Wright | The Non-Euclidean Architect |
| `percival-winthrop` | Percival Montgomery Winthrop | The Ruined Tycoon |

Each character has: vitals (HP, MP, SAN, Buffered SAN, Ancestral Resonance, Luck), core characteristics (STR/CON/SIZ/DEX/APP/INT/POW/EDU), skills with percentages, class abilities (Active/Passive/Utility/Buffered Sanity/Resonance Check), narrative hooks & flaws, and starting equipment.

### Campaign Mechanics

| Mechanic | Range | Description |
|---|---|---|
| Sanity (SAN) | 0–99 (current/max) | Loss of 5+ in one turn induces temporary insanity |
| Buffered Sanity | 0–N stored pts | Horror deferred through professional instruments; triggers on session end |
| Ancestral Resonance | 0–100% | Genetic alignment with the tomb; failure triggers involuntary ritual actions |
| Willpower (MP) | 1–20 | Fuel for psychological resistance and class abilities |
| Luck Pool | 0–99 | Expendable to adjust rolls; high expenditure increases Resonance risks |

## Main VTT Board (`src/app/page.tsx`)

The VTT board is a single large `'use client'` component. Key patterns:

- **Token drag-and-drop:** Uses a hybrid ref/state approach. `dragPosRef` tracks live position (no re-render), `dragPos` state triggers visual re-renders. `mouseup` reads from the ref to avoid stale state.
- **Scene management:** `currentSceneIdRef` is kept in sync via a separate `useEffect` so global mouse handlers always have the current scene without being re-registered.
- **HP ring:** CSS custom property `--hp-pct` is set via `style={{ ['--hp-pct' as string]: hpPct } as React.CSSProperties}`.
- **Dice rolling:** `rollFormula()` parses `NdS+M` notation and returns typed `RollResult`.

## CSS Design System

Defined in `src/app/globals.css`. Key CSS variables:

```css
--ink            /* primary dark background */
--surface        /* panel/card background */
--surface-2      /* table header background */
--line           /* border color */
--brass          /* gold accent — primary brand color */
--brass-dim      /* muted brass for borders */
--arcane         /* purple — magic/resonance */
--blood          /* red — HP and danger */
--forest         /* green — luck/nature */
--ink-text-2     /* secondary text */
--font-display   /* Fraunces — headings */
--font-mono      /* JetBrains Mono — stats, labels */
--r-lg           /* standard border radius */
```

## Gitignored Files

| Path | Reason |
|---|---|
| `.env*` | Contains `AUTH_SECRET` |
| `data/` | Contains `roles.json` with runtime role overrides |
| `.playwright-mcp/` | Browser automation session data |

## Key Decisions & Gotchas

- **`proxy.ts` not `middleware.ts`:** Next.js 16 renamed the middleware convention. Running `npx @next/codemod@canary middleware-to-proxy .` handles the migration. Having both files causes a startup error.
- **Edge Runtime cannot use bcrypt:** Any import of `bcryptjs`, `crypto`, or `fs` in `proxy.ts` or `auth.config.ts` will crash the Edge Runtime. Keep those in `auth.ts` only.
- **bcrypt hashes in source are safe:** The hashes in `src/lib/users.ts` cannot be reversed without brute force. Passwords themselves are never stored anywhere in the codebase.
- **`data/roles.json` is auto-created:** If `data/` doesn't exist on a fresh deployment, `setRole()` creates it. No manual setup required.
- **No `ensureAdminExists()` seeding:** The old email-based system seeded an admin on startup. The new fixed-account system doesn't need this — accounts always exist in source.
