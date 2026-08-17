Effort: 1
Uncertainty: 2

# [Plan] Unclear UX: what should I do now?

The ticket's settled direction has already shipped piece by piece; what remains is verifying the flow end-to-end, closing GitHub issue #1173, and removing the ticket.

## TLDR

Every follow-up from the issue thread is implemented in the current codebase (see the audit below). The launcher-gear cleanup was superseded by a later, better design (the publish ladder, #1379) that resolves the same complaint. The implementation left is: a quick live verification of the settle flow, a closing comment on #1173 (still open, `state_reason: reopened`), and deleting the ticket files.

## Audit: thread direction → current code

The issue thread (6 comments, ending 2026-07-25) settled on: favor autonomy, default to opening a PR, auto commit & push (safe — every run is on its own branch), don't offer `Open PR` on a no-diff branch (say so, name the uncommitted work), postpone the `Auto commit`/`Auto push` settings split.

1. **Button appears once the agent settles** — shipped in PR #1178 (merged), acknowledged in the ticket.
2. **Commit the work a session left behind** — shipped in PR #1185 (merged). Today: `commitPendingWork` sweeps leftovers when the worktree is removed (`src/worktrees.ts:127`) and on the CLI path (`src/cli.ts:989`); `commitAgentWork` (`src/dashboard/agent-handoff.ts:386`) does the same when the dashboard button is pressed mid-session. No await gate — the maintainer overruled "ask first" in favor of autonomy, and that is what the code does.
3. **Default `[x] Open PR`** — `DEFAULT_HANDOFF = 'pr'` (`src/handoff-level.ts:31`): a session left alone pushes its branch and opens a draft PR, zero-config (#1102).
4. **No `Open PR` on a no-diff branch; name the uncommitted work** — `AgentHandoff.pendingFiles` (`src/dashboard/agent-handoff.ts:93`, explicitly tagged #1173) plus the `empty` guard; the bar renders "Nothing committed — <files> left uncommitted" instead of a button (`dashboard/components/AgentHandoff.tsx:210`), and `openAgentPullRequest` refuses with a clear error rather than letting GitHub answer "No commits between main and <branch>".
5. **Launcher gear cleanup ("one row: Open PR")** — superseded by the publish ladder (#1379): `Push branch` / `Open PR` / `Auto-merge` as three views of one stored ordinal (`dashboard/lib/agent-option-rows.ts`), with strict gating instead of the confusing greyed-out equal boxes the thread complained about. Push-without-PR stays reachable (a real rung), and `the-framework.yml` can still set the level — the thread's requirement, met by a later design rather than the sketched quick fix.
6. **Postpone the commit/push settings split** — done by postponing; the ladder then settled the settings question differently and better. No `Auto commit`/`Auto push` pair exists or is needed.

## Problems

- **Is a fresh UX pass needed before closing?** The issue was reopened once already from a screenshot. Everything named in-thread is implemented, but nobody has re-run the original scenario ("agent finished, edited files, never committed") against the current UI. Low uncertainty: the code paths and their tests (`agent-handoff.test.ts`, `AgentHandoff.test.tsx`) cover exactly these states; a manual pass is cheap insurance, not a design question.
- **One arguably-remaining dead end**: a branch with zero commits and only uncommitted work names the files but offers no action. That is *by design* — the thread's direction was "say so, and name the uncommitted work", and `commitAgentWork` deliberately never turns "nothing committed" into a PR by itself. The auto-commit paths (item 2) should make this state rare (only reachable when guards refuse, e.g. checkout gone or on a foreign branch). Recommendation: close as-is; if the state shows up in practice, that is a new ticket ("offer Commit & open PR on a commits-less branch with pending work"), not this one.

## Implementation

1. **Verify** (optional but recommended, ~15 min): run a session that leaves uncommitted work; confirm (a) the settle bar names the pending files instead of offering `Open PR`, (b) the auto-handoff commits the leftovers and opens a draft PR on the way out, (c) the launcher gear shows the ladder with sensible gating.
2. **Close GitHub issue #1173** with a short comment mapping each thread follow-up to what shipped (the audit above), so the reopen history ends with a paper trail.
3. **Remove the ticket**: delete `tickets/2026-07-25_unclear-ux-what-now.md` and this plan file, per the ticket lifecycle (closed tickets leave the repository).

No code changes are expected. If step 1 turns up a regression, that is new information: file it as its own ticket rather than stretching this one further.
