The Overview [1], the dashboard's landing page shown while no project is selected: an at-a-glance board of the onboarding checklist until it is dismissed, the quota [2] first, then side by side the "Human Queue" of interventions [3] only a person can clear and, stacked beside it, the agents [4] working now over the "AI Queue" of what agents take up next, followed by the routine [5] work and the hot tickets across every project. The board's agents and queues are re-read from the daemon every five seconds; the interventions arrive from the shell, the same set that fires the notifications. Every row jumps into its project, its agent, its ticket or its pull request.

## Context

**User story**: the user opens the dashboard and sees in one screen how much quota is left, what needs their approval or review, which agents are working, what the agents will pick up next, when the routines last ran, and which tickets are hot; one click takes them to the thing itself.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[3] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[6] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[7] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic — TL;DR

- **The board's order** - onboarding checklist (until dismissed), the quota card, then the "Human Queue" beside the "Agents" card stacked on the "AI Queue" card, then "Routine work", then the hot tickets.
- **The Human Queue** - the interventions across every project, three kinds of row: "Awaiting" opens the agent parked on a gate, "Unpushed" opens the agent whose commits never left the machine, and a pull request row opens it on GitHub; "AI doesn't need you." when empty.
- **Dismissing the checklist** - hides it on the Overview only; the Settings page keeps it.

## Business logic

### The board's order

#### Context

See `## Context`.

#### Business logic

From top to bottom: the onboarding checklist while it is not dismissed (`OnboardingChecklist.tsx`); the quota [2] card, first because it is the one figure that governs everything an agent [4] may do next (`Quota.tsx`); then two columns: the "Human Queue" on the left, and on the right the "Agents" card (`Agents.tsx`) over the "AI Queue" card of every project's open entries on the agent queue [7] (`AiQueue.tsx`); then the routine [5] work card with its scheduled jobs and the button that fires one now (`RoutineWork.tsx`); then the hot tickets (`HotTickets.tsx`). The working agents and the per-project queues come from one daemon read that is repeated every five seconds; until the first read answers, the cards that depend on it show their loading state. An agent started from the checklist, the queue or a routine card lands the user on that agent.

### The Human Queue

#### Context

**Business logic story**: the same interventions [3] that fire the "needs you" notifications are listed here, across every project; what counts as one is decided in `src/dashboard/interventions.ts`.

#### Business logic

The card is titled "Human Queue", with a count badge when there is at least one item, and described as "Agents awaiting your approval, review, or input". With nothing to clear it reads "AI doesn't need you.". Each row shows its title and, at the right, its project's name, and is one of three kinds:
- "Awaiting": an agent [4] paused on a gate [6]. The tooltip reads "Open the agent to answer" and the click opens that agent's page.
- "Unpushed": a finished agent whose branch holds commits that were never pushed. The row adds "1 commit" or "N commits" when the count is known and above zero, and says nothing about commits otherwise rather than a contradictory "0 commits". The tooltip reads "Open the session: work on <branch> was never pushed" and the click opens that agent's page.
- A pull request: "#<number>" then its title; the row is a link that opens the pull request on GitHub in a new tab, with the tooltip "Open PR #<number> on GitHub".
An "Awaiting" or "Unpushed" row that somehow names no agent opens the project instead of doing nothing.

### Dismissing the checklist

#### Context

**Problem**: the checklist is a first-day guide on the landing page, but its steps stay useful as a reference.

#### Business logic

Dismissing the onboarding checklist hides it on the Overview only, as the dismiss control says; the Settings page keeps showing it. The choice is a preference, so it holds across reloads.
