The `queue` skill's widget [1] for the dashboard: one page, Queue, listing the open entries of the agent queue [2] of every project that has this package, under the priority section each sits in; one card on the Overview, AI Queue, listing them in full with a way to start agents on them; and one link action [3], "Add to queue", offered on every link a dashboard page shows in a project that has this package. Both go through the same `queue` command an agent runs. The package exports the widget as `./dashboard` (`dist/dashboard/dashboard.js` and its stylesheet), which is how the dashboard finds it; the dashboard itself never names this package.

## Context

**User story**: the user clicks Queue in the dashboard's sidebar and sees, per project, what agents will work on next, in the order they will take it, grouped by priority. On the Overview the AI Queue card shows the same entries in full, and a click spins up an agent on one of them, or several agents on the top of a project's queue. On a ticket's page, or above a list of tickets, the user clicks "Add to queue" and the ticket is queued at its priority as a link back to it, the same line an agent writes with `npx queue add`. A project that does not depend on this package shows no queue here and no "Add to queue" button, and a dashboard with no project depending on it shows no Queue row and no AI Queue card at all.

**Business logic story**: the widget knows nothing of tickets or plans. A dashboard page shows a thing as a link (a text, where it points, how urgent it is); the widget's action turns any link into one queue entry. The rules of the label and of the action are in `src/widget.ts`, tested there; these files only bind them to React and to the dashboard's host.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages and Overview cards to the dashboard, offers actions on the links its pages show, and reads and changes its data through its own package's command.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] link action: one verb a widget offers on any link a dashboard page shows, done by the widget package's own command: the dashboard shows it as a button beside the link when the link's project has the widget's package.

## Business logic — TL;DR

- **The widget's definition** (`index.tsx`) - one page at `/queue`, labelled Queue with a list icon, one Overview card, AI Queue, placed at order 10 (before the tickets package's card), the one link action "Add to queue", and the stylesheet beside the module.
- **The Queue page** (`QueuePage.tsx`) - each project's open entries with their priorities from `queue --local --full`, read every 10 seconds, shown per project and per priority section, high to low, a failing project named with the command's reason; read-only.
- **The AI Queue card** (`QueueCard.tsx`) - every project's open entries from `queue --local`, read every 10 seconds and shown in full; a play button starts one agent on one entry and lands on it; a count and a fan-out button start that many agents on the top of a project's queue without leaving the Overview, stopping at the first refusal.
- **The card under test** (`test-host.tsx`) - a fake host whose commands answer from a table and whose every service is a spy, so the card is tested without a dashboard.
- **The "Add to queue" action** (`add-to-queue.ts`) - each link queued as one `queue add` of `[text](href)`, or the plain text when it points nowhere, in its priority's section; the batch stops at the first failure.
- **Built to share, not to bundle** (`vite.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `dashboard.css`, `tsconfig.json`) - the module leaves React and `framework/widget` as bare imports the dashboard supplies, and its stylesheet holds only its own utilities, coloured by the dashboard's theme file; these files carry no business logic beyond that.
