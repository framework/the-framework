# Bug analysis: packages/framework/dashboard/components/GitStatusBar.tsx

## Business logic (high-level)

One status bar for "the checkout in play" (#491/#809): with `agentId` it polls
`onAgentWorktree` (branch/dirty/PR plus path, size, `own`); without, `onGitStatus` for the
project's checkout. Renders: optional disclosure chevron (`onToggle`), `project / label`
breadcrumb, branch (identity without a label, muted context with one), clean/dirty dot with
honest wording (`own` worktree → "in this agent"), `agentState`, worktree size (only when known,
#798), `summary` phrase, and the PR chip (outside the disclosure button so it stays clickable).
Null status (no repo) renders nothing.

Polling: 10s at rest, tightened to 1s while `prPending` (#1028) via `everyMs` state fed back into
the poll's deps; `keepPrevious=true` so an agent switch updates the cluster in place instead of
blanking. Checked: the `everyMs` effect only depends on `status?.prPending`, so cadence flips
exactly on pending transitions; a dep change refetches immediately; unmount clears the interval
(in `usePolled`). A rejected poll keeps the last value (hook behaviour) — the bar never flickers
off on a daemon hiccup, and a *successful* null (repo gone) does hide it. All consistent with the
SPEC.

Type facts verified: `GitStatus.branch` is a required string, so the non-worktree
`branchTitle`/`branchText` never see undefined; `AgentWorktree.branch` is optional and both
fall back to 'no branch'. `'path' in status` is a sound discriminator (only `AgentWorktree` has
`path`). `formatBytes(undefined, '')` yields `''` → size cell omitted (test-pinned); a measured
0-byte worktree would show "0 B", which is honest.

The one genuine mismatch found: the branch-prefix strip targets the *legacy* branch namespace —
see Bugs.

## Functions (low-level)

- `GitStatusBar(props)` (the only export):
  - Poll + cadence: correct (above).
  - `worktree`/`size`/`dirtyLabel`: correct; `own=false` (agent fell back to the project
    checkout) correctly words the dirt as the user's.
  - `branchTitle`: worktree → `branch\npath` (tooltip shows both); project → `branch <name>`.
    Correct.
  - `branchText` (L82): `label && branch ? branch.replace(/^the-framework\//, '') : ...` — strips
    a prefix nothing creates anymore. Verdict: bug found (below).
  - `facts`: chevron only with `onToggle`; label truncation order (project shrink-999 first, label
    last; branch hidden below `@2xl`, size below `@4xl`, summary below `@5xl`) matches the SPEC's
    drop-out priority. Correct.
  - Clean/dirty dot: warning vs neutral (deliberately not green). Correct.
  - Disclosure: facts wrapped in a `button` with `aria-expanded`; PR link rendered outside it —
    no nested-interactive violation. Correct.
  - `inline` vs row wrapper with `overflow-hidden` (#1026). Correct.

## Bugs found

1. `L82` (and the stale claim in `GitStatusBar.SPEC.md` L60): the beside-a-label branch shortening
   strips `/^the-framework\//` — but the framework renamed its branch namespace to `tf-`
   (`src/branch-names.ts`: `AGENT_BRANCH_PREFIX = 'tf-'`, with `LEGACY_AGENT_BRANCH_PREFIX =
   'the-framework/'` explicitly documented in `cloud-scratch-refs.SPEC.md` as a spelling "nothing
   creates ... anymore"; `cli.ts` renames to `tf-<session name>`, worktrees are born as
   `tf-agent-<id>`). Scenario: open any agent's view — the bar shows `tf-dark-mode` /
   `tf-agent-2026-…` beside the session name; the shared-prefix noise #1030 exists to remove is
   shown on every session, and the replace is dead code. Contradicts intent: the SPEC's rationale
   ("shown without its … prefix, which every branch shares" — no branch shares `the-framework/`
   any more) and MEMORY.md's zero-migration rule (no handling for the old name should remain).
   Severity: minor (cosmetic, every-session display). Confidence: medium (the fix could equally be
   "strip `tf-`" or "delete the strip and fix the SPEC", but the current half-state is wrong
   either way). Fix sketch: strip the current prefix — e.g. import the client-safe constant and
   `branch.replace(/^tf-/, '')` (or `branch.startsWith(AGENT_BRANCH_PREFIX) ? branch.slice(...)`) —
   and update `GitStatusBar.SPEC.md` L60 plus the `the-framework/dark-mode` fixtures in
   `GitStatusBar.test.tsx`.
