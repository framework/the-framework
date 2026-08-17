Effort: 1
Uncertainty: 2

# [Plan] Useless history in new session page?

Verification that #1536 already removed the questioned history panel, a gripe-by-gripe status, and a proposal to close the ticket with two optional residual cleanups.

## TLDR

The panel the ticket's screenshot shows — "Finished sessions in this project, newest first — from .the-framework/LOGS.md…" — was `ProjectLogPanel` (then in `packages/framework-dashboard/components/ProjectLogPanel.tsx`). Commit `9aff651` (PR #1536, merged 2026-08-17) deleted it, and deleted `LOGS.md` itself (simplification proposal B3: keep the exact session archives, drop the committed re-narration). Four of the ticket's five gripes are therefore resolved as a side effect; the fifth ("STOPPED" as noise) survives only in a different surface, the sidebar rail. Recommendation: close the ticket, optionally with two small cleanups.

## Gripe-by-gripe status (verified against HEAD, 2026-08-17)

1. **"Why show the history here? I don't see any benefits?"** — Resolved. The launcher (`dashboard/components/ProjectHome.tsx`) now renders only ProjectActions, StartAgentForm, AgentOverview (live status of a running agent, not history), OpenQuestions, and ProjectDocs. No history section exists; `ProjectLogPanel` is gone from the tree.
2. **Wordy caption** — Resolved with the panel; the string "Finished sessions in this project" no longer exists anywhere (`git grep` at HEAD is empty; last present at `9aff651^`).
3. **"STOPPED" reads as noise** — Mostly moot: the panel that showed it is gone. The word survives in the sidebar rail (`AgentHistory.tsx` → `AgentHistoryRow`, badge renders the raw `AgentStatus` uppercase; `lib/status-tone.ts` colors `stopped` as warning) and in the session status pill (`lib/agent-status.ts`). See Problems below.
4. **"[Build]" tag unexplained** — Resolved. The tag was the entry-kind prefix of `LOGS.md` lines; the writer (`logs.ts`) was deleted with B3 and no `[Build]` string remains in `packages/`.
5. **Sidebar history ≠ session-page history** — Resolved. There were two histories from two sources (rail from the agent store's `agent.json` files; panel from committed `LOGS.md`). Only the rail remains, so there is exactly one history surface and nothing to disagree with it.

## Problems

- **Does the surviving "STOPPED" badge in the sidebar rail still fall under this ticket?** The maintainer's gripe was written against the removed panel, but the rail shows the same word. Uncertain because it is a taste call only the maintainer can make, and because the codebase deliberately treats `stopped` as information, not noise: `agent-status.ts` ranks how a run ended above anything it claimed ("a green ready-for-merge must never describe an agent that then failed or was stopped"). Collapsing `stopped` into `DONE`, as the ticket floats, would misreport user-aborted runs as successful.

## Solutions

For the surviving badge, in preference order:

1. **Do nothing; close the ticket** (recommended). `stopped` ≠ `done` — it means a human aborted the run and its branch likely holds unfinished work. Hiding that inverts #1455-era decisions about honest status words. If the rail's rendering still bothers the maintainer, that is a new, precisely-scoped ticket about the rail, not this one.
2. **Soften the tone**: keep the word but render `stopped` in `text-muted-foreground` instead of warning, so it stops competing with `FAILED`. One-line change in `lib/status-tone.ts` + its test.
3. **Drop terminal badges entirely** in the rail (show a badge only for live states: running / waiting / publishing). Larger legibility change, touches `AgentHistoryRow` and tests; not worth it without an explicit maintainer ask.

## Considerations

- **Stale comments**: ~12 comments in `packages/the-framework/src` still describe `LOGS.md` as existing (`project-presets.ts:55` "only LOGS.md is committed by default", `overview.ts:11` "lastActivityAt from LOGS.md", `dashboard.ts:9`, `agent-store.ts:21`, `cli.ts:1084,1349`, `worktrees.ts:181`, `reads.ts:29`, `control.ts:162`, `projects.ts:52`, `framework-gitignore.ts:16`, `agent-handoff.ts:254`). Cosmetic, but each is now a small lie to the next reader. Sweeping them fits naturally in the closing commit (or can be skipped / folded into other #1536 follow-ups).
- `ProjectHome.tsx`'s header comment (lines 18–20) still says "the Docs + History panels moved out of the right rail into this column" although only Docs renders — same sweep.
- Projects that were used before B3 landed still carry a committed `.the-framework/LOGS.md` in their repos; nothing reads it anymore, and deleting it in user repos is not this codebase's job. No action.
- The screenshot cannot be re-verified live from a static check alone; a quick dashboard smoke run (`ProjectHome` for an existing project) would confirm no history section renders. Low value — the component is provably absent from the tree.

## Implementation

1. Confirm with the maintainer (ticket owner) that resolution-by-#1536 is acceptable — i.e. the answer to "why show the history here?" became "we no longer do".
2. Close the ticket: delete `tickets/2026-08-03_useless-history-new-session-page.md` (and this plan) per the ticketing convention, and close GitHub issue #1495 referencing #1536 / commit `9aff651` and this analysis.
3. Optional, same commit: sweep the stale `LOGS.md` comments listed above.
4. Only if the maintainer says the rail's `STOPPED` still bothers them: apply Solution 2 (muted tone) or open a new rail-scoped ticket for Solution 3.
