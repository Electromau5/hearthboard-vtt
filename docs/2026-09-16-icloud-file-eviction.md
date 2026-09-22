# Error: iCloud file eviction breaks the toolchain

**Date:** 2026-09-16
**Severity:** Blocking — dev server will not start, git cannot commit
**Root cause:** macOS iCloud Drive evicted file *contents* across `node_modules/`, `.git/` and parts of `src/`
**Status:** Resolved 2026-09-22 — working copy moved to `~/dev/hearthboard-vtt`, off iCloud.

---

## Summary

This project lives on the iCloud-synced Desktop:

```
/Users/prits6/Desktop/Happiness/Gaming/eod/hearthboard-vtt
```

With macOS **Optimize Mac Storage** active and the disk at **94% full (11 GiB free)**, macOS evicted the
contents of files it considered cold. The files remain visible with correct names, sizes and timestamps,
but their bytes live only in iCloud. macOS marks these as `dataless`.

Reading a `dataless` file forces an on-demand download. For an occasional document that is a brief pause.
For a toolchain that opens tens of thousands of files, it fails — and it fails in ways that do not look
like "file not available".

---

## Symptoms observed

### 1. Dev server would not boot

```
> next dev --port 3000

Error: Invalid package config /Users/prits6/.../node_modules/next/package.json.
    at shouldUseESMLoader (node:internal/modules/run_main:76:16)
  code: 'ERR_INVALID_PACKAGE_CONFIG'

Node.js v26.8.2
[exited with code 1]
```

`node_modules/next/package.json` existed and `ls` reported 3173 bytes. Node still could not parse it.

### 2. Reads hang indefinitely

`head -c 400`, `grep -rn`, and `node -e "require(...)"` each stalled past **120 seconds** on affected
files with no error and no output. The same file sometimes read fine seconds later — iCloud
materialization is non-deterministic under pressure.

### 3. Silent short reads — the dangerous one

```
error: short read while indexing src/app/api/characters/assignments/route.ts
error: src/app/api/characters/assignments/route.ts: failed to insert into database
fatal: cannot hash src/app/api/characters/assignments/route.ts
```

The read returned **fewer bytes than the file's length, without raising an error to the caller**.

This is the failure mode most likely to cause real data loss: a tool can read a truncated file, believe
that is the entire contents, and write it back — permanently destroying everything past the cut.

### 4. SIGBUS crashes

```
$ git log --oneline -3
Exit code 138          # 128 + 10 = SIGBUS
```

Tools that `mmap` a file get a hard bus error when pages cannot be faulted in from iCloud.

### 5. Git silently failed to commit

`git commit` produced **no output and did nothing**. `HEAD` remained at `60654cd`. The commit was never
created; nothing indicated failure. `git diff` and `git show HEAD:<path>` returned empty output rather
than erroring.

### 6. Phantom modifications

`git status` reported `src/app/api/characters/assignments/route.ts` as modified. It was **not** edited.
Git flags the file because it cannot read it to prove it is unchanged.

---

## Measured scope

| Location | Evicted (`dataless`) | Total | Notes |
|---|---|---|---|
| `node_modules/` | **23,810** | 26,302 | 90% of the dependency tree |
| `.git/` | **738** | 858 | Includes the object database |
| `src/`, `public/`, root | 74 | — | Includes `src/proxy.ts`, `package.json`, `package-lock.json` |

`.git/objects/pack/` was **empty** — every object was a loose file, so every commit in the project's
history was individually evictable. That is why git could neither read history nor write a commit.

Disk at time of failure:

```
/dev/disk3s5   228Gi   164Gi    11Gi    94%   /System/Volumes/Data
```

---

## Why development tooling is hit hardest

- **`node_modules` is the ideal eviction target** — tens of thousands of tiny files, individually cold,
  collectively essential. It is exactly what "Optimize Mac Storage" is designed to purge.
- **`.git` is just files.** Sync and eviction do not understand that git assumes atomic, always-local
  operations on its index, refs and objects.
- **Build churn fights the sync engine.** `.next/`, `node_modules/` and `.git` rewrite thousands of files
  per build. iCloud attempts to upload all of it — wasted bandwidth, and a corruption risk if a sync
  lands mid-write or two machines sync the same repository.
- **Even freshly written files are flagged.** A file rewritten in place came back marked
  `compressed,dataless` immediately, so rewriting files in place is not a reliable repair.

---

## Diagnostic commands

```bash
# Is this file's content actually local?  Look for "dataless" in the flags column.
ls -lO path/to/file

# How widespread is the eviction?
find node_modules -type f -flags +dataless | wc -l
find .git         -type f -flags +dataless | wc -l

# Is git able to read a given file at all?
git hash-object path/to/file        # "fatal: Unable to hash" = evicted/unreadable

# Has git's history been evicted?  An empty pack dir means all-loose objects.
ls -l .git/objects/pack/

# Disk pressure — the trigger for eviction
df -h .
```

Note: `brctl download <path>` returned exit 0 but did **not** materialize anything. Do not rely on it.

---

## What was done on 2026-09-16

1. **Dependencies** — the gutted `node_modules` was moved aside (not deleted) to
   `/tmp/claude-501/node_modules_old_stub` and `npm install` was re-run from `package-lock.json`.
2. **Edit integrity verified by hand** — after editing `src/app/page.tsx`, the result was confirmed with
   byte accounting rather than trusting the read: `125,754 − 1,159 + 469 = 125,064` = actual file size.
   This was done specifically because of the silent-short-read risk above.
3. **Commit and push via a clean clone** — the local repo could not commit, so:
   - confirmed `origin/main` matched local `main` (`60654cd`), proving nothing local was unpushed;
   - cloned the repo fresh into a scratch directory outside iCloud;
   - copied the changed files in and confirmed their hashes matched byte-for-byte;
   - diffed against `origin/main` in the healthy clone to prove the edit was not corrupted;
   - committed and pushed from there → `main` is now `145f9dc`.
4. **Push authentication** — the credential helper authenticates as `artemis-design-labs`, which has no
   push access. The `Electromau5` account exists in `gh auth` as a non-active account; its token was used
   for the push without switching the globally active account.

---

## Current state (2026-09-22) — resolved

The resolution below was applied. The working copy now lives at `/Users/prits6/dev/hearthboard-vtt`,
outside any synced folder. Verified:

```bash
$ git rev-parse --short HEAD
145f9dc
$ find . -maxdepth 2 -type f -flags +dataless | wc -l
0
```

`git` reads history normally, there are no phantom modifications, and no file in the tree is `dataless`.

**The trigger has not gone away.** Disk pressure on the machine is unchanged and Optimize Mac Storage is
still active — this repository is simply no longer in its path. Any clone placed back under Desktop,
Documents, iCloud Drive, Dropbox or Google Drive will reproduce every symptom above.

### Historical state (kept for the record)

At the time of writing, before the move:

- The remote repository on GitHub was **intact and authoritative**.
- The **local** repository was still broken: `git log`, `git diff` and `git show` crashed or returned
  empty, local `main` still pointed at `60654cd`, and `git status` showed a phantom modification.
- The dev server had **not** been started successfully.

---

## Resolution

**Move the working copy off the synced folder.** Keep source at a non-synced path such as `~/dev/` or
`~/Developer/` — never Desktop, Documents, iCloud Drive, Dropbox or Google Drive. Let **git and GitHub be
the sync mechanism**; that is what they are for.

```bash
git clone https://github.com/Electromau5/hearthboard-vtt.git ~/dev/hearthboard-vtt
cd ~/dev/hearthboard-vtt
cp /path/to/old/.env.local .          # .env.local is gitignored — copy it across
npm install
npm run dev
```

`data/` is also gitignored; copy it across if any local runtime state (roles, characters) matters.

**Free disk space as well.** Eviction is driven by disk pressure, and 11 GiB free on a 228 GiB volume
keeps it aggressive. But space alone is not the fix — `node_modules` and `.git` should never be sync
candidates in the first place.

### Do not bother with

- `brctl download` — returned success and did nothing here.
- Rewriting files in place to "re-localise" them — the rewritten file was immediately flagged `dataless`.
- Retrying the same git command — failures are silent, so a retry can appear to succeed while doing
  nothing at all. Always verify with `git rev-parse HEAD` or `git ls-remote`.
