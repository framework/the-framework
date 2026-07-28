The `gh` CLI in one place: the dashboard's JSON reads (PR lookups, PR lists, per-PR file patches), their cached forms, the run-PR attribution logic, and the runner its write actions use.

## TLDR

- `nodeGhRunner()`: the write-action runner (60s timeout, rejects with gh's own stderr); reads use a separate 8s runner that never surfaces errors.
- `ghMergePr(cwd, number)` (#1216): `gh pr merge --squash --auto` first (the PR lands when its checks pass); where GitHub refuses auto-merge (repo setting off, or the PR already in clean status — both carry the `enablePullRequestAutoMerge` marker) it merges directly. Never throws; resolves an `AutoMergeOutcome` (`auto-armed` / `merged` / `failed`+error) the handoff reports.
- `ghJson` is the one forgiving `--json` read: resolves the caller's `empty` when gh is missing/unauthed or output is not JSON.
- `ghPrView` (PR for a branch, or the checkout's current branch) and `ghPrsForBranch` (every PR a branch name has *ever* had, any state, newest first, #1251), each with a cached form (`cachedPrView`, `cachedPrsForBranch`) and invalidator (`forgetPr`, `forgetBranchPrs`).
- `pickRunPr(prs, since)` attributes a PR to a run: an OPEN PR always counts (GitHub allows one open PR per head branch); a closed one only when created at/after the run's start — the oldest such — else it is a predecessor's PR wearing the same branch name.
- `ghPrList` (open PRs, includes `isDraft` + `headRefName` for #1102 session-draft detection) feeds the interventions queue (#632); `ghOpenPrFilePatches`/`cachedOpenPrFilePatches` (#1313) fetch each open PR's diff of one file via `gh api` for the sweep's queue-claim check.

## Problems

- Consolidation: there were four separate `gh` adapters across three modules, three hand-rolling `execFile` + `JSON.parse` + swallowed failures with the 8s timeout re-spelled each time.
- `gh pr view <branch>` answers the newest PR for that head *in any state*, so a session on a pinned/reused branch name (`the-framework/triage-quick`) inherited a predecessor's merged PR as its own (#1251) — the list form + `pickRunPr` exists to fix that.

## Decisions

- Reads are capped short and never error: every caller is a panel rendering whatever it got, and "gh is not installed" must cost a page load nothing.
- `ghPrView`/`ghPrsForBranch` copy fields out explicitly rather than passing gh's object through, so a future `--json` addition cannot leak into what callers store.
- The named-branch lookup form exists because a finished session's worktree may be gone — "current branch" would silently be the project's, not the session's (#799); `BranchPrLookup` encodes that invariant in the type.
- Cache keys are NUL-separated so paths cannot collide with the separator.
- `cachedOpenPrFilePatches` gets a generous 5s cold budget (vs 150ms) because its one caller is the sweep's claim check: a user-clicked drain should wait for the real answer rather than stand down a whole tick.
- Cross-fork PRs answer the files endpoint too (it belongs to the base repo); only the first 100 changed files per PR are inspected.
