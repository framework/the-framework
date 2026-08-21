Priority: 4
GitHub: [#1607](https://github.com/gemstack-land/the-framework/issues/1607)

# Cloud work adoption spawns git per head every pass, and the daemon clock stretches under slow jobs

## TLDR

Two observations from dogfooding #1603, neither blocking it:

1. **The adoption pass scales as runs × `claude/*` heads.** For every waiting web run, `descendsFrom` runs `cat-file -e` (plus a `fetch` when the object isn't local) and `merge-base --is-ancestor` against *every* `claude/*` head on origin — and nothing prunes those heads (the scratch sweep deletes `cloud-*` and `tf-agent-*` only). A run whose session never pushes is re-checked against all of them every pass for 48 h.
2. **The daemon clock merges ticks while a job is slow.** `startDaemonTick` counts a tick only when one actually runs, so an interval firing mid-tick joins it. Observed: the 20-tick adoption cadence became ~26 minutes (10:50:46 → 11:16:57) while a slow data sync failed every minute.

## Why it matters

An active repo accumulates dozens of `claude/*` heads within weeks, so the per-pass git spawn count grows without bound. And the clock issue is not adoption-specific: *every* `every: N` job stretches whenever any job is slow, so cadences silently stop meaning what they say.

## Fix directions

- Adoption: one `git fetch origin '+refs/heads/claude/*:refs/remotes/origin/claude/*'` per pass, then one `git for-each-ref --contains=` per run — which also answers the exactly-one question in a single call. The current fetch has no destination refspec, so objects land in `FETCH_HEAD` only and get re-fetched after gc.
- Same family: `listAgents` parses every archived record each pass to find the few web runs inside the window; the id is a timestamp, so the filename alone rejects the rest before any read.
- Clock: count wall-clock rather than executed ticks, or time-box the per-job turn.

Context: #1601. The pass lives in `src/cloud-work.ts`, the clock in `src/daemon-tick.ts`.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1607](https://github.com/gemstack-land/the-framework/issues/1607), created 2026-08-20, no labels, 0 comments.
