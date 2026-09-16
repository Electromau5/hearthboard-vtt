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
| 3D | three.js (`three@^0.185`) — dice roller and relief viewer |
| Shared state | Upstash Redis (prod) / `data/` (dev) — characters, board, chat |
| Legacy (unprovisioned) | Vercel Blob — still imported by notes, effects, assignments, locations, assets |
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
    page.tsx                      # Main VTT board (client component, ~2400 lines)
    layout.tsx                    # Root layout — Google Fonts, <Providers> wrapper
    loading.tsx                   # Route suspense fallback → <LoadingOverlay>
    globals.css                   # All CSS variables and component styles (~1100 lines)
    providers.tsx                 # SessionProvider + <NavigationLoader> ('use client')
    login/page.tsx                # Login page (username + password)
    components/
      DiceRollerPane.tsx          # 3D dice roller (three.js + GLTFLoader)
      CthulhuReliefModal.tsx      # 3D relief viewer with walkthrough mode (three.js)
      InvestigationBoard.tsx      # Corkboard — draggable notes/images, polls /api/board every 5s
      LoadingOverlay.tsx          # Full-screen GIF loader
      NavigationLoader.tsx        # Shows the overlay for one GIF cycle on route change
    characters/
      page.tsx                    # Investigator dossier grid — all 7 characters
      [slug]/page.tsx             # Individual character sheet page
      [slug]/edit/page.tsx        # Sheet editor — admin, or the assigned player
    locations/page.tsx            # Player-facing location list + attachments
    admin/
      users/page.tsx              # Admin role management panel
      experience/page.tsx         # Screen effects trigger panel
      characters/page.tsx         # Character management
      characters/[slug]/edit/page.tsx   # Admin sheet editor
      locations/page.tsx          # Location management
      assets/page.tsx             # Asset management
    api/
      auth/[...nextauth]/route.ts # NextAuth route handler
      admin/users/route.ts        # GET/PATCH — list users and toggle roles
      admin/effects/route.ts      # GET/POST/DELETE — screen effects
      admin/characters/[slug]/route.ts           # GET/PATCH — character overrides
      admin/characters/[slug]/avatar/route.ts    # POST — upload character avatar
      admin/locations/route.ts                   # GET/POST — list + create locations
      admin/locations/[id]/route.ts              # PATCH/DELETE — edit/remove a location
      admin/locations/[id]/attachments/route.ts  # POST/DELETE — location attachments
      admin/assets/route.ts       # GET/POST — asset index + upload
      admin/assets/[id]/route.ts  # DELETE — remove an asset
      characters/[slug]/avatar/route.ts  # GET — serve a character avatar
      characters/assignments/route.ts    # GET/POST/DELETE — slug → user assignments
      campaign/export/route.ts    # POST — exports full campaign as Markdown
      chat/route.ts               # GET/POST — shared roll broadcast feed
      notes/route.ts              # GET/POST — sticky notes
      notes/[id]/route.ts         # PATCH/DELETE — edit/remove a sticky note
      board/route.ts              # GET/POST — shared board state
      effects/route.ts            # GET — player-facing effects polling
      dev-assets/[...path]/route.ts      # GET — serves files out of data/ in local dev
  auth.ts                         # Full NextAuth config (Node.js runtime only)
  auth.config.ts                  # Edge-safe config (no fs/bcrypt) — used by proxy
  proxy.ts                        # Next.js 16 edge middleware (replaces middleware.ts)
  lib/
    users.ts                      # Fixed accounts, role overrides, character assignments
    characters.ts                 # All 7 investigator character data (typed)
    character-storage.ts          # Redis (prod) / filesystem (dev) character persistence
    blob-storage.ts               # Vercel Blob (prod) / filesystem (dev) helpers
    campaign-defaults.ts          # Default location data
    vtt-types.ts                  # Shared TypeScript types
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
  id: string;             // same as username (e.g. "gamelord")
  name: string;           // display name (same as username)
  username: string;       // username
  role: "admin" | "user";
  assignedSlug?: string;  // character this player may edit — see below
}
```

### Character Assignment

Each player account is bound to one investigator. The binding is hardcoded in `src/lib/users.ts` as `assignedSlug`:

| Account | Assigned investigator |
|---|---|
| `shay` | `arthur-wright` |
| `greg` | `dr-alistair-finch` |
| `sanch` | `thomas-callahan` |
| `gamelord` | none (admin — may edit any sheet) |

`getHardcodedAssignments()` exposes these as a `slug → userId` map. `GET /api/characters/assignments` merges blob-stored overrides with that map — **hardcoded assignments always win**, overrides only fill in unassigned slugs.

Authorization happens in two places:

- **Client** (`characters/[slug]/edit/page.tsx`) — admins are authorized immediately; everyone else fetches `/api/characters/assignments` and is redirected back to the read-only sheet unless `assignments[slug] === session.user.id`.
- **Server** (`api/admin/characters/[slug]/route.ts`, and the avatar route) — checks `session.user.assignedSlug === slug`.

`assignedSlug` reaches the token two ways: the `signIn` branch of the `jwt` callback in `auth.config.ts` copies it off the user record, and the `update` trigger accepts a client-side write — `characters/[slug]/page.tsx` calls `updateSession({ assignedSlug: slug })` when a player opens their own sheet.

## Character Sheets

All 7 investigator dossiers for the *Echoes of Darkness* campaign are defined as typed data in `src/lib/characters.ts` and rendered at:

- `/characters` — card grid overview (accessible to all authenticated users)
- `/characters/[slug]` — full character sheet

Character overrides (edits made during play) are stored in Upstash Redis on production and `data/characters/<slug>.json` locally.

**Every view must render a *merged* record**, never the raw `CHARACTERS` array — `src/lib/character-merge.ts` layers stored overrides onto the compiled-in definition, and `GET /api/characters` returns the whole merged roster. The dossier grid, the admin list and the VTT board all read from that endpoint; rendering `CHARACTERS` directly is what previously made a rename visible only on the sheet that made it. The board keeps its own `DEFAULT_CHARACTERS` array for board-only fields (token inventory, ability shorthand) but patches name, class and HP from the endpoint on mount.

## Main VTT Board (`src/app/page.tsx`)

The VTT board is a large `'use client'` component that composes the panes in `src/app/components/`. Key patterns:

- **Token drag-and-drop:** Uses a hybrid ref/state approach. `dragPosRef` tracks live position (no re-render), `dragPos` state triggers visual re-renders. `mouseup` reads from the ref to avoid stale state.
- **Scene management:** `currentSceneIdRef` is kept in sync via a separate `useEffect` so global mouse handlers always have the current scene without being re-registered.
- **HP ring:** CSS custom property `--hp-pct` is set via `style={{ ['--hp-pct' as string]: hpPct } as React.CSSProperties}`.
- **Dice rolling:** `rollFormula()` parses `NdS+M` notation and returns typed `RollResult`.
- **Skill checks:** `rollCheck(charName, label, target)` rolls d100 roll-under and grades the result with `checkLevel()` into the Call of Cthulhu success levels below. Every characteristic and skill in the Characters pane is a button wired to it, so play does not require opening `/characters/[slug]`. Checks deliberately do **not** switch panes — the verdict comes back as a toast while the graded card goes to the shared chat. Skill and characteristic values come from the merged roster (`/api/characters`), so sheet edits change what the buttons roll against.

| Roll | Result |
|---|---|
| 01 | Critical |
| ≤ target ÷ 5 | Extreme success |
| ≤ target ÷ 2 | Hard success |
| ≤ target | Regular success |
| > target | Failure |
| 100, or 96–00 when target < 50 | Fumble |
- **Shared roll chat:** Rolls are POSTed to `/api/chat` and polled every 3s so all players see each other's rolls in real time.
- **Screen effects:** Admin triggers visual effects (sanity slip, darkness, blood vision, etc.) via `/admin/experience`; players poll `/api/effects` every 3s.
- **3D panes:** `DiceRollerPane` and `CthulhuReliefModal` each build their own three.js scene and load GLTF models via `GLTFLoader`. Both are `'use client'` only — three.js must never reach a server component.
- **Investigation board:** `InvestigationBoard` is a separate corkboard surface (draggable notes and images) that polls `/api/board` every 5s, independent of the token board.
- **Navigation loader:** `NavigationLoader` (mounted in `providers.tsx`) shows a full-screen GIF for one full 3.3s animation cycle on every route change.

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
--forest         /* green — luck/nature, successful checks */
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
- **Character storage uses Redis (prod) / filesystem (dev):** `src/lib/character-storage.ts` checks `NODE_ENV !== 'development'` before connecting to Upstash — local dev always uses the filesystem even if KV env vars are present.
- **⚠️ Vercel Blob is no longer provisioned — do not add new state to it.** `BLOB_READ_WRITE_TOKEN` is unset, so `useBlob` in `src/lib/blob-storage.ts` is always false and every helper silently falls back to `LOCAL_DATA`. On Vercel that is `/tmp/data`, which is **private to one serverless instance** — so each player reads and writes their own copy and nothing is actually shared. It fails silently, which is what made chat rolls look player-local.
- **Use `src/lib/redis-storage.ts` for anything shared.** It exposes the same `readJSON`/`writeJSON` signature as the blob helper (Upstash Redis in prod, `data/` in dev), so migrating a route is a one-line import swap. `character-storage.ts` and `api/board/route.ts` predate it and talk to Redis directly; `api/chat/route.ts` uses it.
- **Still on the dead blob path:** `api/notes`, `api/notes/[id]`, `api/effects`, `api/admin/effects`, `api/characters/assignments`, `api/admin/locations`, `api/admin/assets`. These have the same cross-player desync bug as chat did and should be migrated to `redis-storage`.
- **Campaign export:** `POST /api/campaign/export` generates a full Markdown document of the current campaign state including all characters, locations, briefings, and session journal — useful for AI GM tools.

---

# Echoes of Darkness — Campaign Reference

> *For use with AI GM tools, session zero materials, and ongoing campaign context.*

---

## Campaign Overview

**System:** Call of Cthulhu (7th Edition custom ruleset)
**Setting:** 1920s New England — Arkham, Boston, Providence, Innsmouth
**Code Name:** Project Deep Bedrock
**Status:** Ongoing

Seven investigators have been recruited by an anonymous benefactor (represented by legal counsel Arthur Butler) to locate and unseal a pre-human subterranean chamber that has resisted 17 years of excavation. Each investigator has agreed for their own private reasons. Each carries a dark secret tied to the tomb's ancient bloodline.

**Primary Objective:** Locate the sealed pre-human chamber and deliver its primary contents to the benefactor's couriers — undisclosed in nature.

**Secondary Objective (per investigator):** Each has a personal "Tomb Ambition" they expect to fulfil on completion.

**Timeline:** One year. Astronomical alignments are shifting and the window is narrowing.

**Exposure Protocol:** Any federal or law enforcement attention triggers immediate severance — all logistical support withdrawn, identities dissolved, investigators abandoned. The benefactor does not bail out liabilities.

---

## Factions & Key NPCs

### Arthur Butler — Legal Representative
The public face of the anonymous benefactor. Immaculately dressed, emotionless, and precise. Delivers mission briefings and manages the logistical framework. Never reveals the identity of his employer. Will not negotiate terms once agreed upon.

### The Anonymous Benefactor
Unknown identity. Has bankrolled a 17-year excavation with no public record. Has access to black-budget military hardware and government channels. Their true objective within the chamber is unknown to the investigators.

### The Donato Crime Syndicate
A powerful organized crime family operating across Boston and Providence. Currently extorting Silas Vance for 40% of his income. Has an enforcer network that can appear as random encounters. A faction member has cut a secret deal with Silas — kill the boss, form a partnership, split whatever Silas finds in the tomb.

### Dr. Henry Armitage — Head Librarian, Orne Library
Keeper of Miskatonic University's restricted occult archives. Witnessed the Wilbur Whatley incident firsthand and has kept the *Necronomicon* under personal seal ever since. Will grant special access to restricted texts under his direct observation. Shaken, paranoid, but duty-bound.

### The Chief Attendant — Bellevue Psychiatric Isolation Ward
Runs the secure isolation ward with unsettling calm. Protective of patient records. Knows more than he lets on. "I think you will like it here." — delivered without irony.

### Obed Marsh (Historical) / The Last Marsh Descendant
Obed Marsh founded the Esoteric Order of Dagon in Innsmouth and brokered deals with the Deep Ones for fish and gold in exchange for interbreeding. The original Winthrop fortune was seeded through Marsh gold. The last surviving Marsh descendant's location is unknown — finding them is a critical intelligence objective.

### The Great Race of Yith
An ancient race capable of displacing minds across time. Responsible for Thomas Callahan's amnesia via a mind-swap experiment during the 1918 Meuse-Argonne offensive. Their connection to the tomb is unconfirmed but suspected.

---

## Campaign Locations

### Miskatonic University & Orne Library
*Arkham, Massachusetts*

A prestigious Massachusetts university housing one of the world's most extensive collections of arcane texts in its restricted Orne Library. The site of the Wilbur Whatley incident. Dr. Henry Armitage is head librarian and controls access to the sealed restricted section where the *Necronomicon* is held. The university's biology and archaeology departments have records of pre-human specimen analyses. Key research hub for decoding glyphs and artefacts retrieved from the excavation.

**Notable:** The *Necronomicon* is physically present but sealed — Armitage will only permit supervised reading sessions. Whatley attempted to steal it and was killed by Armitage's dog in the process.

### Bellevue Psychiatric Isolation Ward
*Manhattan, New York*

Manhattan's most secure psychiatric isolation facility. Patients who have experienced encounters with the Mythos — or whose behaviour has become inexplicably dangerous or inhuman — are quietly referred here by connected parties. Patient records are strictly confidential. The Chief Attendant has an unnerving air of foreknowledge. At least one patient is believed to have encountered the tomb or its contents before being committed.

### Underworld Abattoir & Speakeasy
*Providence, Rhode Island*

A Providence speakeasy concealing a hidden slaughterhouse below street level used for purposes beyond meat processing. Hub of the city's criminal underworld. Connected to the Donato crime syndicate. The Speakeasy above is a functioning establishment — jazz, bootleg liquor, private rooms. Below is where interrogations, body disposal, and occult transactions take place. The syndicate's enforcers operate from here.

### The Black Archives
*Boston Harbour, Massachusetts*

A decommissioned municipal cold storage warehouse in Boston Harbour repurposed by the benefactor as a research facility. Contains a curated collection of pre-human artefacts gathered over decades of covert acquisition — stone tablets, metal alloy objects of unknown origin, partial manuscripts in non-human scripts, and items that affect the psychological state of those who handle them.

**Notable:** Every artefact in the Black Archive exacts a toll — psychological, physiological, or existential. The benefactor provides access but offers no guarantee of sanity. Items include materials that correspond to R'lyehian architectural notation and Elder Thing anatomical taxonomy.

### Federal Quarantine Docks
*Boston Harbour, Massachusetts*

A federal quarantine facility ostensibly maintained for disease control and inspection of incoming maritime cargo. In practice it is used to detain and process individuals displaying unusual physiological traits — suspected Deep One hybrids, individuals showing accelerated mutation from Innsmouth exposure, and persons of interest in classified federal investigations. Access requires either federal clearance or creative infiltration.

---

## Campaign Scenes (VTT Map Positions)

| Scene | Location | Map X | Map Y |
|---|---|---|---|
| Miskatonic | Miskatonic University & Orne Library | 47% | 22% |
| Bellevue | Bellevue Psychiatric Isolation Ward | 14% | 67% |
| Abattoir | Underworld Abattoir & Speakeasy | 49% | 52% |
| Black Archives | Black Archives | 65% | 47% |
| Fed. Docks | Federal Quarantine Docks | 70% | 18% |

---

## Mission Intelligence (Briefings)

### Arthur Butler — Mission Briefing
*CONFIDENTIAL — Legal Representative of an unnamed benefactor*

**Part 1:**
> My name is Arthur Butler and I am the legal representative of a benefactor who shall be unnamed. You have all been summoned here to continue an excavation that was started 17 years ago. My benefactor has spent a substantial amount of resources to find a subterranean chamber that for better or for worse — contains an object that is of importance to them. Alas, we have not made enough progress to even locate this chamber. You will all be given one year to locate this chamber. You will be provided with adequate resources to help you on your quest, but please be warned. This is an operation that is not allowed to have any eyes apart from yours. If this gains unnecessary visibility, we will pull all of our support and resources. You all have agreed to join this mission for your individual motives and my benefactor will fulfill all of them on completion.

**Part 2 — Project Deep Bedrock:**
> We operate under the code name Project Deep Bedrock. You will find that my benefactors' resources are extensive, but they are not infinite, nor are they without rigorous control. To facilitate your progress, we have established a sophisticated logistical framework. Depending on the complexity of your requirements, we can provide anything from standard heavy excavation equipment to sensitive, black budget military hardware. However, understand this. Every item requisitioned increases the noise this mission creates. We monitor this exposure with clinical precision. Should your activities draw the attention of federal task forces or local authorities, do not expect bail or legal intervention. We will trigger our standard severance protocol — liquidating all assets, dissolving your contacts and removing any trace of your existence. You are on your own the moment you become a liability.

**Part 3 — The Black Archive:**
> For your research, you will be granted access to the Black Archive, located within a decommissioned municipal cold storage warehouse in Boston Harbour. It contains a collection of artefacts curated over decades. Use them to decode the pre-human glyphs and structural enigmas you will undoubtedly face. I must warn you, these items are not merely academic curiosities. They exact a toll — psychological, physiological and perhaps existential. We provide the tools, but we do not guarantee your sanity in their handling.

**Part 4 — Final Directive:**
> You have one year. The astronomical alignments are shifting and our window of opportunity is narrow. We have provided you with the necessary data to begin your sifting process in Boston. Do not look for us. Do not seek to identify my benefactor. Focus on the tomb and ensure that when it is unsealed, the primary objective is delivered to our couriers without incident. Everything else you find within — the relics, the gold, the artefacts — is yours to claim. That is the agreement. Good day. We will be in touch when the first drop is ready.

---

### A Warning from the Docks
*WITNESS ACCOUNT — Anonymous · Innsmouth Harbour*

> I used to live in this fishing town called Innsmouth near Newburyport. I never thought that the town could get any weirder till this guy showed up asking questions about the town's history. Apparently he had access to information that wasn't made public and he wanted to learn more. That poor bastard. He was asking too many questions and in this town, everyone knows that'll get ya in deep trouble. The last I heard of him was that he went insane and drowned himself in the waters of Innsmouth, but I know that's complete horseshit. There's something down there. Something that was calling him and he answered the call.

> I'm probably not going to be here tomorrow when I tell you what I'm about to tell you, but if that means bringing some peace to that poor soul, so be it. The name 'Obed Marsh' would probably ring a bell. He's the primary reason why this town survived a 100 years longer than it should've. You need to find the last remaining family member of the Marsh family. That will get you closer to what you were asking about — a lot closer. All I know is that the Marshes abandoned Innsmouth a long time back. God knows where they live now.

---

### A Business Arrangement
*INTERCEPTED — Unknown Subject · Surveillance Recording*

> The guy you're looking for goes by the name 'Amazo the Amazing'. I know. Stupid name right? Anyway, he's built a reputation as the primary magic act in these parts, but the guy — he's really ambitious. So he asks my old man for a loan. However, in return the old man doesn't ask him for the money back. He instead gets him to give away his secrets. Shrewd bastard. Now he knows everything about this guy's secrets and is blackmailing him for a larger cut of the profits.

> Yeah. My father has been behind that guy for a couple of years now. He knows he's a fraud, but he's also quite useful. He's not stupid, that one. He knows things — things that could very well be helpful for both of us. So we made a deal — I take the old man out of the equation and he and I form… a business partnership. Whatever he finds in that tomb is gonna make him very famous and me very rich.

*Note: "Amazo the Amazing" is the stage name of Silas "The Great" Vance. This recording reveals a faction member has made a deal to neutralize the Donato patriarch in exchange for a cut of the tomb's discoveries.*

---

### Dr. Henry Armitage — Miskatonic University
*RESTRICTED ACCESS — Dr. Henry Armitage · Head Librarian, Orne Library*

> There was an incident several years back — one that I would rather like to forget, but circumstances beyond my control have forced me to retain memories of that ghastly night. His name was Wilbur Whatley. The smell. That wretched smell drove my dog insane to the point where it broke loose and tore his flesh apart. I'm not at liberty to divulge what we saw when we discovered his lifeless body, but I can tell you right now — he was trying to steal our copy of that 'unspeakable' book. Because of that day, the book is sealed within our archives and only can be seen with special permission under my observation.

---

### The Chief Attendant — Bellevue
*FACILITY CONTACT — Chief Attendant, Bellevue Psychiatric Isolation Ward*

> Hello. I'm the chief attendant at this……magical place. I was told about your arrival. I would be happy to help, but please keep in mind that our patient records are strictly confidential unless they have been approved to be released by the patient themselves or a family member. I think you will like it here.

---

### Sgt. Erryn Miles — The Black Archives
*LOGISTICS CONTACT — Sgt. Erryn Miles · Logistics Officer, Black Archives*

> Good afternoon. My name is Sergeant Erryn Miles. I have been tasked by our common benefactor to aid you in the excavation. At any specific point during your mission, if you require access to military resources, you will come to me directly. I and only I will have final say on what your team receives.

*Note: Miles is the gatekeeper for every requisition under Project Deep Bedrock — from standard excavation equipment to black-budget military hardware. Every approval she grants adds to the mission's Exposure.*

---

## Investigator Roster

### Dr. Alistair Finch — The Disgraced Mortician
**Age:** 42 | **Gender:** Male
**Cover:** City Morgue Contract Embalmer at Arkham Sanitarium
**Former Status:** Senior Chief of Surgery, Danvers State Hospital

**Vitals:** HP 12 | Willpower 15 | SAN 45/78 | Buffered SAN 0/12 | Resonance 35% | Luck 50

**Characteristics:** STR 50 | CON 65 | SIZ 55 | DEX 75 | APP 40 | INT 85 | POW 75 | EDU 85

**Skills:**
- Forensics / Autopsy 80% — Master level identification of tissue damage, biological anomalies, toxic exposure
- Medicine & Surgery 75% — Field stabilizing, wound suture, precise anatomical dissection
- Biology / Abnormal Zoology 70% — Comparative alien anatomy, organ classification, taxonomy
- First Aid 70% — Rapid tourniquet application, hemorrhage control
- Spot Hidden 65% — Microscopic incision traces, structural fractures, concealed biological markers
- Stealth 55% — Evading municipal inspectors and federal tail teams
- Intimidation 50% — Morbid clinical detachment, unblinking mortuary demeanor

**Class Abilities:**
- **Macabre Anatomy** *(Active)* — Upon observing an entity or mutated specimen for 1 full turn, Finch can make an INT/Biology check to pinpoint anatomical vulnerabilities, granting all allies +20% to hit vital weak spots or bypass 2 points of natural armor.
- **Morgue Sanctuary** *(Utility)* — Unfettered access to municipal mortuary coolers, embalming chemicals, and cadaver records. Can forge autopsy certificates or conceal contraband evidence within transit caskets.
- **Buffered Dissection** *(Buffered Sanity)* — When dissecting cosmic entities, sanity damage is banked into the Exposed Negative pool. Full psychic recoil triggers only when the surgical session concludes and specimens are fixed.

**Narrative Hooks & Flaws:**
- **Watched by the State** — Government agents monitor his movements. Rolling 95–00 on any clandestine check introduces a federal investigation agent or detective tail.
- **Tomb Ambition** — To recover an uncorrupted, mummified pre-human entity (Elder Thing / Mi-Go tissue) to validate his life's work and master non-terrestrial physiology.
- **Ancestral Secret** — Finch's bloodline was genetically altered by early necromantic experiments (connected to the salts of Charles Dexter Ward), explaining why preserved specimens never fully rot in his presence.

**Equipment:** Master surgeon's dissection kit, heavy rubber apron, 3 glass jars of formaldehyde-saline concentrate, scalpel holster, mortuary bypass credentials.

---

### Silas "The Great" Vance — The Blackmailed Illusionist
**Age:** 36 | **Gender:** Male
**Cover:** Vaudeville Escape Artist & Illusionist (stage name: "Amazo the Amazing")
**Former Status:** Sergeant, Corps of Royal Engineers / Special Infiltration Scout

**Vitals:** HP 11 | Willpower 14 | SAN 55/82 | Buffered SAN 0/10 | Resonance 40% | Luck 65

**Characteristics:** STR 55 | CON 60 | SIZ 50 | DEX 85 | APP 70 | INT 75 | POW 70 | EDU 65

**Skills:**
- Sleight of Hand 85% — Concealing items, pickpocketing, palming keys and lock triggers
- Locksmith / Mechanical Infiltration 75% — Bypassing mechanical tumblers, pressure pad locks, vault pins
- Stealth 70% — Silent movement, camouflage, trench creeping
- Fast Talk / Misdirection 65% — Audience manipulation, psychological redirection
- Hand-to-Hand Combat (Brawl/Cane) 60% — Close-quarters disarming, weighted cane strikes
- Occult Lore (Stage Counterfeiting) 50% — Distinguishing genuine occult symbols from parlor tricks

**Class Abilities:**
- **Smoke & Mirrors** *(Active)* — Silas can ignite a custom magnesium-phosphorus flash pellet as a reaction. All hostile entities in close range must make a CON check or be blinded for 1 round, allowing immediate disengage without penalty.
- **Trench Breacher** *(Passive)* — Bonus dice when picking non-electronic locks, bypassing tripwires, or disarming mechanical dungeon traps.
- **Mirrored Deflection** *(Buffered Sanity)* — Silas can treat impossible manifestations as elaborate optical illusions, transferring up to 10 SAN damage to his buffer.

**Narrative Hooks & Flaws:**
- **The Syndicate's Leash** — The Donato crime syndicate extorts 40% of his income and sends enforcers to track his movements. The Keeper may spawn debt-collector ambushes.
- **Tomb Ambition** — To discover genuine pre-human grimoires or true incantation formulas that grant undeniable occult power, allowing him to destroy his extortionists.
- **Ancestral Secret** — His stage patterns and hypnotic mirrors match the geometric summoning lattices of an ancient cult of Yog-Sothoth.

**Equipment:** Concealed brass lockpick kit, 4 smoke/flash pellets, weighted defense cane (1d6 damage), silk flash-cloth, marked syndicate debt note.

---

### Julian Sterling — The Desperate Auteur
**Age:** 31 | **Gender:** Male
**Cover:** Freelance Newsreel Cameraman & Documentarian
**Former Status:** Blacklisted Indie Filmmaker

**Vitals:** HP 10 | Willpower 13 | SAN 50/80 | Buffered SAN 0/15 | Resonance 25% | Luck 55

**Characteristics:** STR 45 | CON 55 | SIZ 45 | DEX 70 | APP 65 | INT 80 | POW 65 | EDU 75

**Skills:**
- Cinematography / Photography 85% — Framing, exposure calibration, chemical developing, high-speed filming
- Spot Hidden 75% — Noticing background anomalies, movement in shadows, lens aberrations
- Art (Directing / Storyboarding) 70% — Visual composition, pacing, narrative framing
- Mechanical Repair (Optics) 65% — Rebuilding camera shutters, lens grinding, fixing jammed gears
- Persuasion 60% — Coaxing reluctant witnesses to speak before the lens
- History (Cultural Mythos) 50% — Recognizing legendary motifs on physical monuments

**Class Abilities:**
- **The Viewfinder Shield** *(Buffered Sanity)* — Julian can bank up to 15 SAN loss while viewing entities through his optical viewfinder. The full psychic cost strikes when he develops the nitrate reels in the darkroom.
- **The Cutting Room Floor** *(Active)* — When developing film of an encounter, Julian makes an Art/Photography check to uncover hidden runes, cloaked predators, or inscriptions completely invisible to the naked human eye during combat.
- **Magnesium Flash Gun** *(Utility)* — Can detonate a high-potency magnesium dish, illuminating pitch-dark vaults (100-foot radius) and blinding light-sensitive subterranean horrors for 1 turn.

**Narrative Hooks & Flaws:**
- **"Keep the Camera Rolling!"** — Julian must pass a Willpower test to flee active danger. On failure, he remains stationary to film the catastrophe.
- **Tomb Ambition** — To record undisputed, high-definition 35mm footage of an active extraterrestrial biological entity or cyclopean chamber to secure an undisputed Hollywood distribution deal.
- **Ancestral Secret** — His rejected avant-garde scripts contain precise phonetic transcriptions of R'lyehian chants and architectural floorplans.

**Equipment:** Hand-cranked 35mm Bell & Howell Eyemo camera, wooden tripod, 4 raw nitrate film rolls, magnesium powder dish, chemical developing kit.

---

### Thomas "Mack" Callahan — The Amnesiac Detective
**Age:** 38 | **Gender:** Male
**Cover:** Licensed Private Investigator (Boston/Arkham)
**Former Status:** 26th Infantry Division, AEF (Service Record Redacted)

**Vitals:** HP 14 | Willpower 13 | SAN 40/75 | Buffered SAN 0/8 | Resonance 50% | Luck 45

**Characteristics:** STR 75 | CON 70 | SIZ 70 | DEX 65 | APP 45 | INT 70 | POW 65 | EDU 60

**Skills:**
- Firearms (Handgun & Trench Gun) 80% — Rapid fire, defensive shooting in pitch darkness
- Hand-to-Hand Combat (Brawl/Trench Knife) 75% — Lethal martial counters, grappling
- Intimidation 70% — Interrogation, aggressive psychological dominance
- Spot Hidden 70% — Trench scouting, identifying concealed snipers or stalkers
- Streetwise / Underworld Networks 65% — Informant cultivation, locating safehouses
- Track / Shadowing 60% — Urban surveillance, tracking trail markings through rubble

**Class Abilities:**
- **Trench Reflexes** *(Passive)* — When ambushed, surprised, or attacked by cloaked entities, Mack can take 1 immediate combat or defensive action before initiative order is determined.
- **Alien Intuition (Yithian Fragment)** *(Active)* — Once per session, Mack can channel an involuntary combat flash, instantly mastering a non-human weapon or deciphering alien controls. Doing so permanently replaces one mundane memory on his sheet.
- **Hardened Survivor** *(Passive)* — Takes 1 less point of physical damage from all non-magical blunt force or ballistic attacks.

**Narrative Hooks & Flaws:**
- **Combat Dissociation** — Sudden concussive explosions or heavy subterranean tremors require an immediate Willpower test. Failure triggers a 2-round dissociative flashback (–20% to all action rolls).
- **Tomb Ambition** — To recover redacted military-intelligence files or ancient archives within the vault proving his true name, identity, and the fate of his vanished platoon.
- **Ancestral Secret** — Mack's amnesia was caused by a Great Race of Yith mind-swap experiment conducted during the 1918 Meuse-Argonne offensive. He is living in a body that is not originally his.

**Equipment:** Colt M1911 .45 ACP pistol (3 spare magazines), trench knife with brass knuckle grip, PI badge, worn trench coat, scarred silver lighter with unknown initials.

---

### Richard Pickman Graves — The Macabre Visionary
**Age:** 34 | **Gender:** Male
**Cover:** Commercial Illustrator & Pulp Cover Artist
**Former Status:** Expelled Fine Arts Prodigy, Boston Guild

**Vitals:** HP 9 | Willpower 16 | SAN 35/72 | Buffered SAN 0/14 | Resonance 60% | Luck 50

**Characteristics:** STR 40 | CON 45 | SIZ 45 | DEX 80 | APP 50 | INT 85 | POW 80 | EDU 70

**Skills:**
- Art (Painting & Anatomical Drawing) 90% — Master draftsmanship, hyper-realistic macabre rendering
- Spot Hidden 75% — Recognizing subtle environmental mutations, concealed tunnel grates
- Occult 70% — Subterranean lore, ghoul glyphs, necromantic symbology
- Appraise 65% — Dating pre-human antiquities and eldritch sculptures
- Disguise / Pigment Alteration 60% — Using stage wax and charcoal to mimic corpse paleness
- Stealth 55% — Slipping into forgotten graveyards and cellar passages

**Class Abilities:**
- **Prophetic Canvas** *(Active)* — Spending 10 minutes sketching a location or relic reveals one concealed structural secret, ancient trap mechanism, or entity weak point via subconscious ancestral vision.
- **Ghoul Sight** *(Passive)* — Richard can see through non-magical darkness up to 40 feet with distinct clarity, perceiving heat and organic decay signatures.
- **Clairvoyant Mapping** *(Resonance Check)* — When lost underground, can make a Resonance check to automatically map the correct route toward deep burial vaults.

**Narrative Hooks & Flaws:**
- **Morbid Fascination** — When directly encountering a grotesque monstrosity, Richard must succeed on a Willpower roll to avert his eyes or take action. Failure forces him to stand and sketch the entity, suffering full sanity loss.
- **Tomb Ambition** — To view living or intact deep-earth entities in their native environment, finishing a master gallery piece that will force humanity to witness the true cosmos.
- **Ancestral Secret** — Richard is a direct descendant of the Boston ghoul-cult bloodline (tied to Richard Upton Pickman); his digestive tract is beginning to crave decayed matter.

**Equipment:** Heavy charcoal sketchbook, tin of pig-bristle brushes, oil paint tubes, palette knife, pocket sketchbook of cemetery vault cross-sections.

---

### Arthur Wright — The Non-Euclidean Architect
**Age:** 45 | **Gender:** Male
**Cover:** Independent Civil Surveyor & Demolition Consultant
**Former Status:** Chief Urban Draftsman, Boston Metropolitan Commission

**Vitals:** HP 12 | Willpower 14 | SAN 48/80 | Buffered SAN 0/10 | Resonance 45% | Luck 50

**Characteristics:** STR 55 | CON 65 | SIZ 60 | DEX 60 | APP 50 | INT 90 | POW 70 | EDU 85

**Skills:**
- Architecture & Engineering 85% — Structural integrity, vault stress calculations, ancient masonry analysis
- Science (Mathematics & Physics) 80% — Non-Euclidean vectors, gravitational stress models, spatial anomalies
- Demolitions & Mining Operations 70% — Placing dynamite charges, controlled collapses, bedrock breaching
- Navigate (Subterranean) 65% — Sub-surface orientation without compass or sunlight
- Spot Hidden 65% — Identifying micro-fractures in stone, hidden counterweights, keystone traps
- History (Pre-Human Monuments) 60% — Identifying architectural epochs of Elder Things and pre-cataclysmic civilizations

**Class Abilities:**
- **Structural Resonance** *(Active)* — Arthur can analyze cyclopean stone masonry for 1 round to detect load-bearing keystones, hidden counterweight doors, or imminent ceiling collapses, granting +30% to party survival actions.
- **Controlled Breacher** *(Utility)* — When using dynamite or heavy drills to open sealed vaults, reduces required explosive amounts by 50% and generates 0 excess Exposure Pool tokens.
- **Spatial Orientation** *(Passive)* — Immune to disorientation and vertigo caused by non-Euclidean angles or shifting gravity wells.

**Narrative Hooks & Flaws:**
- **Euclidean Sickness** — Arthur suffers intense claustrophobia and psychological agitation in ordinary, symmetrical right-angled modern buildings (–10% to all mental checks unless working on cyclopean plans).
- **Tomb Ambition** — To be the first modern engineer to enter an intact pre-human megalithic vault, confirm non-Euclidean structural mechanics, and publish the definitive mathematical treatise.
- **Ancestral Secret** — His lineage traces back to Sarnath and the builders of the sunken basalt spires of R'lyeh; he dreams in five-dimensional geometry.

**Equipment:** Solid brass drafting compass, surveyor's theodolite, 2 sticks of industrial mining dynamite, blasting caps with crimpers, roll of reinforced blueprint parchment.

---

### Percival Montgomery Winthrop — The Ruined Tycoon
**Age:** 48 | **Gender:** Male
**Cover:** Disgraced High-Society Speculator & Antiquities Broker
**Former Status:** Majority Shareholder, Winthrop Maritime Shipping Empire

**Vitals:** HP 11 | Willpower 15 | SAN 52/85 | Buffered SAN 0/8 | Resonance 30% | Luck 70

**Characteristics:** STR 50 | CON 55 | SIZ 60 | DEX 55 | APP 75 | INT 80 | POW 75 | EDU 85

**Skills:**
- Persuasion & High-Stakes Negotiation 85% — Securing contracts, settling disputes, closing backroom deals
- Appraise (Antiquities & Precious Metals) 80% — Instant valuation of gold alloys, pre-Columbian and occult relics
- Credit Rating / High Bureaucracy 75% — Navigating municipal registries, calling in elite Bostonian favors
- Psychology 70% — Reading motives, sensing desperation or deceit in officials and cultists
- Law (Maritime & Property) 65% — Bypassing export restrictions, establishing illegal salvage rights
- Fast Talk 60% — Smooth-talking guards, bluffing municipal inspectors

**Class Abilities:**
- **Silver Tongue** *(Active)* — Percival can reroll any failed social check (Persuasion, Fast Talk, Bureaucracy) when interacting with bankers, municipal authorities, or black-market antiquities fences.
- **Underworld Liquidation** *(Utility)* — Can convert recovered occult relics, pre-human jewelry, or tomb gold into cold hard cash or Black Line supplies in 24 hours without alerting federal authorities.
- **Elite Clearance** *(Passive)* — Grants access to private university boardrooms, members-only historical societies, and restricted government manifests.

**Narrative Hooks & Flaws:**
- **Miser's Desperation** — Percival must pass a Willpower test when presented with the opportunity to abandon valuable gold/relics during a crisis. Failure forces him to secure the treasure at great physical risk.
- **Tomb Ambition** — To claim vast quantities of pre-human gold bullion, esoteric metal alloys, or mineral deeds to re-establish his multi-million-dollar New England financial dynasty.
- **Ancestral Secret** — The original Winthrop shipping fortune was seeded by trade agreements with Innsmouth hybrids and gold smelted by the Esoteric Order of Dagon.

**Equipment:** Frayed Savile Row tailored suit, gold pocket watch with broken hands, leather ledger of bankrupt assets, pearl-handled .32 ACP pocket revolver, personal signet ring.

---

## Campaign Mechanics

| Mechanic | Range | Description |
|---|---|---|
| Sanity (SAN) | 0–99 (current/max) | Loss of 5+ in one turn induces temporary insanity |
| Buffered Sanity | 0–N stored pts | Horror deferred through professional instruments; triggers on session end |
| Ancestral Resonance | 0–100% | Genetic alignment with the tomb; failure triggers involuntary ritual actions |
| Willpower (MP) | 1–20 | Fuel for psychological resistance and class abilities |
| Luck Pool | 0–99 | Expendable to adjust rolls; high expenditure increases Resonance risks |

**Sanity Loss Thresholds:**
- Loss of 5+ SAN in a single moment → temporary insanity
- Loss of 20% of current SAN in a session → indefinite insanity
- SAN 0 → permanent insanity, investigator lost

**Ancestral Resonance Rules:**
- Resonance increases when investigators use class abilities tied to their bloodline, handle specific artefacts, or spend excessive Luck points underground
- Resonance at 75%+ triggers involuntary ritual actions during sleep phases
- Resonance at 100% triggers a full possession event — investigator acts as an agent of the tomb entity for one scene

**Exposure Protocol:**
- The benefactor monitors mission noise. High-profile federal attention triggers severance.
- Investigators can reduce Exposure by operating discreetly, avoiding witnesses, and limiting black-budget requisitions.

---

## Screen Effects (GM Tools)

The GM can trigger real-time visual effects on player screens via `/admin/experience`:

| Effect | Duration | Description |
|---|---|---|
| Sanity Slip | 7s | Screen blurs and warps with disorienting distortion |
| Darkness | 5s | Screen fades to impenetrable black |
| Blood Vision | 6s | Crimson vignette bleeds across the screen |
| Cosmic Static | 4s | Signal lost — noise interference takes over |
| Primal Horror | 3.5s | Violent screen shake with blinding flashes |
| Temporal Echo | 6s | Reality flickers with ghostly afterimages |
| Visions | 8s | A horrifying image flashes on screen for half a second |

Effects can be targeted at individual players or broadcast to all. Players must be on the VTT board (`/`) to receive them.

---

## Mythos Entities & Lore Connections

### Elder Things
Pre-human entities whose anatomical structure is the subject of Dr. Finch's obsession. Bipedal, barrel-bodied, with radial symmetry. Created life on Earth as a biological experiment. Their ruins form the basis of the cyclopean architecture Arthur Wright obsessively studies. At least one intact specimen is believed to be within the sealed tomb.

### The Great Race of Yith
A species that conquered time by projecting their minds into the bodies of other beings across eras. Thomas Callahan's amnesia stems from a Yith mind-swap — his original consciousness was displaced during the 1918 Meuse-Argonne offensive while his body was occupied. A Yith fragment remains in Callahan's neural architecture, surfacing as combat flashes and alien weapon intuition.

### Deep Ones / The Esoteric Order of Dagon
Aquatic humanoid entities that interbreed with coastal human populations in exchange for gold and fish. The Marsh family of Innsmouth brokered this arrangement under Obed Marsh. The Winthrop fortune was built on Dagon gold. Percival's bloodline carries hybrid markers.

### Ghouls (Boston Ghoul-Cult)
Subterranean humanoid scavengers with a strong connection to graveyards, tunnels, and the dead. Richard Pickman Graves is a direct descendant of the Boston ghoul-cult bloodline tied to Richard Upton Pickman. His body is beginning to biologically shift toward a ghoul physiology — most visibly in altered dietary cravings.

### Yog-Sothoth
The Gate and the Key — an Outer God that exists simultaneously across all of time and space. Silas Vance's ancestral hypnotic mirror patterns correspond to Yog-Sothoth summoning lattices. The Wilbur Whatley incident at Miskatonic was a Yog-Sothoth summoning attempt; Dr. Armitage's *Necronomicon* contains the counterspell used.

### R'lyeh
The sunken city of Cthulhu, dormant beneath the Pacific. Arthur Wright's ancestral bloodline traces to its original architects. His five-dimensional dreaming and immunity to non-Euclidean spatial distortion stem from this lineage. Julian Sterling's rejected film scripts contain phonetically accurate R'lyehian architectural notation — written in a fugue state he cannot explain.

---

## The Tomb — What Is Known

- 17 years of excavation have failed to locate the chamber entrance
- The tomb predates human civilization — it is pre-human in construction
- It is somewhere beneath the Boston/New England region
- The chamber is sealed — not merely blocked, but sealed by mechanisms that respond to bloodline Resonance
- The benefactor's "primary objective" within the chamber is unknown — referred to only as "the object"
- Everything else inside — gold, artefacts, relics — belongs to the investigators by agreement
- The astronomical window is closing; some alignment of celestial bodies affects access or the chamber's state
- Each investigator's ancestral bloodline is connected to the tomb in some way — this is not coincidence; they were recruited for their genetics as much as their skills
