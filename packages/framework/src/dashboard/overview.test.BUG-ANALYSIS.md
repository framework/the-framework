# Bug analysis: packages/framework/src/dashboard/overview.test.ts

## Business logic (high-level)

Covers the Overview rollups per its test SPEC: only running agents surface, most-recently-updated first; queue totals summed; recents newest-first capped at 5 and activity-less projects omitted; recent agents pooled newest-first, tagged, tolerant of unreadable projects, and deduped across shared archives (#1648); the ticket lanes and their precedence (#1139/#1117) including the 10-0 priority scale with word spellings rejected; hot tickets pooled, lane-ordered, dropped when laneless, implementing carrying the agent id, finished agents not implementing, per-project ticket matching; per-project ticket lists in registry order, kept when empty or unreadable; #1668 web runs (in-cloud/waiting listed with project-path cwd; PR'd/stale/stopped not; shared archive deduped); #1648 host attribution (only foreign hosts named).

All via injected deps; assertions are concrete `deepEqual`s that can fail. The #1668 test's fixture covers all five cloud states through `cloudRunState` for real (fixed `now`), which is good cross-module verification.

## Functions (low-level)

- **`project`/`meta`/`agent`/`ticket`/`runOn`/`web` fixtures** — minimal, cast where the full `AgentMeta` shape is not needed (`as never`/`as AgentMeta`); risks nothing since the code reads only the asserted fields.
- **"surfaces only running runs"** — three projects, done one excluded, order `['c','a']` by updatedAt. Correct.
- **"sums the open queue and lists recent projects"** — 7 projects, 2 queues (open 3+2=5), recents `p6..p2`. Correct.
- **"omits projects with no activity"** — asserts `['b']`. Correct.
- **"buildRecentAgents pools…"/"tolerates…"/"lists a run once (#1648)"** — order, forgiveness, and shared-archive dedupe (`alpha` wins as first lister). Correct.
- **`ticketBucket` tests** — precedence matrix including queued-vs-priority and planned-vs-queued; the priority-scale loop asserts 10..7 high, 6..0 not, words not. Correct.
- **"buildHotTickets pools… orders lane-first"** — includes a link-with-note queue entry (`[b one](tickets/b1.md) — a note`) proving the leading-link rule, and the laneless drop. Correct.
- **"marks the ticket a live run is implementing (#1117)"** — asserts bucket + agentId and the laneless drop of the other ticket. Correct.
- **"ignores a finished run and another project's ticket"** — finished run's ticket falls back to ai-queue with no agentId; identical ticket filename in two projects only lights up in the implementing project. Correct.
- **"lists a web run whose cloud side is still at work (#1668)"** — asserts exactly `working` (in-cloud) and `parked` (waiting), keyed to `/a` (first of the two shared-archive projects), excluding PR'd/stale/stopped. Correct.
- **"names the machine that started a run (#1648)"** — `host` present only for the foreign host. Correct.

Coverage notes (not bugs): the 30-row cap of `buildRecentAgents` and the 60 cap of `buildHotTickets` are unasserted; `buildOverview`'s default `waiting`/`agents` wiring (bridge store, readAllAgents) is untested here — acceptable unit boundaries.

## Bugs found

None found.
