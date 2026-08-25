# Bug analysis: packages/framework/src/dashboard/bridge-sessions.ts

## Business logic (high-level)

Picks which claude.ai pages the browser bridge's Chrome extension should keep a tab open on (#1237).
A tab is the *only* way a question a cloud session parked on can be noticed — the extension sees
nothing but pages the user already has open — so this list is the daemon's instruction to the
browser. It is served from `daemon.ts`'s `listBridgeSessions` (L292-L300), which flattens
`readAllAgents` across every registered project (best-effort per project, so one unreadable repo
cannot empty the list) and calls this function with `new Date()`.

Three invariants, all stated in `bridge-sessions.SPEC.md`:

1. **Only `web`-target agents that reached a cloud session.** An agent with no `sessionId` has no
   page to open. Checked at L27.
2. **Recent only**, twelve hours from the agent's `startedAt` — deliberately the *same* window as
   `cloud-run-state.ts`'s `CLOUD_SESSION_WINDOW_MS`, imported rather than re-declared (L6), so the
   bridge stops watching exactly when the agent's row stops saying "in cloud". Boundary semantics
   match too: here `at < cutoff` drops, i.e. keeps `now - at <= windowMs`, which is literally
   `cloud-run-state.ts` L44's comparison.
3. **At most three, newest first, one per session.**

The rationale for recency-as-the-whole-filter is sound and worth restating because it looks like a
missing liveness check: #1231 ends a `web`-target agent at the hand-off, so *every* such agent reads
`done` whether its session is parked on a question right now or wrapped up an hour ago, and there is
no read-back that would separate the two. Filtering on `status` would yield an empty list forever
(the test at bridge-sessions.test.ts L32 pins exactly this). So the function deliberately ignores
`status`, `pr`, `mergeOutcome` and `cloudWaiting` — a stale tab is the accepted cost.

Concurrency/ordering: the function is pure and synchronous; `now` is injected, so it has no clock of
its own. All the ordering risk lives in the *input* order, which is where the one defect below sits:
duplicates are collapsed by keeping the first agent encountered, and the surviving entry keeps that
agent's timestamp, so the collapsed session ranks by whichever agent the caller happened to list
first rather than by its newest agent. `readAllAgents` returns `[...live, ...archived]` — each half
sorted `byIdDesc`, and an agent id *is* its start time (`agentIdFromStartedAt`, agent-store.ts
L59-L63), so each half is newest-first, but the concatenation is not: an older still-`running`
agent precedes a newer archived one.

Failure modes covered: an unparseable or absent `startedAt` is dropped rather than treated as now
(L28-L29 — `Date.parse(undefined ?? '')` is `NaN`, and `Number.isFinite(NaN)` is false); a
future-dated `startedAt` (clock skew) passes the window and sorts first, which is the harmless
direction. The URL is built by template from `agent.sessionId` with no escaping; the id is written
by the framework itself into the agent meta (not user input on this path), and the extension is the
only consumer, so no injection surface here.

## Functions (low-level)

### `BRIDGE_SESSION_WINDOW_MS` (L6)

Re-export of `CLOUD_SESSION_WINDOW_MS` (12h). The aliasing is the point: the SPEC ties the tab
window to the "in cloud" window, and one constant makes drift impossible. Correct.

### `BRIDGE_SESSION_LIMIT` (L12)

`3`. Only a cap; enforced by `slice` after sorting, so it always keeps the *newest* three rather
than the first three encountered. Correct.

### `bridgeSessionsFrom(agents, now, windowMs?, limit?)` (L22-L38)

Filter → dedupe → sort desc by `at` → cut → strip the sort key.

Edge cases walked:

- **Empty `agents`** → `[]`. Correct.
- **`target !== 'web'` / missing `sessionId`** → skipped before anything else, so a `local` agent
  can never consume a `seen` slot or a limit slot. Correct.
- **Window filter before dedupe** (L29 before L30) — this ordering is right and easy to get wrong:
  an out-of-window agent does *not* poison `seen`, so a session whose oldest agent has aged out is
  still offered on the strength of a newer in-window agent. Correct.
- **`Date.parse` on a non-ISO string** → `NaN` → dropped. Correct (pinned by the test at L71).
- **`limit <= 0`** → `slice(0, 0)` → `[]`. Only reachable if a caller passes it; the only caller
  uses the default. Fine.
- **Sort stability** — ties on `at` (two sessions started in the same millisecond) fall back to
  insertion order under V8's stable sort. Harmless.
- **Dedupe order** — `seen` keeps the *first* agent listed for a session, and the entry it pushes
  carries that agent's `at`. When the input is not globally newest-first (see above), the collapsed
  session is ranked by an older agent's start time; with more than three live sessions it can be
  ranked out of the cut entirely. Probe-confirmed: with a stale `running` agent for `session_SAME`
  (09:00) listed before that same session's 19:50 agent and three other sessions at 19:40/19:30/
  19:20, the result is `["s1","s2","s3"]` — the most recently touched session is the one dropped.
  Verdict: bug found (minor; see below).

## Bugs found

1. `L30`–`L32` (surfacing at the `sort`/`slice` on `L35`–`L36`): **collapsing duplicate sessions
   keeps the first agent listed rather than the newest, so the surviving entry is ranked by a stale
   timestamp.** `seen.has(...)` skips every later agent for a session, and the entry pushed for the
   first one carries *its* `at`, which is what the sort and the three-tab cut then use.
   `bridge-sessions.SPEC.md` says the list is "ordered newest agent first" after "duplicates are
   collapsed to one entry per cloud session" — i.e. a session's rank should be its newest agent's
   start. Trigger: `daemon.ts` feeds `readAllAgents`, which returns `[...live, ...archived]` (each
   half newest-first, but the concatenation is not), so an older still-`running` web agent that
   shares a cloud session with a newer archived one comes first; with three other sessions in the
   window, the session that was actually touched most recently is sorted last and cut, and the
   extension never opens the tab for the page most likely to be parked on a question.
   Probe-confirmed with the module's own logic (result `["s1","s2","s3"]`, the 19:50 session
   dropped). Severity: minor (needs a duplicated session id *and* more sessions than the cap;
   the failure is a missing tab, not corrupt data). Confidence: low — it depends on how the caller
   orders agents, which happens to be almost-newest-first today. Fix sketch: keep the newest per
   session instead of the first — e.g. collect into a `Map<sessionId, at>` taking
   `Math.max(existing, at)`, then build, sort and slice from the map's entries.
