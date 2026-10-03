What Settings → Subagents asks the daemon: the subagent settings [1] in force with how many projects have the subagents hook [2], and saving the settings whole through every registered project's subagents hook. The work over the projects is `../dashboard/subagent-settings.ts`'s; this file hands it the registered projects.

## Context

**User story**: the user opens Settings and sees which coding agent and model a main agent's simple and hard tasks run on, and how many run at once; a pick there saves them for every project on this machine.

## Glossary

[1] subagent settings: a person's choice, on one machine, of the coding agent and model a main agent's subagents run on, one for a task the main agent calls simple and one for a task it calls hard, and how many of one main agent's subagents run at once; the project's `orchestration` command keeps them in `.orchestration/settings.json` at the project's root.
[2] subagents hook: the one shell line under `subagents` in a project's `.the-framework/hooks.yml`, given the settings as one JSON value in `SUBAGENTS`; for example `npx orchestration settings "$SUBAGENTS"`.

## Business logic — TL;DR

- **Reading the settings** - the settings of the first registered project that has the subagents hook [2] and a settings file, and how many projects have the hook; no settings and none hooked when the list of projects cannot be read.
- **Saving the settings** - the settings go whole to every registered project's subagents hook; a project without the line is skipped; none having it, or a line that fails (each failing project named), is an error in words. When the list of projects cannot be read, it is treated as empty, so the answer is that no project has the hook.
