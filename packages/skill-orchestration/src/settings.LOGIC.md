The person's subagent settings [1] on this machine: the file the settings are kept in, what counts as settings, and the coding agent and model a task at a level runs on.

## Context

**User story**: the user picks, in the dashboard's Settings → Subagents, a cheaper model for simple tasks, the strongest for hard ones, and 3 at once; the dashboard runs `orchestration settings <json>` in each project, and from then on every main agent there starts each subagent [3] on the model set for the level it gives the task, no more than 3 at a time.

**Business logic story**: `settings` (`cli.ts`) writes the file and reads it back; `start` (`subagents.ts`) reads it for the coding agent, the model and the limit. The dashboard never reads the file: the package's own Settings section (`../dashboard/`) runs `orchestration settings`, so only this package knows where the settings are. The levels and the shape of the settings are `levels.ts`'s, shared with that section.

**Problem**: a main agent that picked each subagent's model would spend the person's money on its own guess; one person's models, kept in the tracked repository, would be everyone's; a save written into the file while a reader, or a second save, met it halfway would leave the settings mixed or unreadable.

## Glossary

[1] subagent settings: the person's choice, on one machine, of the coding agent and model a task the main agent [2] calls simple runs on, the same for a task it calls hard, and how many of one main agent's subagents [3] run at once.
[2] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[3] subagent: a run started for a main agent [2]: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.

## Business logic — TL;DR

- **The levels** - `simple` and `hard`, as `levels.ts` says: what a main agent [2] says of each task; no other word is a level.
- **The file** - `.orchestration/settings.json` at the project's root, never tracked: the first write hides `.orchestration/` from git through the repository's exclude file, as the scheduler's state is.
- **What counts as settings** - a JSON object whose keys are only `simple`, `hard` and `atOnce`, each optional and `null` meaning unset; a level is an object with a coding agent the runner can start (`claude-code` or `codex`) as `driver` and, optionally, a model as `model`, a non-blank text, trimmed; `atOnce` is a whole number of at least 1. Anything else is refused whole, with why, never trimmed down to what fits.
- **Reading** - the settings as written; none when there is no file, or what is in it is not settings.
- **Writing** - the settings, whole, over what was there: written to a file of their own beside the settings file, then renamed onto it, so the settings file is always one save or another, never part of one; of two saves at once, one is left whole and no other file is left behind.
- **The coding agent and model for a level** - the setting for that level; when it is not set, the main agent's own coding agent and model. A setting with no model runs on its coding agent's own default.
- **How many at once** - `atOnce`; 4 when it is not set (`levels.ts`).
