The Automations page: the page this package adds to the dashboard, at `/automations`. It lists what starts by itself while nobody is at the keyboard: one group per project the page is given (every project that has the package, or the picked project [7] alone when one is picked in the dashboard), and in it one page row [6] per scheduled command of that project. A page row says what the command is, what its skill says it does, when it runs, how far its runs publish and what the scheduler last decided for it. Its checkbox is the command's schedule switch [2], and "Edit" opens the page row in place to set the command's publish pick [3]. Everything here is this machine's, read with `agent-scheduler status` and saved with `agent-scheduler switch` and `publish`. A scheduled command is off until its checkbox is checked here, and its runs commit their work and push nothing until another publish pick is saved here.

## Context

**User story**: the project's `post-merge-cleanup` skill schedules a clean-up after merges. Like every scheduled command it is off on every machine until someone switches it on there. The user opens Automations, reads under the project's name what `/post-merge-cleanup` does and when it runs, and checks its checkbox: from then on that project's scheduler starts it on this machine when it is due, and a teammate's machine is unchanged. Likewise a user unchecks `/work-queue` to stop their laptop from working the queue. A user who wants the queue's runs on their own machine to open a pull request presses "Edit" on `/work-queue`, picks "Open PR" and presses Save. No tracked file changes either way. Later the user comes back and reads, on each page row, why nothing started ("No work", "One is already running") or opens the run that did start.

**Business logic story**: a person decides, per machine, whether a command runs on its own and how far its runs publish; the project's skills only say which commands are scheduled, what each does and when each is due. The page does not read the skills: its page rows are what each project's scheduler recorded at its last tick [4] (`schedulers.ts`). The dashboard gives the page its projects, the projects that have this package or the picked project [7] alone, and runs this package's command for it; it knows nothing of what the page holds. The one setting that reaches every project, the spend offset, is not here: it is in the Scheduler section of the Settings page (`SchedulerSettings.tsx`).

**Problem**: every save is a separate process that reads the state [1], changes it and writes it back. Two at once could each write over the other's change.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the project's root, per user, hidden from git: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches and publish picks, the scheduler's pid, the last tick's decisions and the schedule it read. `agent-scheduler status` prints it, plus whether the scheduler's process is alive.
[2] schedule switch: a person's choice, on one machine, whether a scheduled command (a command one of the project's skills schedules in the front matter of its `SKILL.md`) runs there; kept in the state, not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[3] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: nothing, a commit, the branch, a pull request, or a pull request set to merge on its own once its checks pass; kept in the state, not in the skill. Until the person picks, the command's runs commit their work and push nothing.
[4] tick: one pass of the scheduler, every minute: one decision per scheduled command, each one line in the state.
[5] the skill's `schedule`: the key `schedule` in the front matter of a skill's `SKILL.md`, where the skill says which commands it schedules.
[6] page row: one line of the Automations page: one scheduled command of one project, with its checkbox and its "Edit". It is not a row of a skill's `schedule` [5], which the page never reads.
[7] picked project: the one project the dashboard's project select, the menu at the top of the sidebar, names. The sidebar then lists only the pages, and the Overview draws only the cards, added by the packages that project has, and every page shows only that project's data. When the select says "All projects", no project is picked, the sidebar lists the pages added by every project's packages and every page shows every project's data.

## Business logic — TL;DR

- **Where it shows** - a sidebar row "Automations" and the URL `/automations`; titled "Automations".
- **What it reads** - `agent-scheduler status` in every project the page is given (every project that has the package, or the picked project [7] alone), when shown and every 10 seconds, and again after every save.
- **A project's group** - one per project, under its name, with "Scheduler <status>", the model and "last tick <age>" beside the name, followed by why that tick [4] decided nothing when it says; under the heading, one line when the scheduler is off, or on with no live process, saying nothing here starts and how the scheduler starts.
- **A page row** - `/<command>`, what its skill says it does, cut after two lines, and one line: when it runs, how far its runs publish, and what the scheduler last decided for it; a decision that started a run opens that agent.
- **The checkbox** - the command's schedule switch [2]; flipping it saves at once.
- **Edit** - opens the page row in place: a menu of the publish picks [3] the project is offered, a sentence that follows the menu, Cancel and Save; nothing is saved until Save, and Save with nothing changed saves nothing.
- **The keyboard** - opening a page row puts the focus on the menu; Escape closes it like Cancel; closing puts the focus back on the page row's "Edit".
- **Saves go one at a time** - each save waits until the one before it has answered and the status has been read again; a page row is held, greyed and disabled, until its own saves have answered and been read back; a save not taken says why on its own page row, and the next save still runs.
- **A skill whose `schedule` cannot be read** - named above the project's page rows, with the reason.
- **A project that cannot be read, or has nothing to list** - says so under its own name.

## Business logic

### Where it shows

#### Context

See `## Context`.

#### Business logic

The module's definition (`index.tsx`) gives the page the URL `/automations` and a sidebar row "Automations". The page is headed "Automations", with the line "What starts by itself while nobody is at the keyboard. Your choices, on this machine. Every row starts switched off." Until the first read has answered it says "Loading…".

### What it reads

#### Context

See `## Context`.

#### Business logic

The page runs `agent-scheduler status` in every project it was given (`schedulers.ts`): every project that has the package, or the picked project [7] alone when one is picked in the dashboard. It reads when it is first shown, every 10 seconds after, when the set of projects changes, and once more after each save, so a page row shows what the scheduler holds rather than what was clicked.

### A project's group

#### Context

**User story**: with several projects registered, the user must see at a glance which project a scheduled command belongs to, and whether that project's scheduler is running at all. A checkbox checked in a project whose scheduler is not running starts nothing, and the page must say so.

#### Business logic

The page draws one group per project it was given, in the order given, headed by the project's name. Beside the name stand:

- "Scheduler " and the scheduler's leading status as `schedulers.ts` says it: "Scheduler on" in green, "Scheduler on, not running" in amber, "Scheduler off", "Scheduler not readable" in red.
- The model the project's scheduled runs start on, when the state [1] names one.
- "last tick <age>" once the scheduler has ticked [4]: how long ago its last tick was ("last tick 1m ago"), with the exact time in a tooltip. It is followed by ": <note>" when that tick decided nothing per command and says why ("last tick 1m ago: agent-data could not be pulled: …"). Two notes are not shown there: `off`, since "Scheduler off" beside the name says it already, and `no skill of this project schedules a command`, since the group says it in its own words below.

Under the heading, a project that was read shows one line when its scheduler starts nothing:

- The scheduler is off: "The scheduler is off in this project, so nothing here starts. It starts with the dashboard once the project has run `npx agent-scheduler init`, or by hand with `npx agent-scheduler start`."
- The scheduler is on and its process is not alive, in amber: "The scheduler is on but its process is not running, so nothing here starts. `npx agent-scheduler start`, run in the project, starts it."

A project's group holds only that project's scheduled commands, in its schedule's order. The same command scheduled in two projects is two page rows [6], each saved in its own project.

### A page row

#### Context

**User story**: the user reads the page without reading the skill that schedules the command, or its check, which is a shell line.

#### Business logic

A page row [6] shows, from the top:

- The command as a person types it, `/<command>`.
- What its skill says it does, in the skill's own words, when the skill says (`schedulers.ts`). Text longer than two lines is cut after the second.
- One line of two or three parts, separated by "·":
  1. When the command runs, as `schedulers.ts` says the pace: "Every 1 day", "When the queue holds a task", "Every 6 hours at most, when a ticket has no plan".
  2. How far its runs publish on this machine, by its publish pick [3]: "Commits its work" for a command nobody picked for, "Opens a pull request", "Publishes nothing".
  3. What the scheduler last decided for the command, as `schedulers.ts` says it for a person: "Off" for a command switched off on this machine, "No work", "Started a run", "Started 2h ago, not due yet", "One is already running", else the tool's own words with a capital ("Quota: …", "Check failed: …"). This part is absent for a command that is switched on and that no tick [4] has decided yet.

"Started a run" is a button that opens that agent's page in the dashboard; every other decision is plain text.

On the right of the page row stand "Edit" and the checkbox.

A scheduled command whose skill is only under `.agents/skills` is listed like any other, since the tick records it. Its page row says why it never starts ("Cannot start: its skill is only in .agents/skills, which Claude Code does not read"), whether its checkbox is checked or not: checking it starts nothing.

### The checkbox

#### Context

See `## Context`.

#### Business logic

The checkbox, labelled "Run /<command> by itself" for a screen reader, is checked when the command runs on this machine: only once its schedule switch [2] was switched on here. Flipping it runs `agent-scheduler switch <command> on` or `… off` in that project, at once, with no Save.

### Edit

#### Context

**User story**: how far a command's runs publish decides what leaves the machine, so the user picks it, reads what the pick means, and only then saves it.

#### Business logic

"Edit" opens the page row [6] in place. The command and what its skill says it does stay; the one line and "Edit" give way to a box holding:

- A menu, "What its runs publish". It opens on this machine's pick for the command, "Commit" where nobody picked. It lists the publish picks [3] the project is offered, as `schedulers.ts` says them: all five ("Nothing", "Commit", "Publish branch", "Open PR", "Merge on green") in a project with a git host package, "Nothing", "Commit" and "Publish branch" only in a project without one. The pick the menu shows is listed after them when the project is not offered it: a command whose pick in force is "Open PR" in a project without a git host package opens on "Open PR", and once the person picks another entry "Open PR" is no longer listed.
- A sentence that follows the menu: when the command runs and how far its runs would publish with the pick the menu shows ("Every 1 day. Opens a pull request.").
- The note "Saved for you, in this project, on this machine. No tracked file changes."
- "Cancel" and "Save".

Changing the menu saves nothing. "Cancel" closes the page row and saves nothing. "Save" with the menu on the pick already in force closes the page row and runs nothing. "Save" with another pick runs `agent-scheduler publish <command> <nothing|commit|branch|pr|merge>` in that project. The page row closes once the save was taken and the status has been read again, so the closed page row shows the new pick. A save not taken leaves the page row open, with the reason under it (see "Saves go one at a time").

One page row is open at a time: "Edit" on another page row closes the open one, and its unsaved pick is dropped. A save that answers closes only its own page row: when the person opened another page row while the save was in flight, that one stays open with its pick. The checkbox stays where it is while the page row is open.

A pick is kept until another replaces it. Two machines may hold different picks for one command; each publishes its own runs by its own pick.

### The keyboard

#### Context

**User story**: a user who works the page from the keyboard presses "Edit", picks, and saves or backs out, without reaching for the mouse and without losing their place.

#### Business logic

Opening a page row [6] puts the focus on its menu. Escape, pressed anywhere in the open box, closes the page row like "Cancel": nothing is saved; while the page row is held for a save, Escape does nothing, as "Cancel" does nothing then. Every way of closing a page row ("Cancel", Escape, a save that was taken, "Save" with nothing changed) puts the focus back on that page row's "Edit". A save that is taken after the person opened another page row closes nothing and leaves the focus where it is.

### Saves go one at a time

#### Context

See the **Problem** in `## Context`.

**Problem**: a page row that came back before the status was read again would show the old value for a moment, as if nothing had been saved. And a save that fails must not stop the saves queued behind it.

#### Business logic

Every save, of a schedule switch [2] or of a publish pick [3], joins one queue. A save runs its command, then the status of every project is read again; the next save starts only after both. A page row [6] is held, greyed, with its checkbox, its "Edit", its menu, "Cancel" and "Save" disabled, from the click until its save has answered and the status has been read again, however many of its saves are queued. Only that page row is held: the same command in another project is not.

A save is not taken when the command refused it, or when the command could not even be asked (the dashboard could not be reached). Either way the page row comes back, and under it an alert says why: "The switch was not saved: <why>" or "The publish pick was not saved: <why>", the reason being what the command said, or why it could not be asked. The line sits on its own page row, so it names neither the command nor the project. The next save of that page row takes the line away. The page shows one such line at a time: a later save not taken on another page row replaces it. The saves queued behind a save not taken still run.

### A skill whose `schedule` cannot be read

#### Context

**Problem**: a skill whose `schedule` [5] cannot be read gives no scheduled command, so it has no page row. Without a word about it, a person would search the page for its command and find nothing.

#### Business logic

For each skill the project's last tick [4] could not read (`schedulers.ts`), the project's group shows an alert above its page rows: "The schedule of the <skill> skill cannot be read, so it is not listed: <reason>", the reason being the tick's ("row 2: unknown key evry"). The project's other scheduled commands are listed as usual.

### A project that cannot be read, or has nothing to list

#### Context

See the **Problem** in `schedulers.LOGIC.md`.

#### Business logic

A project whose status could not be read shows, in its own group, an alert: "The scheduler could not be read: <why>", and its heading says "Scheduler not readable". That project lists no page row; the other projects still show.

A project that was read, lists no scheduled command and names no skill whose `schedule` cannot be read shows one of two lines in its group, and no list:

- Its scheduler has not ticked [4] yet: "Nothing here yet: the scheduler of this project has not looked at its skills."
- Its scheduler has ticked: "Nothing here: no skill of this project says it can be scheduled."
