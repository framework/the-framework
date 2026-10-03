The Scheduler card this package adds to the dashboard's Overview: the scheduler of every project that has the package, one row per project, saying whether it is on and its process alive, its model, and what its last tick [2] decided, in the tool's own words. A decision that started a run opens that agent.

## Context

**User story**: the user left the scheduler on and wants to know, without a terminal, whether it is ticking and why nothing started ("work-queue: cap reached (1 in flight …)", "post-merge-cleanup: not due"), and to jump into the run it did start.

**Business logic story**: the card is a projection of each project's state [1], read through `agent-scheduler status` (`schedulers.ts`). It has no buttons: the scheduler is started and stopped by the project's own `open` and `close` hook lines when the dashboard opens and closes, and by hand from the command line.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the project's root, per user, hidden from git: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches and publish picks, the scheduler's pid, the last tick's decisions and the schedule it read. `agent-scheduler status` prints it, plus whether the scheduler's process is alive.
[2] tick: one pass of the scheduler, every minute: one decision per scheduled command, each one line in the state.

## Business logic

The dashboard draws the card on the Overview among the installed packages' cards, at order 90, after those that name no order. Given no project (no registered project depends on the package), the card draws nothing. Otherwise it is titled "Scheduler", with the line "Agents started on a schedule while nobody is at the keyboard, per project", and reads every given project's status when shown and every 10 seconds after; until the first answer it says "Loading…".

Each project is one row: its name; its status in one word and colour, "on" in green, "on, not running" in amber when the state says on but the scheduler's process is not alive, "off" muted, "not readable" in red when its status could not be read (the reason is then shown under the name); a "keep-alive" chip when the scheduler outlives the dashboard that started it; and, on the right, the model its scheduled runs start on.

Under a project that has ticked: "last tick <age>" (the exact time in a tooltip), followed by ": <note>" when the tick decided nothing and says why (no schedule file, a failed pull), then one line per decision, "<command>: <outcome>", in the scheduler's own words. A decision that started a run is a button that opens that agent's page in the dashboard; any other is plain text.
