Effort: 3
Uncertainty: 4

# [Plan] The catch-all safety commit will commit anything: 7,632 cache files went to main unnoticed

Proposes Option A (refuse implausible sweeps, with a report) as a guard inside the two code paths that sweep, plus a pathspec exclusion of `.the-framework/` that fixes the second, threshold-blind instance.

## TLDR

- The ticket names two sweep sites; there are actually **four call sites but only two code paths**: `installProject` (`packages/framework/src/install.ts:48-52`) has its own inline `git add -A`, and everything else — worktree teardown (`worktrees.ts:218`), the auto-handoff (`cli.ts:1005`), the dashboard's finishing button (`dashboard/agent-handoff.ts:393`) — funnels through `commitPendingWork` (`store/worktree.ts:157`). Guarding those two paths guards the whole mechanism. (The ticket's paths say `packages/the-framework/`; the package is `packages/framework/`.)
- Recommend **Option A**: before sweeping, measure what is pending; past a threshold (file count or total bytes, over *untracked* files only), commit nothing and report what was seen. Option B (a denylist) ages badly and catches nothing Option A misses; skip it, or add it later as a refinement of the report ("looks like turborepo cache") rather than as the guard.
- Option A alone does **not** fix the ticket's second instance (the 12-line `.the-framework/.gitignore` + `LAYOUT` scaffolding carried into drain PRs) — that is a different sub-mechanism, fixed separately by excluding `.the-framework/` from `commitPendingWork`'s pathspec: nothing under it is ever the session's work, and `install.ts` is the one place meant to commit that scaffolding.
- A refusal is not data loss anywhere: every `commitPendingWork` caller already treats `false` as "keep the checkout and say so", and a refused install aborts before touching anything.

## Problems

1. **Option A vs Option B — the maintainer's call the ticket asks for.** Uncertainty 3. The ticket's curator already picked A; this plan concurs (see Solutions). The open question is only whether B rides along.
2. **What to measure.** Uncertainty 4. All pending paths, or untracked ones only? Count, bytes, or both? (See Solutions — untracked-only, both dimensions.)
3. **Threshold values.** Uncertainty 3, but low stakes: any order-of-magnitude-sane pair separates the observed cases (a real session: a handful of files; the incident: 7,632 files / ~250 MB) by two orders of magnitude either way.
4. **How a refusal surfaces.** Uncertainty 3. `commitPendingWork` returns a bare boolean today; a refusal that reports needs to carry *what it saw* to each caller's error path.
5. **The scaffolding instance is threshold-blind.** Uncertainty 2. Two files, 12 lines — no threshold catches it, and it should not: the fix is that the teardown/handoff sweep has no business committing `.the-framework/` at all.

## Solutions

### Problem 1 — Option A, and what happens to Option B

- **Option A (recommended)**: count-and-size gate. It needs no knowledge of which tool made the mess, so it catches the artifact nobody has named yet (`.next/`, `target/`, `.venv/`, a stray database dump), and a refusal that reports is strictly more informative than a silent 262 MB commit. False positives degrade safely (see Considerations).
- **Option B (skip as a guard)**: a denylist of known machine-local directories is a list somebody must keep current, silent about tomorrow's artifact — exactly the failure the incident demonstrated (`.turbo/` was not on anyone's list). Its one genuine use is *diagnosis*: the refusal report may mention when a known shape dominates ("7,632 of 7,634 files under `.turbo/cache/`"), which is a report-formatting nicety, not a gate, and can be added any time later.
- Not on the ticket, considered and rejected: committing anyway onto a quarantine branch (moves the mess instead of stopping it, and the install-time sweep has no branch to quarantine to), and auto-appending offenders to `.gitignore` (the framework editing the user's `.gitignore` unattended is a bigger liberty than the one being removed).

### Problem 2 — measure untracked files, both count and bytes

- Scope to **untracked** paths: every observed and hypothesized junk vector is untracked (build caches, venvs, dumps — none were ever committed). Mass *tracked* modifications are almost always real work (a formatter run, a codegen sweep, a rename) and refusing to commit those at teardown would block legitimate sessions. Alternative — gate all pending paths — is simpler but trades exactly those false positives for no observed benefit.
- Measure **both** count and total bytes: count catches the many-small-files case (7,632 cache entries), bytes catches the single-huge-file case (one database dump is 1 file). Either alone leaves a hole the ticket explicitly names ("files or bytes").
- Mechanics: `git status --porcelain -uall` — **`-uall` is load-bearing**: default porcelain collapses an untracked directory to one `?? .turbo/` line, so the incident measures as *one* pending path without it. Bytes via `lstat` on each `??` path, short-circuiting: refuse on count before statting anything (statting 100k files to confirm a refusal already decided is waste), and stop summing at the byte threshold.

### Problem 3 — threshold values

Exported constants, no config surface (zero users; a knob can be added if a real repo ever hits a false positive):

- `SWEEP_MAX_FILES = 200` untracked files — ~40× above a plausible real session (a handful to a few dozen new files), ~38× below the incident.
- `SWEEP_MAX_BYTES = 25 MB` of untracked content — an order of magnitude above real session output, an order below the incident's ~250 MB, and small enough to catch a single stray dump.

Alternatives (100/500 files, 10/100 MB) are all defensible; nothing observed sits within a factor of 10 of any of them.

### Problem 4 — surfacing the refusal

Change `commitPendingWork`'s return from `boolean` to a small result (breaking change is fine — unreleased, and AGENTS.md prefers clean code):

```ts
type CommitPendingResult =
  | { ok: true }
  | { ok: false; refused?: SweepReport }  // refused set => the guard stopped it; absent => commit failed (identity, hooks)
```

where `SweepReport` carries file count, total bytes, and the top offending top-level directories with per-directory counts/sizes (e.g. `.turbo/: 7,632 files, 248 MB`) — aggregation by first path segment is enough to make the report actionable ("gitignore this").

- `worktrees.ts` teardown: keep the checkout (as today), error names the refusal: "…holds 7,632 untracked files (248 MB, mostly .turbo/); refusing to commit them — gitignore or remove them, the worktree was kept".
- `cli.ts` auto-handoff: new skip reason `commit-refused` beside `commit-failed`, report in the event payload so the dashboard can show it.
- `dashboard/agent-handoff.ts` finishing button: propagate the report into the action's `{ ok: false, error }`.
- `install.ts`: guard before its own sweep, return `{ ok: false, error: <report> }` — activation is attended, so the user reads it, fixes `.gitignore`, retries.
- Refusal is deterministic: it must **return immediately, not burn the #1376 retry loop** (the retries exist for `index.lock` races, i.e. thrown git failures — keep those retrying).

### Problem 5 — exclude `.the-framework/` from the sweep

In `commitPendingWork` only (never `install.ts`, whose job includes committing the scaffolding):

- `git status --porcelain -uall -- . ':(exclude).the-framework'` for both the clean-check and the measurement, and `git add -A -- . ':(exclude).the-framework'` for the sweep. The clean-check **must** carry the same pathspec: otherwise a checkout whose only pending paths are scaffolding measures dirty, stages nothing, and `git commit` fails with "nothing to commit" — turning a clean teardown into a kept worktree.
- Leftover unstaged `.the-framework/` files after the commit are fine: `removeWorktree` already falls back to `--force` for ignored-artifact residue, and that is what this residue is.

## Considerations

- **False positives fail safe at every caller.** Teardown keeps the checkout (the user commits by hand, work not lost); auto-handoff skips with a named reason; install aborts before acting. Nowhere does a refusal delete or strand anything — which is what makes an aggressive threshold acceptable.
- **A legitimate mass-untracked session exists in theory** (an agent told to vendor a large asset set). Untracked-scope + 200-file threshold refuses it; the kept checkout plus the report is the correct outcome even then — a human glance was exactly what the incident lacked.
- **`data-branch.ts` also runs `git add -A`** (lines 148, 240), in the framework's own `tf-data` checkout, committing files the framework itself just wrote. Different surface, framework-owned tree, no user junk vector — out of scope here; worth a code comment cross-referencing this guard so the asymmetry is deliberate. (`e2e/harness.ts` is test-only.)
- **Install's "pre-existing dirty changes" commit is the highest-risk site** — it runs in the *user's own repo* on *main*, which is exactly where 118e6cad landed. The guard there protects before the framework has done anything, so refusing is cheap.
- **Wording**: both refusal messages should share vocabulary with the existing `[The Framework] uncommitted changes` story ("one vocabulary", per the existing comment in `worktree.ts:169`).
- **Docs/specs**: FEATURES-SPEC.md's "Commit what the agent left uncommitted" (Handoff section) gains the guard ("— unless the sweep looks implausible (hundreds of files / tens of MB untracked), in which case it refuses and reports"); FEATURES-SPEC.md forbids feature changes without human approval, and modifying it or any SPEC.md means reading https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md first. This plan's approval covers that call.
- **Testing seams already fit**: `commitPendingWork` and `installProject` take injectable `GitRunner`/`StoreFs`; existing suites (`store/worktree.test.ts`, `install.test.ts`, `worktrees.test.ts`) cover the call sites. The byte measurement needs an `lstat` seam (reuse `StoreFs` or a tiny injectable stat runner, like `SizeRunner`).

## Implementation

1. **New module** `packages/framework/src/store/sweep-guard.ts`: `SWEEP_MAX_FILES`, `SWEEP_MAX_BYTES`, `SweepReport`, and `assessSweep(pending: PorcelainEntry[], statFile): Promise<SweepReport | undefined>` — pure logic over a parsed `status --porcelain -uall` listing; `undefined` means sweep away. Parsing shares style with `parseWorktreeList` (exported, unit-testable without a repo).
2. **`commitPendingWork`** (`store/worktree.ts`): switch status to `--porcelain -uall` with the `':(exclude).the-framework'` pathspec (clean-check and measurement alike); call `assessSweep`; on refusal return `{ ok: false, refused }` immediately (outside the retry loop); sweep with the same pathspec exclusion; return `{ ok: true }` / `{ ok: false }` accordingly. Update the doc comment's contract ("false means keep the checkout" story stays true).
3. **Callers**: `worktrees.ts:218` (error message from the report), `cli.ts:1005` (skip reason `commit-refused`, report on the handoff event), `dashboard/agent-handoff.ts` `commitAgentWork` (propagate), `store/index.ts` re-exports.
4. **`installProject`** (`install.ts`): before its pre-existing-changes sweep, run the same measurement (no `.the-framework` exclusion needed — the dir does not exist yet, per the early return); on refusal, `{ ok: false, error }` built from the report.
5. **Tests**: guard unit tests (count boundary, byte boundary, short-circuit order, top-offender aggregation); `commitPendingWork` refusal (no `add`, no retry burn) and scaffolding-only-pending → clean; install refusal; the `-uall` regression (an untracked *directory* must count its files, not 1).
6. **Specs**: FEATURES-SPEC.md Handoff + Setup lines (human-approved via this plan); read sdd.md before touching any SPEC.md.
7. **Comment breadcrumbs**: `data-branch.ts`'s `add -A` sites get a one-liner saying why they are unguarded.

Estimated: one session. No migration concerns (nothing released).
