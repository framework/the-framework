Fixes the shape of the subagent settings [1]: the two levels a main agent [2] says a task is (`simple`, `hard`), a coding agent [3] and an optional model for each, how many of one main agent's subagents run at once, 4 when nobody said, the file the settings are kept in, and the reading that keeps only what has that shape. It depends on nothing that runs only on a server, so the daemon and the dashboard read this one copy.

## Context

**User story**: in Settings → Subagents the user picks a coding agent and model for simple tasks, another for hard tasks, and how many run at once; a main agent splitting its task then starts each subagent on the one set for the level it gives that task.

**Business logic story**: The Framework starts no subagent. The settings are the `orchestration` command's: it keeps them in its own file at the project's root, written by the project's `subagents` hook line, and reads them when a main agent starts a subagent. The dashboard reads that file by its name only, and writes through the hook line, so it names no tool.

## Glossary

[1] subagent settings: a person's choice, on one machine, of the coding agent and model a main agent's subagents run on, one for a task the main agent calls simple and one for a task it calls hard, and how many of one main agent's subagents run at once.
[2] main agent: an agent that splits its task and starts other agents, its subagents, on the parts, with the `orchestration` command.
[3] coding agent: the CLI doing the actual work: Claude Code (`claude-code`) or Codex (`codex`).

## Business logic — TL;DR

- **The file** - `.orchestration/settings.json` at the project's root: this machine's, hidden from git by the `orchestration` command that writes it.
- **The two levels** - `simple` and `hard`, in that order; each is either set to a coding agent [3] with, optionally, a model, or left out: a level left out runs on the main agent's [2] own coding agent and model, and a coding agent with no model runs on that coding agent's own default.
- **How many at once** - `atOnce`, a whole number of at least 1; left out, it is 4, the `orchestration` command's own default.
- **Only the promised shape is kept** - a level whose coding agent is not Claude Code or Codex, or that is not an object, is left out; a model that is not text, or is blank, is dropped and the coding agent kept; a model is trimmed; an `atOnce` that is not a whole number of at least 1 is left out; anything else in the value is ignored; a value that is not an object is no settings.
