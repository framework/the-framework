Settings → Subagents over the registered projects: which subagent settings [1] are in force, read off the projects' files, and saving them whole through every project's subagents hook [2]. The settings are the same on every project; the daemon names no tool.

## Context

**User story**: the user picks a coding agent and model for hard tasks in Settings → Subagents; every project's `orchestration` command then starts a main agent's hard tasks on it, on this machine. The page shows what is saved.

**Problem**: the settings are kept per project, by a tool The Framework must not name, while the user sets them once for all projects. A save that reached no project, or failed in one, must not look like it worked.

## Glossary

[1] subagent settings: a person's choice, on one machine, of the coding agent and model a main agent's subagents run on, one for a task the main agent calls simple and one for a task it calls hard, and how many of one main agent's subagents run at once; kept in `.orchestration/settings.json` at each project's root (`../subagent-settings.ts`).
[2] subagents hook: the one shell line under `subagents` in a project's `.the-framework/hooks.yml`, given the settings as one JSON value in `SUBAGENTS`, to be saved whole; for example `npx orchestration settings "$SUBAGENTS"`.

## Business logic — TL;DR

- **The settings in force** - those of the first project, in registry order, that has the subagents hook [2] and a settings file that parses, keeping only what has the promised shape; none when no such project; with the count of projects that have the hook.
- **Saving** - the settings, cut to the promised shape, go whole to every project's subagents hook; a project without the line is skipped; none having it, or a line that fails, is an error in words.

## Business logic

### The settings in force

#### Context

**Business logic story**: Settings writes every project alike, so the projects' files differ only where one was edited by hand, or a project was added later; one project's file stands for all.

#### Business logic

The projects are looked at in the order given (registry order). A project whose hooks file has no subagents hook [2] is passed over, its settings file too. Among those that have it, the first whose `.orchestration/settings.json` exists and parses as JSON gives the settings, each field kept only when it has the promised shape (`../subagent-settings.ts`); a file that does not parse is passed over, and the next project's may say. The answer is those settings, or none (`{}`) when no project gave any, together with `hooked`: how many projects have the subagents hook, every project counted, not only those up to the one that gave the settings. `hooked` of 0 means Settings can save nothing.

### Saving

#### Context

See `## Context`.

#### Business logic

The settings given are first cut to the promised shape (`../subagent-settings.ts`): an unknown coding agent, a blank model or a limit below one is dropped, so a project's hook line is only ever given settings it can save. Then every project's subagents hook [2] is run, one project after another in the order given, with those settings (`../project-hooks.ts` runs the line). A project whose hooks file has no such line is skipped. The answer is an error when any line failed, naming each failing project as "<project name>: <why>", joined by "; " (a broken hooks file counts as a failure); otherwise an error "no project has a subagents hook in .the-framework/hooks.yml" when no project had the line, including when there is no project; otherwise success. Lines that succeeded are not undone when another fails.
