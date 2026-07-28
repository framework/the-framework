The end-of-session handoff (#799): reads what a finished session left on its branch (commits, files, pushed/merged/PR state, pending uncommitted work), and performs the handoff actions — push, open PR, and the armed auto-handoff (#1102).

## TLDR

- `readRunHandoff(cwd, branch)`: branch-addressed (not worktree-addressed) read of commits vs base, numstat files, `empty`, `hasRemote`/`pushed`/`merged`, the run's PR (cached, `prPending`), and `pending` uncommitted-file count in the session's own checkout (#1173). Undefined only when `cwd` is not a repo; a gone branch still answers (`exists:false`) with the PR looked up remotely (#1255).
- `runBranchFor(run)`: recorded branch, else `the-framework/<sessionName>`, else `the-framework/run-<id>`; `isSessionBranch` = the `the-framework/` prefix (a naming-convention guess, used only for how loudly to surface, never to act).
- `resolveRunPr` (#1251/#1255): tries the run's PR across every branch name it may have used (recorded → session-name → run-id), each filtered by `pickRunPr` + start time — what makes a hands-off web run (worktree gone, cloud pushed the run-id branch) resolvable.
- Actions: `commitSessionWork` (commit what the session left uncommitted, guarded), `pushRunBranch`, `openRunPullRequest` (pushes first; invalidates both PR caches after), `openSessionPullRequest` (refuses gone/empty; returns the existing PR), `runAutoHandoff` (#1102: the armed push/draft-PR at session end, reporting an `AutoHandoffOutcome` event, #835).
- The merge half (#1216): `HandoffIntent.merge` (absent = off, no checkbox mutates it) has `runAutoHandoff` call `ghMergePr` on the PR it just opened (number off gh's URL, lookup as fallback) — and on the `already-open` skip's OPEN PR, which is a rerun/restart finding its predecessor's PR. The outcome rides the handoff outcome as `merge`; a merge failure never fails the handoff (the PR is there either way).

## Problems

- The uncovered gap #799 fixed: a clean run archives history, commits, removes its worktree and leaves work on a branch — nothing pushed, nothing opened, dashboard showed none of it. Branch-addressing is what makes a finished session read the same whether its checkout still exists (a checkout-based read falls back to the project root and reports the *project's* branch as the session's).
- Two git range spellings mean opposite things (#1164/#1173): `base..branch` (log) is the branch's OWN commits — the three-dot symmetric-difference form also listed base-only commits, so merged sessions reported commits they did not make, `empty` stayed false, and "Open PR" failed with GitHub's "No commits between…". For the *diff* the three-dot form IS right (change since branch point, not vs a base that moved on).
- The agent is instructed to commit what it *found*, never what it *wrote*, so a settled session routinely holds its whole output uncommitted (#1173) — hence `pending`, and `commitSessionWork` before handoff.
- Auto-handoff must never open a duplicate PR: the cached lookup answers `prPending` rather than yes/no, which would read as "no PR" — so `runAutoHandoff` uses the UNcached `ghPrsForBranch` (proved against a real remote; only gh refusing the duplicate stopped it). It runs once per session and can afford to wait.

## Decisions

- `empty` counts bookkeeping as nothing (#1291): every run's branch carries `.the-framework/` records (the #326 pre-work commit sweeps in the conversation file), and publishing those alone produced junk PRs of pure paper trail. The *files* decide, not the commits.
- `pending` is absent (not 0) when no checkout was given: "nobody asked" and "asked, nothing pending" are different answers, and only the second may render as a clean tree.
- `commitSessionWork` guards twice — checkout must not be the project root (the `resolveRunCheckout` fallback once a worktree is gone, #453) and must sit on the session's branch — because both failure modes end with the *user's* own work committed for them.
- `prBaseName` strips `origin/` at the gh boundary only: the field holds a git ref (`origin/main`, what detectBase/log/merged checks need) while `gh pr create --base` wants a remote branch name and rejects `origin/main` with "Base ref must be a branch".
- `gitReason` surfaces git's own `fatal:`/`error:`/`remote:` line rather than execFile's "Command failed: git push …" preamble.
- Auto-handoff PRs are drafts on purpose (no review request in anyone's inbox); the interventions queue was taught to keep listing a session's draft, or it would be invisible in both places at once. The manual button opens ready-for-review (a PR a human asked for by name is asking for review). An armed merge (#1216) also opens ready: GitHub refuses to merge drafts, and the merge is armed precisely because the review happened before the run.
- `ARMED_HANDOFF` defaults both push and pr to true: the common case (session simply left alone) costs nothing.
- Commit subjects are parsed with a unit separator (`%x1f`) since a subject can hold anything.

## Facts

- `AutoHandoffOutcome` travels as an event (#835) because dashboard-started runs are spawned `stdio:'ignore'` — anything printed reaches nobody; skips are reported since silence reads as "ran and did nothing".
- Skip reasons: `not-armed`, `branch-gone`, `no-commits`, `no-remote`, `already-open`, `already-pushed`. An existing PR covers both halves (branch published + a place to answer).
- Default branch detection: `refs/remotes/origin/HEAD`, else the first of local `main`/`master`.
- `gh` prints the new PR's URL as its last stdout line.

## Flows

- read: `rev-parse --git-dir` → branch tip → remote presence → pending count → detectBase → parallel log/numstat/remote-tip/merged reads → cached PR pick → `RunHandoff`.
- auto-handoff: armed? → `readRunHandoff` (uncached PR) → skip checks → pr-armed: `openRunPullRequest` (push + draft PR, subsumes push half) | push-only: `pushRunBranch` → `AutoHandoffOutcome`.
