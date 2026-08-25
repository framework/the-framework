# Bug analysis: packages/framework/src/dashboard/activity.test.ts

## Business logic (high-level)

Pins `buildActivity` and `activityKey` against `activity.test.SPEC.md`'s list: state mapping
(running→started, terminal→finished with status), one item per run, newest-first order, the
20-per-project cap, the #1623 whole/skip distinction, and the distinct start/finish identities.
All through the injected `readAgents` seam — no disk, fully deterministic.

Do the tests verify what they claim?

- "maps a running run to started and a terminal run to finished" — two projects, distinct
  `updatedAt`s; asserts the projected tuple list including order (a: 03:00 before b: 01:00), title
  passthrough, and that `status` is absent on `started`. Falsifiable on mapping, ordering and
  field placement at once. Sound.
- "carries the terminal status" — `stopped` arrives as `finished`/`stopped`. Sound.
- "one item per run across a project history" — live + old archived both itemized, in input order
  (same-project items keep relative order because updatedAt differs). Sound.
- "caps each project to the most recent runs" — 30 rows in, asserts exactly 20 out. Pins the
  constant's effect (not its value by name — a deliberate cap change would rightly update this).
  Note it feeds rows already newest-last (`00:00`..`00:29` minutes ascending) and asserts only the
  count, not *which* 20 survive — the cap takes the first 20 of the given order, which for the
  production reader (newest-first) is the most recent; with this fixture's ascending order the
  kept rows are actually the oldest. So "most recent" is pinned only via the reader's contract,
  not this fixture. Minor looseness, not a wrong assertion.
- "skips a project whose run read throws, and does not call it read (#1623)" — asserts both
  `items` and `whole` exclude the throwing project and include the healthy one. Exactly the
  invariant. Sound.
- "calls a project read when it has no runs at all (#1623)" — `[]` read → `whole` includes it.
  Sound.
- "activityKey separates a run start from its finish" — pins the literal key format
  (`started:a:r1`) — appropriate, since the key is a persisted identity notifiers dedupe on and a
  drifted format double-announces. Sound.

## Functions (low-level)

- `project(id, path)` / `agent(over)` — minimal fixture factories; `agent` defaults to a running
  row with matching start/update stamps. Fine.
- Seven `test()` blocks as above; every assertion falsifiable; no unawaited async (all awaits
  present; `activityKey` test is sync).

## Bugs found

None found.
