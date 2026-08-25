# Bug analysis: packages/framework/src/dashboard/git-status.ts

## Business logic (high-level)

The project panel's status row (#491): the current branch, whether the tree is dirty, and the linked
pull request. Two very different cost classes deliberately live in one function:

- **branch + dirty** — two local `git` reads, ~10 ms, and the only fields the row cannot render
  without.
- **the PR** — a `gh` call an order of magnitude slower, so it goes through the read-through cache
  (`cachedPrView` / `cachedPrsForBranch`, #1028) and is allowed to arrive *late*: on a cache miss the
  cache answers `{ value: undefined, pending: true }` immediately and refreshes behind the caller.
  `prPending` is what lets the UI say "not known yet" rather than "there is no PR" — the difference
  decides whether an "Open PR" button is offered.

**Forgiveness ladder.** `git rev-parse` failing means "not a git repo" and the whole row is
`undefined` — correct, because there is no row to draw. Everything below that degrades in place: a
failed `git status` reads as clean, a failed PR lookup omits the PR. That ordering is right: the
branch is the row's identity, the other two are decorations.

**The `since` path (#1255).** The plain lookup is `gh pr view`, which answers the newest PR for the
branch *in any state*. An agent on a pinned, reused branch name (`the-framework/triage-quick`) would
therefore wear a predecessor's merged PR as its own badge. When the caller knows the agent's start
time it passes `since`, and the PR is picked out of the branch's whole history by `pickAgentPr`
instead — an open PR always, or a closed one no older than the agent. That is a real correctness fix,
and the branch selection here is the switch that routes to it.

**Seam precedence.** `linkedPr` checks `deps.pr` first, then `deps.since === undefined`, then
`deps.prs`. So a caller passing both `pr` and `since` silently gets the un-scoped lookup. No caller
does; `deps.pr` exists for tests and for the relay, `since`/`prs` for the agent path.

**Concurrency.** The two git reads and the PR read are sequential, not parallel. The PR read is
cache-backed, so the common case is a map lookup; the uncached case pays ~600 ms *once* and every
subsequent poll gets the stale-while-revalidate answer. Serialising them costs nothing measurable.

## Functions (low-level)

### `readGitStatus(cwd, deps)` (L40-54)

*Output:* `GitStatus | undefined`.

- **Not a repo** → `rev-parse` rejects → `undefined`. Correct, pinned at `git-status.test.ts:25`.
- **Detached HEAD** → `rev-parse --abbrev-ref HEAD` prints `HEAD`, so `branch === 'HEAD'`. The row
  shows "HEAD", and the branch-addressed PR lookup would ask about a branch called `HEAD`. Cosmetic;
  an agent's worktree is never detached in this system.
- **Empty repo (no commits)** → `rev-parse --abbrev-ref HEAD` still succeeds on modern git, printing
  the unborn branch name. Correct.
- **`git status` failing** → `.catch(() => '')` → `dirty: false`. The comment path says a failed status
  "reads as clean", which is the forgiving choice; note it means a repo whose status read is broken
  looks clean rather than unknown. Acceptable — `dirty` is a dot, not a decision.
- **Trailing whitespace** — both reads are `.trim()`ed (the branch) / length-checked after `.trim()`
  (the dirty flag), so a trailing newline never makes a clean tree look dirty. Correct.
- **Conditional spreads** — `pr` and `prPending` keys are omitted rather than set to `undefined`, so
  `deepEqual({branch, dirty})` in the tests is exact and a JSON payload does not carry
  `"pr": undefined`. Correct and deliberate.
- `prPending` is only emitted when truthy, so "not pending" is the absence of the key. Consistent with
  how the rest of this codebase encodes optional facts.

*Verdict:* correct.

### `linkedPr(cwd, branch, deps)` (L57-68)

*Output:* `{ value, pending }`.

- **`deps.pr` given** → awaited with `.catch(() => undefined)`, `pending: false`. Correct; pinned at
  `git-status.test.ts:35`.
- **No `since`** → `cachedPrView(cwd)`, with a `.catch` returning the empty shape. Note it calls
  `cachedPrView(cwd)` *without* the branch, so the cache key is `pr\0<cwd>\0` — "the PR of whatever
  branch this checkout is on". That is right for a project row (the checkout's own branch) and it is
  the key `forgetPr(cwd)` would invalidate; `agent-handoff.ts` invalidates the branch-scoped key
  instead, but it also reads the branch-scoped one, so the pairs are internally consistent.
- **`since` + `deps.prs`** → `pickAgentPr(await deps.prs(...).catch(() => []), since)`. A failing
  history read degrades to no PR *and* `pending: false` — pinned at `git-status.test.ts:77`, including
  the `prPending === undefined` half, which is the assertion that matters: a failed read must not look
  like "still loading" forever.
- **`since`, no `deps.prs`** → `cachedPrsForBranch(cwd, branch)`, whose `pending` is propagated so the
  row can say "not known yet". The `.then(onFulfilled, onRejected)` form is used rather than `.catch`,
  which is correct here — an error thrown *inside* the success handler (there is none; `pickAgentPr`
  is pure) would not be swallowed.

*Verdict:* correct.

## Bugs found

None found.
