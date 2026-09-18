The browser's typed stubs for what the dashboard asks the daemon about projects: the registered projects, adding one, picking its directory, the onboarding suggestion, and what the launcher [3] offers for a project: its commands [1] and whether it has a start hook [2]; and setting a scheduled command's schedule switch [6] through the project's switch hook. One stub per call, addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for it, taken from `src/dashboard-rpc/projects.ts`; a call the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking the page at runtime. The stubs add no rule of their own: what each call answers and refuses is the daemon's logic in `src/dashboard-rpc/projects.ts`; only the calls' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[2] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`, which starts an agent.
[3] launcher: the Start form on a project's own page (the project home).
[5] sweep: a background job the daemon runs on its clock: the notification watchers, the data sync, the cloud scratch sweep, cloud work adoption.
[6] schedule switch: a person's choice, on one machine, whether a scheduled command (a line of the project's `agent-schedule.md`) runs there; the project's scheduler keeps it in its state file. The switch hook, the one shell line under `switch:` in `.the-framework/hooks.yml`, sets it.

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that call, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a page that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **The registered projects** - every registered project with its id, path, name, whether it is still activated, its last activity, and whatever the daemon's sweeps [5] currently find wrong with it, which rides on this list because every project surface already polls it.
- **Adding a project** - install and register a repository by its path, learning whether it was already activated or why it could not be added; an empty path is refused with "a project path is required".
- **Picking a directory** - open the OS folder picker on the daemon's machine, the only place an absolute path can come from, and receive the chosen path, none when the dialog was dismissed, or the reason no dialog could open.
- **The onboarding suggestion** - the directory the daemon runs in, offered as the one-click first project, with its project id when it is already registered.
- **What the launcher offers** - a project's commands [1], each with its description and whether it was written to be run by a person, and whether the project has a start hook [2]; nothing for an unknown project.
- **A schedule switch** - one project's scheduled command switched on or off on this machine [6], answered as done or with the error in words; "unknown project" and a project with no switch hook are each an error.
