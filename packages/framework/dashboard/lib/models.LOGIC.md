Gives the dashboard the models each coding agent [1] offers, as the daemon [2] asked the coding agents themselves, and names a model the way its coding agent names it.

## Context

**User story**: the user opens the agent and model menu and sees the models their own Claude Code and Codex offer, by the names those tools show ("Opus 5.5", "GPT-5.6-Terra"); an agent's details name the model it ran the same way.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] daemon: The Framework's long-running local process that serves the dashboard and starts agents.

## Business logic — TL;DR

- **The models, asked once per page** - each surface that names a model asks the daemon once when it appears; until the daemon answers there is no list. The daemon asks each coding agent [1] only once for its whole life, so asking it again costs nothing (`src/dashboard/models.ts`).
- **A model by its name** - a model the coding agent lists is named as the coding agent names it (`opus` is "Opus 5.5"); a model it does not list, or any model while the list is not answered or could not be had, is named by its id, since that id is what the run is given.
