The "Onboarding" card: the five things a new install needs, each shown in the state it is actually in. A step is ticked only because a fact holds — a registered project, a non-empty agent queue [2], a ticket on disk, a granted browser permission, a Discord webhook held by the daemon — never because it was clicked, and each open step carries the action that gets it done, including a one-click first project and a one-click import of the project's GitHub issues.

## Context

**User story**: on first launch the user sees "Onboarding — 0 of 5 set up.", adds the directory the daemon runs in as a project with one click, fills `tickets/` from GitHub with another, and watches the rows tick as the facts change, even for steps done outside the dashboard. On the Overview [4] the card can be dismissed; the Settings [5] page always shows it, which is what dismissing promises.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[4] the Overview: the dashboard's cross-project page at `/`.
[5] Settings: the settings page.
[6] launcher: the Start form on a project's own page.
[7] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[8] prompt agent: an agent that runs one prompt and stops there.
[9] agent view: one agent's page.
[10] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.

## Business logic — TL;DR

- **Every "done" is a fact** - the card re-reads the dashboard's state every 10 seconds and derives each tick from it; nothing is ticked by clicking, and a step done elsewhere shows ticked anyway.
- **The card, its count and its dismissal** - "Onboarding" with "<n> of 5 set up."; on the Overview [4] an X hides it for good by writing the dismissal to the preferences [3], and the Settings [5] page always shows it.
- **"Add a project"** - done once any project is registered; offers "Add <directory> as project" for the directory the daemon runs in when it is not registered yet, and "Select & add project directory".
- **"Populate the queue of AI tasks"** - done once any project's agent queue [2] has an open entry; the one essential step with no button, it is done by agents.
- **"Populate tickets/"** - optional; done once any project has tickets; "Update from GitHub" starts an unattended [7] prompt agent [1] with the update-tickets preset on the target project and lands the user on it, or, through its chevron, opens that project's launcher [6] with the prompt.
- **"Add browser notifications"** - optional; done once the browser permission is granted and browser delivery is on; "Enable" turns delivery on and asks the browser for permission.
- **"Add Discord notifications"** - optional; done once the daemon holds a Discord webhook; "Add the webhook" opens the dialog that saves one.

## Business logic

### Every "done" is a fact

#### Context

**Problem**: a checklist ticked by hand tells the user nothing about the install; one derived from what is really there cannot lie, and follows work done outside the dashboard.

#### Business logic

The card re-reads the dashboard's cross-project state every 10 seconds (slower than the Overview's [4] own refresh, since onboarding changes at human speed) and the daemon's working-directory suggestion every 30 seconds. Each step's tick is derived from that state, as listed per step below. A done step shows a checked box (named "Done") and its label struck through, and hides its action; an open step shows an empty box (named "Not done", a square rather than a circle so the rows read as independent things to tick, not one choice among several) and its action on the right. Under each label sits a one-line description. A step nothing breaks without carries an "Optional" badge; only "Add a project" and "Populate the queue of AI tasks" are essential.

### The card, its count and its dismissal

#### Context

See `## Context`.

#### Business logic

The card is titled "Onboarding" with "<done> of 5 set up." under it. On the Overview [4] the header has an X button named "Remove, you can resume the onboarding on the settings page" (also its tooltip); clicking it writes the dismissal to the preferences [3], and the Overview no longer shows the card. The Settings [5] page renders the same card without the X.

### "Add a project"

#### Context

**User story**: the daemon was started inside a repository; the first step offers that very directory as the project, so the first project is one click.

#### Business logic

- Description: "A project is a git repo The Framework may work in." Done once at least one project is registered.
- When the daemon can name the directory it runs in and that directory is not registered yet, a primary button reads "Add <directory> as project" ("Adding…" while the add is in flight). The daemon registers it; on failure the daemon's own error is shown under the buttons in red, or "Could not reach the daemon." when the daemon did not answer. On success the card re-reads its state and the suggestion.
- "Select & add project directory" opens the add-project panel (`AddProjectPanel.tsx`); when a project is added there, the card re-reads as well.

### "Populate the queue of AI tasks"

#### Context

**Business logic story**: a filled agent queue [2] is what lets agents [1] keep going without the user; agents fill it (the triage and suggestion presets), so the step has nothing for the user to click.

#### Business logic

Description: "TODO_AGENTS.md is the queue: each entry is work the agent picks up on its own, so a filled queue is what lets it keep going without you." Done once the open entries across all projects number more than zero. No action is offered.

### "Populate tickets/"

#### Context

**User story**: the user clicks "Update from GitHub" and is taken to the agent [1] importing the project's issues as tickets, watching it work; or opens the launcher [6] first to pick the model and where it runs.

#### Business logic

- Description: "tickets/ holds the bigger things to work on, in the repo. The agent researches and plans them, and they are the input the queue is filled from." Optional. Done once any project has tickets.
- The target project is the one the daemon runs in when it is registered, else the first project of the dashboard's list. With no project at all both halves of the button are disabled and "Add a project first" is shown under it.
- The action is the shared split button "Update from GitHub" (`UpdateTicketsButton.tsx`), tooltip "Bring tickets/ up to date with GitHub. With no import on record, everything open comes across.". Its primary half starts a prompt agent [8] on the target project with the update-tickets preset's prompt, unattended [7], so it ends when its work settles instead of waiting in live chat. When the start succeeds, the user is taken to that agent's agent view [9]; the project travels with the navigation because this card has no project selected. When the daemon reports no agent id (a project without a checkout yet), the navigation carries none, and the shell adopts the running agent. A refused start (for example "An agent is already active for this project.", or "Failed to start the agent.") shows its reason under the button in red and moves the user nowhere. The primary half reads "Starting…" while its start is in flight.
- Its chevron, named "Other ways to update from GitHub", offers "Configure first, then run" ("Opens the launcher with the update prompt, so you can set the model and where it runs."): the prompt is left as a pending draft for the launcher [6] and the target project's page opens; nothing is started. The chevron stays usable while a start is in flight; both halves are out only when there is no project.

### "Add browser notifications"

#### Context

**User story**: with the dashboard open in a tab, an agent [1] waiting on the user pings the desktop instead of sitting unnoticed.

#### Business logic

- Description: "Desktop pings while the dashboard is open, so a session waiting on you does not sit unnoticed." Optional. Done when the browser's notification permission is granted and browser delivery is on in the preferences [3].
- The action depends on the browser's permission state: "Enable" while it is undecided or already granted, which turns browser delivery on in the preferences and, if the permission is still undecided, asks the browser for it (the request rides the click, as browsers require); "Blocked in your browser settings" when the permission is denied; "Not supported by this browser" when the browser has no notifications.

### "Add Discord notifications"

#### Context

**User story**: with no dashboard open at all, an intervention [10] still reaches the user on Discord.

#### Business logic

Description: "Delivers notifications to Discord, so an agent waiting on you reaches you with no dashboard open." Optional. Done when the daemon holds a Discord webhook; the fact is shared with the Settings [5] rows and the notifications bell so a webhook saved anywhere ticks this row too. "Add the webhook" opens the Discord webhook dialog (`DiscordDialogs.tsx`); after a save the shared fact is re-read.
