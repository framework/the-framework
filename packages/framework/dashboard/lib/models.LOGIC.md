Gives the dashboard the models each coding agent [1] offers, as the daemon [2] asked the coding agents themselves, as the one list every surface that picks a model offers, and names a model the way its coding agent names it.

## Context

**User story**: the user opens the agent and model menu, or the "Model" row on Settings, and sees the models their own Claude Code and Codex offer, by the names those tools show ("Opus 5.5", "GPT-5.6-Terra"); an agent's details name the model it ran the same way.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] daemon: The Framework's long-running local process that serves the dashboard and starts agents.

## Business logic — TL;DR

- **The models, asked once per page** - each surface that names a model asks the daemon once when it appears; until the daemon answers there is no list. The daemon asks each coding agent [1] only once for its whole life, so asking it again costs nothing (`src/dashboard/models.ts`).
- **One list to pick from** - both of the dashboard's own surfaces that pick a model, the launcher's agent and model menu (`components/Composer.tsx`) and the Settings page's "Agent" and "Model" rows (`components/SettingsPage.tsx`), offer the same list: every coding agent [1], Claude Code then Codex, each with the models it listed, by its own names, in its own order. A coding agent with no model in the list comes with one line saying why: "Asking <coding agent>…" while the daemon has not answered, the coding agent's own reason when it could not list its models, and "No models listed" when it listed none. Only how each surface draws the list is its own (the menu adds each coding agent's logo). A module that lets the person pick a coding agent and a model gets the same list (`useCodingAgents`, which `framework/module` hands on), so its picks are ones a run can be given.
- **A model by its name** - a model the coding agent lists is named as the coding agent names it (`opus` is "Opus 5.5"), and so is the full id a listed alias runs today (`claude-opus-5-5` is "Opus 5.5" too: the id an agent's card holds once the coding agent named the model it ran); a model it does not list, or any model while the list is not answered or could not be had, is named by its id, since that id is what the run was given or ran. A run on `opus` from before the alias moved on keeps its full id, so it is never named after the newer model `opus` runs by then: it is named by the list's own entry for that full id when the coding agent still lists it, and by the id otherwise.
