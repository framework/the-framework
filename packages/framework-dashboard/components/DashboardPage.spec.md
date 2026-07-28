The Overview landing page (#1139): usage, Human Queue, Agents, AI Queue, routine work, and hot tickets — shown by the shell when no project is picked.

## TLDR

- Every section is a projection of the same `.the-framework` files over the `onDashboard` telefunc read, polled at 5s; `interventions` arrive from the shell as a prop.
- Layout: OnboardingChecklist (unless `onboardingDismissed`; dismissing hides it only here — the settings page keeps it, #958), then Quota first (the one figure governing what the agent may do next), then Human Queue beside Agents-over-AiQueue, then RoutineWork (#1159), then HotTickets.
- Navigation callbacks fan out: `onSelectProject`, `onSelectRun` (project + run — rows link straight into a session), `onOpenTicket` (#1144), `onRunStarted` (#1169/#1191).
- Inline `HumanQueue` card (#632): the cross-project things only a person can clear — open PRs (link out to GitHub; merge to confirm, close to reject), runs `awaiting` on a question (#636, opens the session), and `unpushed` finished work (#860, opens the session). #627 notifications fire off the same set.

## Decisions

- It replaced the denser #471 board (KPI tiles, activity chart, run outcomes, projects table), cut as redundant in #1139; the activity chart is meant to return later.
- Awaiting/unpushed rows fall back to `onSelectProject` only when `runId` is somehow absent, rather than doing nothing.
- An unknown `commits` count says nothing rather than the contradictory "0 commits".
- Rows with pinnable behavior live in their own tested files (`Agents.tsx`, `AiQueue.tsx`); this page has no test file.
