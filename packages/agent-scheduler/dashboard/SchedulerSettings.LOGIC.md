Settings → Scheduler: the section this package adds to the dashboard's Settings page. It holds one setting, the spend cushion [3] as a number, "Spend offset", the one setting saved to every project. It is this machine's, kept in each project's state [1], read with `agent-scheduler status` and saved with `agent-scheduler offset`. What each project's scheduler starts is not here: a scheduled command's schedule switch [2] and publish pick [4] are on the Automations page (`AutomationsPage.tsx`).

## Context

**User story**: a user who wants scheduled work to spend exactly so far ahead of the week's pace types the number here rather than dragging the usage bar's handle to it.

**Business logic story**: a person decides, per machine, how far past the quota boundary scheduled work may start. The number is one for every project, so it sits in Settings; what one project starts by itself is that project's own and sits on the Automations page. The dashboard gives the section the projects that have this package and runs this package's command for it; it knows nothing of what the section holds.

**Problem**: a save is one process per project that reads the state [1], changes it and writes it back. Two saves at once could each write over the other's change, and the older number could land last. And a save that fails must not stop the saves queued behind it.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the project's root, per user, hidden from git: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches, pace picks, agents picks and publish picks, the scheduler's pid, the last tick's decisions and the schedule it read. `agent-scheduler status` prints it, plus whether the scheduler's process is alive.
[2] schedule switch: a person's choice, on one machine, whether a scheduled command (a command one of the project's skills schedules in the front matter of its `SKILL.md`) runs there; kept in the state, not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[3] spend cushion: how far past the quota boundary (the share of the account's quota week that may be spent by now) a scheduled run may still start, in percentage points of the week; the state's `spendOffset`. Positive is lenient, negative is strict. The dashboard calls it the spend offset.
[4] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: nothing, a commit, the branch, a pull request, or a pull request set to merge on its own once its checks pass; kept in the state, not in the skill. Until the person picks, the command's runs commit their work and push nothing.
[5] Settings row: one line of a section of the Settings page: a label, a description and its controls.

## Business logic — TL;DR

- **Where it shows** - after the Settings page's own sections, at order 20, titled "Scheduler"; not at all while no registered project has the package.
- **What it reads** - `agent-scheduler status` in every project that has the package, when shown and every 10 seconds, and again after every save.
- **Spend offset** - the section's one Settings row [5]: the loosest spend cushion [3] any project holds, as a number from −50 to 50; a typed value is saved to every project once it has rested for half a second, one save at a time; projects holding another cushion are named with theirs; a save not taken says why, and the next one still saves.
- **A project that cannot be read** - is named in the section with the reason.

## Business logic

### Where it shows

#### Context

See `## Context`.

#### Business logic

The dashboard draws the section after its own Settings sections, among the installed packages' sections by order, this one at 20. Its title is "Scheduler" and its line reads "How far past the quota scheduled work may go, in every project, on this machine. What each project starts by itself is on the Automations page." Given no project (no registered project depends on the package), the section draws nothing at all. The section lists no scheduled command, and has no checkbox and no menu.

### What it reads

#### Context

See `## Context`.

#### Business logic

The section runs `agent-scheduler status` in every project it was given (`schedulers.ts`), when it is first shown, every 10 seconds after, when the set of projects changes, and once more after each save, so the Settings row [5] shows what the schedulers hold rather than what was typed.

### Spend offset

#### Context

**User story**: the number is the same one the handle on the Overview's usage bar moves; the user types it here when they know the value they want.

#### Business logic

The section's one Settings row [5] is "Spend offset" ("How far every project's scheduler may start work past the quota boundary, in percentage points (max 50). Negative holds it back; positive lets it borrow from the days ahead. One number, saved to every project; the handle on the usage bar moves the same number."): a number box bounded to −50 and 50. It shows the spend cushion [3] in force, the loosest any project holds, rounded to one decimal. When projects hold different cushions (one was set by hand from the command line), the description goes on: "Shown: the loosest. <project> is at <its cushion>, …; saving sets every project to the same number.", naming each project whose cushion is not the one shown. The Settings row is absent until a project has answered one. While the box has the focus it shows the text as typed, so a number can be typed through text that is no number yet (a minus sign alone); such text, and an empty box, change nothing. A typed number is rounded to whole points and held to −50..50, the reach of the usage bar's handle. Once the box loses the focus it shows that number, kept on the page until a read brings the same value back. It is saved once it has rested for half a second, since typing a number is several changes: the save runs `agent-scheduler offset -- <points>` in every project the section was given. Saves go one at a time: a save runs its command in every project, then the projects are read again, and the next save starts only after both. A save is not taken when a project's command refused it, or when the command could not even be asked (the dashboard could not be reached). A save a command refused shows, under the Settings row, the alert "The spend offset was not saved: <project>: <why>", the reason being what the command said; one that could not be asked shows "The spend offset was not saved: <why>". Either way the box goes back to the value the schedulers hold, and the saves queued behind it still run. The next save clears the alert.

### A project that cannot be read

#### Context

See the **Problem** in `schedulers.LOGIC.md`.

#### Business logic

Each project whose status could not be read shows, under the Settings row [5], an alert: "The scheduler of <project> could not be read: <why>". That project adds no spend cushion [3], and the number shown is the loosest of the projects that were read. With no project readable, the "Spend offset" Settings row is absent and only the alerts show.
