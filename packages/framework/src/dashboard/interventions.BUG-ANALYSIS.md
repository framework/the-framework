# Bug analysis: packages/framework/src/dashboard/interventions.ts

## Business logic (high-level)

Builds the cross-project "needs you" queue and phrases it for Discord. Three sources feed one flat
`Intervention[]`:

1. **Open PRs** — `ghPrList(project.path)` per registered project. A draft is dropped unless its
   `headRefName` is an agent branch (`isAgentBranch`), because auto-handoff deliberately opens a
   draft so it does not ping reviewers; dropping those too would reproduce #860 (work nobody is told
   about). A draft with no `headRefName` at all falls to the hand-made side — the `isAgentBranch`
   call gets `undefined` and must answer "no". That is pinned by the test at
   `interventions.test.ts:263`.
2. **Parked agents** — every `readLiveMetas(project.path)` entry that is still `running` *and*
   carries an unresolved `pendingChoice`. Since #736 a project runs several agents at once, so each
   parked agent is meant to be its own item.
3. **Unpushed finished work** — the newest `handoffLimit` (default 5) non-`running` agents, each
   inspected with `readAgentHandoff`. An item is produced only when the branch exists, is non-empty,
   unmerged, unpushed, and there is a remote. Everything else is a reason the work is *not* waiting.

**Forgiveness and the `whole` list.** Every source is individually `.catch(unread)`-ed, so one
unreadable project never fails the queue. That same forgiveness is what would let a project that was
briefly unreachable announce its whole backlog as new when it comes back, so the return value is a
`ProjectionRead<Intervention>`: `whole` lists the projects where *every* source answered. The
`sawEverything` flag is per-project, reset at the top of each loop iteration, and `unread()` is the
single mutation point — all four call sites (PR list, live agents, `unpushedFor` itself, and the
per-branch handoff read inside it) route through it. That is correct: an inner handoff failure marks
the project not-whole via the closure even though `unpushedFor` still resolves with the items it did
get.

**Ordering and identity.** Items are sorted `createdAt` descending by string `localeCompare` — the
values are ISO-8601 UTC (`Z`), so lexicographic order is chronological order; items with no
`createdAt` sort last (empty string compares lowest). Then a `Set`-based filter keeps the first
occurrence of each `interventionKey`. That dedupe exists for the monorepo-root + subdir registration
case, where `gh` resolves both project paths to the same repo and returns the same PR twice.

**Concurrency/ordering.** The whole build is sequential (`for … await`), so N projects cost N
serial `gh` calls. Not a bug — it runs on a poll and the GitHub reads go through the read-through
cache — but it does mean total latency is the sum, not the max.

**Invariant that is violated.** The file's own comment (L120-123) and `interventions.SPEC.md` both
state that a parked agent is identified by *gate id plus agent id* "so that two parked agents are
told apart and each is announced exactly once". `interventionKey` (in `keys.ts`) does not include
the agent id. Gate ids are not agent-scoped — `await-gate.ts:47` mints `'await-choices'` /
`'await-choices-<round>'` and `todo-loop.ts:369` mints `'todo-next'` / `'todo-next-<n>'` — so two
concurrent agents of the same project parked on their first gate produce the identical key and the
dedupe at L151 silently discards one. See Bugs found #1.

## Functions (low-level)

### `interface Intervention` / `InterventionsDeps` (L23-69)

Discriminated by `kind` with per-kind optional fields rather than a union. Consequence: nothing
type-checks that an `awaiting` item carries an `awaitId`, or an `unpushed` item a `branch`; the
formatters compensate with `?? ''` / `?? 0` defaults. The producers here always fill them, so this
is a reliance, not a defect.

`InterventionsDeps.handoff` defaults to `readAgentHandoff(cwd, branch, { pr: async () => undefined })`
— deliberately stubbing the PR lookup, since an open PR implies the branch was pushed and `pushed`
already excludes it. Correct and materially cheaper (no 8s-timeout network call per agent per poll).

### `buildInterventions(projects, deps)` (L86-153)

*Inputs:* project summaries + injectable readers. *Output:* `{ items, whole }`.

Edge cases:
- **Empty `projects`** → `{ items: [], whole: [] }`. Correct.
- **A source that throws** → `unread()` returns `[]` and clears `sawEverything`; the loop continues.
  Correct, and pinned by `interventions.test.ts:48` and `:66`.
- **`unpushedFor` rejecting** (only possible if `deps.agents` throws — `listAgents` itself never
  throws) → outer `.catch(unread)`. Correct.
- **`pr.createdAt` missing** → the spread omits the key rather than writing `undefined`, keeping the
  sort's `?? ''` path meaningful. Correct.
- **Duplicate PR across two registered projects** → collapsed by url. Correct.
- **`deps.dashboardUrl` unset** → `awaiting`/`unpushed` items get `url: ''`, and `interventionLine`
  then omits the trailing link. Correct.
- **Two parked agents, same project, same gate id** → one item is dropped. **Bug (see #1).**

Note the `interventionKey` is computed twice per item in the filter expression (L151). Pure
function, so only a micro-cost — not reported.

*Verdict:* bug found (identity of `awaiting` items, fix belongs in `keys.ts`).

### `unpushedFor(project, deps, unread)` (L161-203)

Lists non-running agents, sorts by `startedAt` descending, slices to the limit, and inspects each
branch.

- `agentBranchFor(agent)` derives the branch (falling back to a name derived from the id when the
  meta has none), so an agent that never recorded a branch still gets inspected; the handoff read
  then reports `exists: false` and it is skipped. Correct.
- The per-branch `.catch()` calls `unread()` **and** returns `undefined`, so one bad branch marks the
  project not-whole but the remaining branches are still inspected. Correct and deliberate.
- `title: agent.intent?.trim() || branch` — an intent of only whitespace falls back to the branch
  name rather than rendering blank. Correct.
- `commits: state.commits.length` — `state.empty` is already false here, so this is ≥ 1 in practice;
  `interventionLine`'s `?? 0` is dead-ish defence.
- Agents with no `startedAt` sort last, so they are the first to fall outside the limit. Acceptable:
  every agent the store writes has one.
- The slice is applied *before* the handoff reads, so the read cost is bounded by `handoffLimit`
  regardless of history size. Correct (pinned by `interventions.test.ts:224`).

*Verdict:* correct.

### `interventionLine(item)` (L214-221)

- `awaiting` → `"<title> — awaiting your answer[ — <url>]"`.
- `unpushed` → `"<title> — N commit(s) on <branch>, never pushed[ — <url>]"`, with the singular
  special-cased at exactly 1.
- default (`pr`) → `"#<number> <title> — <url>"`.

The `pr` branch is the fallthrough, so a future kind added without a branch here silently renders as
`#undefined …`. The tests assert `doesNotMatch(/#undefined/)` for both non-PR kinds, which is exactly
the guard against that. *Verdict:* correct.

### `postInterventionsDiscord(webhook, items, fetchImpl)` (L227-238)

- **Empty batch** → returns `true` without a POST ("nothing to deliver counts as delivered"), which
  is what the watcher needs so it does not retry. Correct, pinned by `interventions-discord.test.ts:58`.
- **One item** → names the project; **many** → a count plus bullets, and the project name only
  appears inside each line for `pr` items via the url. Matches the SPEC.
- Length is not bounded here; `postDiscordWebhook` clamps to 2000. Correct division of labour.
- Never throws: `postDiscordWebhook` swallows both non-ok and network errors. Correct for a daemon
  watcher.

*Verdict:* correct.

## Bugs found

1. `L151` (fix belongs in `packages/framework/src/dashboard/keys.ts:24`): two agents of the same
   project parked at the same gate collapse into one intervention, so only one of them is ever shown
   or announced. `interventionKey` returns `awaiting:${projectId}:${awaitId}` with no agent id, but
   gate ids are not agent-scoped: `await-gate.ts:47` mints `'await-choices'` for round 0 (and
   `await-choices-<round>` thereafter) and `todo-loop.ts:369` mints `'todo-next'`, for *every* agent.
   Scenario: project `p` runs agents `r1` and `r2` concurrently (#736); both hit their first
   `[await]` gate; `readLiveMetas` returns both with `pendingChoice.id === 'await-choices'`;
   `buildInterventions` builds two `awaiting` items with the identical key
   `awaiting:p:await-choices`, and the dedupe filter at L151 drops the second — the queue shows one
   "needs you", the Discord/browser notifier announces one, and the second agent stays parked with
   nothing telling the user. This contradicts the file's own comment at L120-123 ("each parked agent
   contributes its own item — keyed on the gate id, plus the agent id so two agents are told apart")
   and `interventions.SPEC.md` ("identified by the gate together with the agent it belongs to — so
   that two parked agents are told apart and each is announced exactly once"). Severity: major.
   Confidence: high. Fix: `return \`awaiting:${item.projectId}:${item.agentId ?? ''}:${item.awaitId ?? ''}\``
   in `keys.ts` (the `agentId` is already populated at `interventions.ts:132`), and extend the
   identity test at `interventions.test.ts:131` accordingly.
