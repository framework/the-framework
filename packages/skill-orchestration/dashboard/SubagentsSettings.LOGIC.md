Settings → Subagents: which coding agent and model a main agent's [1] subagents [2] run on, by how hard the main agent says each task is, and how many of one main agent's subagents run at once. The same on every project, on this machine: read from one project that has the package, saved to every one of them.

## Context

**User story**: the user picks "Codex · GPT-5.6-Luna" for "Simple tasks"; the menu shows it at once, "Saving…" appears under the rows, and every project with the orchestration package now starts a simple task's subagent on that model.

**Business logic story**: the dashboard runs `orchestration settings` (to read) and `orchestration settings <json>` (to save) in a project for this section, as it runs any module's own command (`../src/cli.ts`). A save is the whole settings, never one part: the command replaces what was saved with what it is given.

**Problem**: a second pick made before the first is saved would, if built on what was last read, drop the first; two saves on their way at once could reach a project in the wrong order and leave the older one saved.

## Glossary

[1] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[2] subagent: a run started for a main agent [1]: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.
[3] subagent settings: the person's choice, on one machine, of the coding agent and model a task the main agent [1] calls simple runs on, the same for a task it calls hard, and how many of one main agent's subagents [2] run at once; one file, `.orchestration/settings.json` at the project's root, hidden from git.

## Business logic — TL;DR

- **Shown only where it applies** - nothing at all while no registered project has the package.
- **The rows** - "Simple tasks" and "Hard tasks", each a menu of choices (`choices.ts`), and "At once", 1 to 8 (or up to the saved number when it is higher).
- **Reading** - the subagent settings [3] from the first project, in the registry's order, whose command answers, every 10 seconds and when the projects change; nothing set reads as "Same as the main agent" for both levels and 4 at once; when no project answers, the section says why, naming the first that failed.
- **Saving** - a pick is shown at once and saved whole to every project that has the package; one save at a time, and only the latest pick waiting is sent next, built on every earlier pick.
- **A refused save** - names each project that refused and why; the menus show what is saved again.

## Business logic

### Reading

#### Context

See `## Context`.

#### Business logic

The section asks the projects it is given, in order, with `orchestration settings`, and shows the settings of the first that answers; projects that fail before it are passed over silently. When none answers, it shows nothing set and an alert: "The subagent settings could not be read: <project>: <reason>", for the first project that failed. The read is made again every 10 seconds, after each save, and when the projects it is given change.

With nothing set, "Simple tasks" and "Hard tasks" show "Same as the main agent" and "At once" shows 4 (`../src/levels.ts`).

### The rows

#### Context

See `## Context`.

#### Business logic

The section is titled "Subagents", with "The models a main agent's subagents run on, by how hard the main agent says each task is. The same on every project, on this machine." under the title. It holds three rows:

- "Simple tasks" ("A task the main agent marks simple."): the level `simple`'s choice (`choices.ts`).
- "Hard tasks" ("A task the main agent marks hard."): the level `hard`'s choice.
- "At once" ("How many of one main agent's subagents run at the same time. It starts the next when one ends."): a number from 1 to 8, or up to the saved number when that is higher than 8.

### Saving

#### Context

See `## Context`.

#### Business logic

A pick changes only its own part of the settings: a level's choice replaces that level's setting, "Same as the main agent" removes it, and "At once" sets the number. The settings with that change, whole, are what is saved. The menus show the pick at once and keep showing it until a read made after the last save brings the settings back, so the next pick is built on it: a second pick made before the first is saved keeps the first. "Saving…" shows under the rows while any save is on its way.

A save runs `orchestration settings <json>` in every project the section is given, all at once. Saves go one at a time: a pick made while a save is on its way waits, and when that save is done only the latest waiting pick is sent, which already holds every earlier pick. Once no pick waits, the settings are read again.

When one or more projects refuse a save, an alert says "The subagent settings were not saved: <project>: <reason>", every refusing project joined with "; ", and the menus go back to what was read last. The alert says how the latest save went: one refused, then overtaken by a later save that every project took, leaves no alert. The next pick clears it too. A project that saved stays saved: the projects can then hold different settings until the next save reaches them all.
