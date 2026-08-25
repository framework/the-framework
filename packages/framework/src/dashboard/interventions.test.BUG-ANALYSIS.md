# Bug analysis: packages/framework/src/dashboard/interventions.test.ts

## Business logic (high-level)

Unit tests for `buildInterventions` and `interventionKey`, run off disk through the `InterventionsDeps`
seam. They pin, per `interventions.test.SPEC.md`:

- PR roll-up across projects, newest-first ordering, empty projects contributing nothing.
- Draft policy: hand-made drafts excluded, agent-branch drafts kept (#1102), and a draft with no
  `headRefName` treated as hand-made rather than admitted.
- The `awaiting` source (#636): only `running` + `pendingChoice`, dashboard URL optional.
- The `unpushed` source (#860): the five "already went somewhere" exclusions, the running-agent
  exclusion, the unreadable-branch skip, and the `handoffLimit` slice with its ordering.
- The `whole` list (#1623): a failed source excludes the project, a genuinely empty one does not.
- `interventionKey` identity per kind.

**Do the tests actually verify what they claim?** Mostly yes, and the assertions are real (each has
a concrete `deepEqual`/`equal` on a value derived from the code under test, and every test awaits its
promise — no floating assertions, no `assert.ok(true)` shapes).

Two hermeticity observations worth recording:

- The comment at L11 says `noAgents` "keeps the PR-only tests hermetic (no disk read)", but
  `noAgents` is passed as `liveAgents`, not `agents`. Every test that omits `agents` therefore runs
  the real `listAgents` against `/a`, `/b`, `/c`, `/boom`, `/ok`, `/quiet`, `/repo` — real
  `readdir`s of paths that do not exist. `listAgents` documents "missing or unreadable dir/entries
  are skipped, never thrown" and returns `[]`, so the tests still pass and `whole` still contains the
  quiet project (`:63`) — but the stated hermeticity is not what the code does. Not a bug in the
  usual sense (no wrong assertion, no flakiness on any plausible machine), so it is not reported;
  it does mean these tests would break if `/a` ever existed with a `.the-framework` store, which on
  a CI box it will not.
- The default `handoff` (which shells out to git) is never reached in those tests because
  `listAgents` returns `[]` first. So the "PR-only" tests do not, in fact, spawn git.

**Coverage gap, not a bug:** nothing pins the file's own stated invariant that two concurrent agents
of the same project parked at the same gate stay distinct. The identity test at `:126` uses a single
`awaiting` item, and `:241` only checks `unpushed` vs `awaiting` collision. That gap is precisely why
the `keys.ts` defect recorded in `interventions.BUG-ANALYSIS.md` survives — see that document; the
missing case belongs here, but a missing test is a coverage gap and is reported against the source.

## Functions (low-level)

### Fixtures

- `project(id, path)` (L9) — minimal `ProjectSummary` with `activated: true`. Fine.
- `noAgents` (L12) — `liveAgents` stub. Fine (see hermeticity note).
- `live(meta, cwd)` (L15) — wraps an `AgentMeta` into a `LiveAgent` with a worktree cwd (#738). The
  `cwd` is never asserted on; harmless.
- `runningAgentMeta` / `doneMeta` / `waiting` (L17, L139, L150) — overridable builders. `waiting()`
  returns a genuinely "needs you" handoff: exists, one commit, non-empty, has remote, unpushed,
  unmerged. Correct — every exclusion test flips exactly one field.
- `onlyUnpushed(agents, handoff)` (L166) — pins all three sources so only the unpushed one can fire.
  Correct.

### `'rolls up open non-draft PRs across projects, newest first'` (L25)

Asserts both the exclusion of the draft and the newest-first order in one `deepEqual` on a projected
shape — a real assertion that would fail on either regression. Also asserts every item is `kind: 'pr'`.
*Verdict:* correct.

### `'skips a project whose PR lookup throws, and does not call it read (#1623)'` (L48)

Throws for `/boom` only, then asserts the item list has only `ok` and `whole` is `['ok']`. This is
the load-bearing distinction between "nothing there" and "could not look". *Verdict:* correct.

### `'calls a project read when it answers with nothing (#1623)'` (L59)

`whole === ['quiet']` depends on all three sources succeeding, including the real `listAgents`.
Passes because `listAgents` swallows ENOENT. *Verdict:* correct (with the hermeticity caveat above).

### `'does not call a project read when its live-agent read throws (#1623)'` (L66)

Verifies the two halves independently: items still contain the PR that *was* read, `whole` is empty.
This is the exact behaviour the notification watcher depends on. *Verdict:* correct.

### `'dedupes a PR shared by two registered projects'` (L82)

Both projects resolve to the same `prs` result; asserts one item. Note it asserts only
`items.map(i => i.number)` — it would still pass if the *wrong* one of the two duplicates survived,
but they are byte-identical apart from `projectId`, and nothing downstream depends on which. Weak
but not wrong. *Verdict:* correct.

### `awaiting` tests (L91-124)

- `:91` — parked agent produces one item with kind/project/title/awaitId. Correct.
- `:103` — a `done` agent that still records a `pendingChoice` produces nothing. This pins the
  `meta.status !== 'running'` guard, which matters because `applyEventToMeta` only deletes
  `pendingChoice` on some end paths. Correct.
- `:109` — dashboard URL present vs absent. Correct.
- `:117` — mixed kinds ordered newest-first by `createdAt`/`updatedAt`. Correct: the awaiting item's
  `updatedAt` (07-16) is later than the PR's `createdAt` (07-10), so the assertion genuinely
  discriminates.

### `unpushed` tests (L173-239)

- `:173` — the happy path, asserting title is the *intent* not the branch. Correct.
- `:187` — a table of five exclusions, each a single-field override, each asserted with a labelled
  message. Genuinely exhaustive against the `if (!state || …)` guard, except `!state` (a handoff that
  resolves `undefined`), which is not covered — a coverage gap only.
- `:205` — a `running` agent is filtered before inspection. Correct.
- `:214` — a throwing handoff yields `[]` rather than propagating. It does not assert `whole`, so it
  does not pin that this failure also clears the project's whole-ness; a gap, not a wrong assertion.
- `:224` — asserts *which* three branches were inspected (`b11, b10, b9`) and in what order, not just
  the count. This is a strong assertion that pins the `startedAt`-descending sort as well as the
  slice. Correct.

### `interventionKey` tests (L126, L241)

`:126` pins `pr` → url and `awaiting` → `awaiting:a:g1`. `:241` pins `unpushed` → `unpushed:p:r1`,
distinctness across agent ids, and non-collision with `awaiting`. All real assertions. Neither
covers two `awaiting` items differing only by agent — the uncovered case. *Verdict:* correct as far
as they go.

### Draft tests (L252, L263)

`:252` asserts `[9]` — the agent-branch draft in, the hand-made one out — in a single `deepEqual`,
so it fails if either half regresses. `:263` covers the `headRefName === undefined` path. Both pass
`agents: async () => []` so they are genuinely hermetic. *Verdict:* correct.

## Bugs found

None found.
