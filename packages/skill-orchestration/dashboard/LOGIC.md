The `orchestration` skill's module [1] for the dashboard: one section of the Settings page, Subagents, where the person picks which coding agent and model a main agent's [2] subagents [3] run on, by how hard the main agent says each task is, and how many of one main agent's subagents run at once. It reads and saves the subagent settings [4] through the same `orchestration` command an agent runs, `orchestration settings`. The package exports the module as `./dashboard` (`dist/dashboard/dashboard.js` and its stylesheet), which is how the dashboard finds it; the dashboard itself never names this package, nor subagents.

## Context

**User story**: the user opens Settings and, after the dashboard's own sections, finds Subagents: "Simple tasks" set to a cheaper model, "Hard tasks" to the strongest, "At once" to 3. From then on every main agent in every project that has this package starts each subagent on the model set for the level it gives the task, no more than 3 at a time. A dashboard with no project depending on this package shows no Subagents section at all.

**Business logic story**: the settings are this machine's, one file per project, which only this package's command reads and writes (`../src/settings.ts`); the section is the same on every project, so it reads them from one project and saves them to all. What a level is and how many run at once when unset come from `../src/levels.ts`, the same definitions the command uses.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[2] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[3] subagent: a run started for a main agent [2]: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.
[4] subagent settings: the person's choice, on one machine, of the coding agent and model a task the main agent [2] calls simple runs on, the same for a task it calls hard, and how many of one main agent's subagents [3] run at once; one file, `.orchestration/settings.json` at the project's root, hidden from git.

## Business logic — TL;DR

- **The module's definition** (`index.tsx`) - one Settings section, Subagents, placed at order 10, and the stylesheet beside the module.
- **The Subagents section** (`SubagentsSettings.tsx`, `SubagentsSettings.test.tsx`) - "Simple tasks", "Hard tasks" and "At once", read with `orchestration settings` from the first project that answers, every 10 seconds; a pick shown at once and saved whole with `orchestration settings <json>` to every project that has the package, one save at a time, only the latest waiting pick sent next; a refused save names the project and why, and the section shows what is saved again.
- **A level's choices** (`choices.ts`) - "Same as the main agent", then each coding agent by its own default and by each model it lists; a saved choice the lists do not hold is kept.
- **Built to share, not to bundle** (`vite.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `dashboard.css`, `tsconfig.json`) - the module leaves React and `framework/module` as bare imports the dashboard supplies, and its stylesheet holds only its own utilities, coloured by the dashboard's theme file; these files carry no business logic beyond that.
