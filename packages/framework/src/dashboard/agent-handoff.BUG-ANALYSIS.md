# Bug analysis: packages/framework/src/dashboard/agent-handoff.ts

## Business logic (high-level)

Both halves of the end-of-session handoff (#799): the **read** (branch-addressed: existence, base,
own commits, changed files/line counts, remote/pushed/merged state, the PR, uncommitted leftovers)
and the **actions** (push, open PR, merge, commit leftovers, and the automatic end-of-session
handoff #1102 with the armed-merge ladder #1216/#1363/#1418 and the moved-past-PR rule #1512).

Key invariants from `agent-handoff.SPEC.md`, checked:

- **Branch-addressed read**: `readAgentHandoff` answers from the project repo for a named branch;
  `undefined` only for a non-repo; a gone branch still answers (`exists:false`) *with its PR* — the
  gone-branch early return performs the PR lookup and carries `pendingFiles` (computed before the
  tip check). ✓
- **Two git ranges**: commits from `base..branch` (own commits only — the #1164 regression is
  pinned by a real-repo test), diff from `base...branch` (since the branch point). ✓
- **Empty said out loud**: `commits.length === 0 || files.every(isBookkeepingPath)`. `every` on an
  empty files list is true, so commits whose net diff is empty also read as empty — consistent
  with "the files decide". Bookkeeping = `.the-framework/` prefix. ✓
- **Leftovers**: `countPendingWork` only when a checkout was given; absent ≠ `[]` ("nobody asked"
  vs "asked, clean"). `commitAgentWork` guards checkout≠projectCwd and current-branch===agent
  branch; idempotent via `commitPendingWork`'s clean-tree short-circuit. ✓
- **Recorded facts (E6)**: `resolveAgentPr` costs no lookup without a recorded PR; a live read with
  a *different* number is never the answer; an unconfirmable recorded PR answers number+URL with
  state UNKNOWN. Nuance: while the cached read is still warming (`pending`), the recorded PR is
  reported with state `'OPEN'` + `pending:true` — `mergeAgentPr` then passes its `state !== 'OPEN'`
  refusal and attempts the merge without knowing the real state. Consequence-checked: `gh pr merge`
  on a merged/closed PR fails and comes back as `ok:false` with gh's reason, and the refusal text
  ("already merged") does not match `DIRECT_MERGE_FALLBACK`, so no wrong merge can happen — only a
  rougher error message during the sub-second cache warm. Degraded UX, not reported.
- **Manual merge**: refuses no-PR and non-OPEN with reasons; drops both PR caches after success so
  the bar stops offering a landed merge (#1028). ✓
- **Auto-handoff**: skip ladder (not-armed / branch-gone / no-commits / no-remote / already-open /
  already-landed) each with a stated reason; deliberately *uncached* PR lookup (pending would read
  as "no PR" and open a duplicate); `latest` order for the moved-past comparison (#1512); open-PR +
  armed merge reruns only the merge half in `watch` mode; PR opens draft unless merge armed;
  failures reported per step; a failed merge rides a `done` handoff. All verified against the
  tests. ✓
- **Withheld merge**: `withheldMerge` = not-ready-for-merge before session-todo-open, undefined
  when both clear. ✓ (The caller enforcing it lives elsewhere.)
- **PR text**: title rungs prTitle → sessionName → `Session <id>`, `(fix #N)` appended; body is
  description || intent + session line; the prompt is deliberately not a rung. ✓

## Functions (low-level)

- `agentBranchFor` — recorded branch wins; legacy slashed fallbacks via the store's builders
  (correct: those runs predate #1581). Correct.
- `lookupAgentPr` — injected seam, else `cachedPrsForBranch` + `pickAgentPr(value, since)` with
  the **default `'first'` order** — see bug 1.
- `resolveAgentPr` — as analyzed above; correct modulo the benign pending-OPEN nuance.
- `mergeAgentPr` — resolve → refuse → `ghMergePr` → forget caches → ok with url+number. Correct.
- `isAgentBranch` — prefix convention, both spellings, never used to act. Correct.
- `soft` / `detectBase` — origin/HEAD, else local main/master; '' on failure. Correct.
- `parseCommits` — unit-separated `%H%x1f%s`; lines without the separator dropped; a subject
  containing 0x1f cannot realistically occur. Correct.
- `parseHandoffFiles` — shared numstat parser mapping. Correct.
- `isBookkeepingPath` — exact dir or prefix. Correct.
- `readAgentHandoff` — as analyzed; the four parallel reads are independent; `pushed` compares
  trimmed tips; `merged` via `branch --list --merged <base> <branch>` (branch names cannot start
  with `-`, no flag injection; array exec, no shell). Correct.
- `countPendingWork` — porcelain paths; `{}` when unasked/unanswerable. Correct.
- `commitAgentWork` — two guards then `commitPendingWork` (status→add -A→commit, retried).
  Correct.
- `pushAgentBranch` — `git push --set-upstream origin <branch>` from the project root; failure →
  `gitReason`. Correct.
- `prBaseName` — strips `origin/` (the module's fixed remote). Correct.
- `gitReason` — first fatal/error/remote line, else first line, else 'git failed'. Correct.
- `openBranchPullRequest` — push first, `pr create` (base converted, optional draft), forget both
  caches, URL = last stdout line, number parsed from it. Correct.
- `openRemoteBranchPullRequest` — remote-only branch: no push, default base, always draft; same
  cache-forget and URL/number handling. Correct.
- `movedPastPr` — false for OPEN, headless reads, or a gone branch (`commits[0]` absent); true
  only when the recorded head and the branch tip both exist and differ. `commits[0]` is the tip
  because `git log` lists newest first. Correct *given the right PR* — see bug 1.
- `openAgentPullRequest` — decision order: existing PR that still covers the tip → return it;
  gone branch → error; empty → refuse; else open (draft only if asked). The PR it decides against
  comes from `readAgentHandoff`'s `lookupAgentPr`, i.e. the `'first'`-ordered pick — bug 1. Also
  ignores the recorded `agent.pr` (E6) entirely; the recorded number would have been the correct
  comparand. When the cached lookup is still pending, `handoff.pr` is undefined and the code falls
  through to `openBranchPullRequest`; GitHub's own one-open-PR-per-head refusal is the backstop,
  so the worst case is an error message, not a duplicate — acceptable, noted.
- `agentAutoHandoff` — as analyzed under invariants; the `{ pr: agentPr, ...readDeps }` spread
  lets an injected seam win, which the tests rely on. Correct.
- `HandoffAgent` / `agentPrTitle` / `agentPrBody` / `prNumberFromUrl` — correct (regex anchors the
  number segment; `Number` on `\d+` is safe).

## Bugs found

1. `L560` (with the pick at `L135`): **the manual Open-PR path runs the #1512 moved-past decision
   against the `'first'`-ordered PR pick, which the module itself documents as wrong for that
   decision** — `pickAgentPr`'s doc: "there the oldest entry would call work that a second PR
   already landed unlanded". Scenario (the #1512 flow itself produces it): a session's PR #1 merges
   mid-run (head A), the session keeps committing, auto-handoff opens PR #2 for the new work and it
   merges too (head = branch tip). The user later presses Open PR (`sendOpenPullRequest` →
   `openAgentPullRequest`): `readAgentHandoff`'s `lookupAgentPr` → `pickAgentPr(prs, since)`
   defaults to `'first'` → PR #1; `movedPastPr` compares PR #1's head A against the tip → true →
   the existing-PR return is skipped; the branch exists and (post-squash) `base..branch` /
   `base...branch` are non-empty → not empty → `openBranchPullRequest` opens a **third PR
   duplicating work PR #2 already landed** (GitHub allows it: no open PR on the head, commits
   differ from base). `agentAutoHandoff` on the same state correctly skips `already-landed`
   because it passes `'latest'`. Probe-confirmed the divergence (first-order pick → #1,
   `movedPastPr` true; latest-order pick → #2, `movedPastPr` false). Contradicts
   `agent-handoff.SPEC.md` ("an existing PR that still covers the branch tip is returned as the
   answer instead of opening a second one") and the module's own "junk PR" stance. Side effect of
   the same root: the handoff panel (`onAgentHandoff`) shows PR #1 instead of the latest PR #2.
   Severity: major. Fix sketch: in `openAgentPullRequest` (or in `lookupAgentPr` when deciding,
   e.g. via an option), pick with `order: 'latest'` for the moved-past comparison — or consult the
   recorded `agent.pr` (E6) first, as `resolveAgentPr` does.
