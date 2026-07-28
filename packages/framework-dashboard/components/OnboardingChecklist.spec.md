The onboarding checklist card (#958): the integrations a new install needs, each row's "done" derived from a real observed fact rather than a clickable tick.

## TLDR

- Six steps: add a project, populate the TODO_AGENTS.md queue, populate `tickets/` (GitHub import), Discord bot, browser notifications, Discord webhook. The last four are `optional` (#1139); only the two the agent cannot work without are unmarked.
- Done-ness sources: project count / open todos / `hasTickets` from `onDashboard` (polled 10s), Discord credentials from the shared `useNotifyChannels` store (#1095 — a credential saved in a dialog below ticks its row here too), browser from granted permission + preference.
- Renders in two places: the Overview, dismissible (`onboardingDismissed` preference), and the settings page, not dismissible — which is what dismissing promises you can come back to.
- `onOnboarding` (polled 30s) suggests the daemon's cwd as a project; the target project for actions is the cwd's project, else the first registered — onboarding is a first-run flow, rarely a second candidate.
- "Import tickets from GitHub" starts a run with `presets.importTickets.render()` via `useStartRun`, `unattended: true` (#1279: a checklist-fired routine ends at settle instead of parking in the chat loop), then calls `onRunStarted(projectId, intent, runId)` so the shell lands on the session (#1169); a refused start stays put and shows `startError`.
- Wires `AddProjectPanel`, `DiscordBotDialog`, `DiscordWebhookDialog` (descriptions shared from `DiscordDialogs`); saves reload the shared channels store.

## Decisions

- Every mark is derived state: a step cannot be ticked by clicking, and one done outside the dashboard shows up ticked anyway.
- `optional` is marked per step, not by list position, so reordering the list cannot move the promise.
- Checkbox icons (Square/SquareCheckBig), not circles: an outlined circle reads as a radio button — one of a set to pick between — when these are independent things to tick (#1139).
- `onRunStarted` is a required prop (with the projectId travelling in it) so a new mounting surface cannot quietly drop the navigation; neither mounting surface has a project selected, so an id alone could not be routed.
- Polls slower than the Overview's 5s: onboarding state changes at human speed, and the dashboard read fans out over every project to answer the tickets question.
