Settings → Scheduler: the section this package adds to the dashboard's Settings page. It is drawn in groups that say what a setting reaches: "All projects" holds the spend cushion [3] as a number, "Spend offset", the one setting saved to every project; then each project that has the package has its own group, under its name, with one row per scheduled command, a checkbox for its schedule switch [2] and a menu for its publish pick [4]. Everything here is this machine's, read with `agent-scheduler status` and saved with `agent-scheduler offset`, `switch` and `publish`; what the schedule line says is the default.

## Context

**User story**: the project's tracked `agent-schedule.md` lists `- post-merge-cleanup: every 1d, off`; the user wants that clean-up to run on their own machine only, so they check "Run /post-merge-cleanup on a schedule" here, and from then on that project's scheduler starts it on this machine when it is due; a teammate's machine is unchanged. Likewise a user unchecks "Run /work-queue on a schedule" to keep their laptop from working the queue. The same file says `- work-queue: when \`npx queue\`, cap 1, publish merge`; a user who wants the queue's runs on their own machine to stop at an open pull request picks "Open PR" in that row's menu, and picks "As the file says (Merge on green)" to follow the file again; no tracked file changes either way. And a user who wants scheduled work to spend exactly so far ahead of the week's pace types the number rather than dragging the usage bar's handle to it.

**Business logic story**: a person decides, per machine, whether a command runs on its own, how far its runs publish and how far past the quota boundary scheduled work may start; the tracked schedule file stays the team's default. The section does not read `agent-schedule.md`: its rows are what each project's scheduler recorded at its last tick [5] (`schedulers.ts`). The dashboard gives the section the projects that have this package and runs this package's command for it; it knows nothing of what the section holds.

**Problem**: the section is one for every project, yet most of its settings are one project's: with several projects registered, a person must see at a glance which setting changes every project and which changes one.

**Problem**: every save is a separate process that reads the state [1], changes it and writes it back. Two at once could each write over the other's change.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the project's root, per user, hidden from git: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches and publish picks, the scheduler's pid, the last tick's decisions and the schedule it read. `agent-scheduler status` prints it, plus whether the scheduler's process is alive.
[2] schedule switch: a person's choice, on one machine, whether a scheduled command (a line of the project's `agent-schedule.md`) runs there; kept in the state, not in the schedule. The schedule line is the default where nobody switched the command: on, unless the line says `off`.
[3] spend cushion: how far past the quota boundary (the share of the account's quota week that may be spent by now) a scheduled run may still start, in percentage points of the week; the state's `spendOffset`. Positive is lenient, negative is strict. The dashboard calls it the spend offset.
[4] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: nothing, the branch, a pull request, or a pull request set to merge on its own once its checks pass; kept in the state, where it stands in for the level the command's schedule line says until the person takes it back.
[5] tick: one pass of the scheduler, every minute: one decision per scheduled command, each one line in the state.

## Business logic — TL;DR

- **Where it shows** - after the Settings page's own sections, at order 20, titled "Scheduler"; not at all while no registered project has the package.
- **What it reads** - `agent-scheduler status` in every project that has the package, when shown and every 10 seconds, and again after every save.
- **Groups** - "All projects" first, then one group per project under its name, with its scheduler's status and model beside the name and one line saying its settings are this machine's.
- **Saves go one at a time** - each save waits for the one before it; the row being saved is disabled until its save has answered; a refused save says which and why.
- **Spend offset** - under "All projects": the loosest spend cushion [3] any project holds, as a number from −50 to 50; a typed value is saved to every project once it has rested for half a second; projects holding another cushion are named with theirs.
- **A scheduled command's row** - under its project's name: "Run /<command> on a schedule", with the pace and how far its runs publish; a checkbox for its schedule switch [2] and a menu for its publish pick [4], "As the file says" taking the pick back; a project with no git host package is offered "Nothing" and "Publish branch" only.
- **A project that cannot be read, or has no schedule yet** - says so under its own name.

## Business logic

### Where it shows

#### Context

See `## Context`.

#### Business logic

The dashboard draws the section after its own Settings sections, among the installed packages' sections by order, this one at 20. Its title is "Scheduler" and its line reads "What each project's scheduler starts while nobody is at the keyboard, on this machine." Given no project (no registered project depends on the package), the section draws nothing at all.

### What it reads

#### Context

See `## Context`.

#### Business logic

The section runs `agent-scheduler status` in every project it was given (`schedulers.ts`), when it is first shown, every 10 seconds after, when the set of projects changes, and once more after each save, so a row shows what the scheduler holds rather than what was clicked.

### Groups

#### Context

See the first **Problem** in `## Context`.

#### Business logic

The section's rows sit in groups, each under a heading in capitals. The first group, "All projects", holds the spend offset and nothing else; it is absent while no project has answered a spend cushion [3]. Then comes one group per project the section was given, in the order given, headed by the project's name. Beside the name stand the scheduler's leading status as `schedulers.ts` says it ("on" in green, "on, not running" in amber, "off", "not readable" in red) and the model its scheduled runs start on. Under the name one line reads "On this machine only; agent-schedule.md sets the defaults." A project's group holds only that project's scheduled commands, so the same command scheduled in two projects is two rows, each saved in its own project.

### Saves go one at a time

#### Context

See the **Problem** in `## Context`.

#### Business logic

Every save, of the spend cushion, of a schedule switch or of a publish pick, joins one queue: it starts only when the save before it has answered. The row saved last is greyed, with its checkbox and menu disabled, until its save has answered; the rows are then read again. A save that was refused shows, under the rows, as an alert: "The switch was not saved: /<command>: <why>", "The publish pick was not saved: /<command>: <why>" or "The spend offset was not saved: <project>: <why>", the reason being what the command said. The next save clears the alert.

### Spend offset

#### Context

**User story**: the number is the same one the handle on the Overview's usage bar moves; the user types it here when they know the value they want.

#### Business logic

The one row of the "All projects" group is "Spend offset" ("How far every project's scheduler may start work past the quota boundary, in percentage points (max 50). Negative holds it back; positive lets it borrow from the days ahead. One number, saved to every project; the handle on the usage bar moves the same number."): a number box bounded to −50 and 50. It shows the spend cushion [3] in force, the loosest any project holds, rounded to one decimal. When projects hold different cushions (one was set by hand from the command line), the description goes on: "Shown: the loosest. <project> is at <its cushion>, …; saving sets every project to the same number.", naming each project whose cushion is not the one shown. The row is absent until a project has answered one. While the box has the focus it shows the text as typed, so a number can be typed through text that is no number yet (a minus sign alone); such text, and an empty box, change nothing. A typed number is rounded to whole points and held to −50..50, the reach of the usage bar's handle. Once the box loses the focus it shows that number, kept on the page until a read brings the same value back. It is saved once it has rested for half a second, since typing a number is several changes: the save runs `agent-scheduler offset -- <points>` in every project the section was given. A save that fails shows "The spend offset was not saved: <project>: <why>" and the box goes back to the value the schedulers hold.

### A scheduled command's row

#### Context

See `## Context`.

#### Business logic

Each project's group lists one row per scheduled command of that project, in its schedule's order. A row's label is "Run /<command> on a schedule" and its description "<pace> · <how far its runs publish>", the pace and the publish words as `schedulers.ts` says them, the publish words being the level in force on this machine.

The checkbox is checked when the command runs on this machine: its schedule switch [2] when this machine set one, else what its line says. Flipping it runs `agent-scheduler switch <command> on` or `… off` in that project.

The menu, labelled "What /<command> publishes" for a screen reader, lists first "As the file says (<level>)", where the level is what the command's schedule line says ("Nothing" for a line that says nothing, "Publish branch", "Open PR", "Merge on green"), then the picks the project is offered: all four in a project with a git host package, "Nothing" and "Publish branch" only in a project without one, and after them a pick already saved that the project is no longer offered. The menu shows this machine's publish pick [4] for the command when it has one, else "As the file says". Picking an entry runs `agent-scheduler publish <command> <nothing|branch|pr|merge>` in that project; picking "As the file says" runs it with `file`, which takes the pick back, so the command follows its schedule line again, whatever the line says then. A pick is kept until then, even when it says what the line says. Two machines may hold different picks for one command; each publishes its own runs by its own pick.

### A project that cannot be read, or has no schedule yet

#### Context

See the **Problem** in `schedulers.LOGIC.md`.

#### Business logic

A project whose status could not be read shows, in its own group, an alert: "The scheduler could not be read: <why>", and its heading says "not readable". That project lists no row and adds no spend cushion; with no project readable, the "All projects" group is absent too. A project that was read but whose scheduler never ticked with a schedule shows, in its group, "No scheduled command yet: this project's scheduler has not read a schedule."
