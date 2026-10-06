The browser's typed stubs for what the dashboard asks the daemon about projects: the registered projects, adding one, where a project's records go and the switch that shares them, picking its directory, the onboarding suggestion, and what the launcher [3] offers for a project: its commands [1], whether it has a start hook [2] and whether it has a git host provider [7]. One stub per call, addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for it, taken from `src/dashboard-rpc/projects.ts`; a call the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking the page at runtime. The stubs add no rule of their own: what each call answers and refuses is the daemon's logic in `src/dashboard-rpc/projects.ts`; only the calls' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[2] start hook: the one shell line under `start:` in the project's `.openagent/hooks.yml`, which starts an agent.
[3] launcher: the Start form on a project's own page (the project home).
[5] sweep: a background job the daemon runs on its clock: the data sync, the cloud scratch sweep, cloud work adoption.
[7] git host provider: the package of the project that declares it provides the git host; The Framework opens and lands pull requests through the command that package declares. A project with none has no git host: no pull request can be opened for it.

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that call, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a page that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **The registered projects** - every registered project with its id, path, name, whether it is still activated, whether it has a git host provider [7], its last activity, and whatever the daemon's sweeps [5] currently find wrong with it, which rides on this list because every project surface already polls it.
- **Adding a project** - install and register a repository by its path, with the user's answer on whether the agents' records may go to its remote, learning whether it was already activated, whether a yes was not taken for want of a remote, or why it could not be added; an empty path is refused with "a project path is required".
- **Where a project's records go** - read whether the project's records reach its remote, are kept on this machine, or have no remote to go to; and turn sharing them on or off, learning the remote's refusal when turning it on fails.
- **Picking a directory** - open the OS folder picker on the daemon's machine, the only place an absolute path can come from, and receive the chosen path, none when the dialog was dismissed, or the reason no dialog could open.
- **The onboarding suggestion** - the directory the daemon runs in, offered as the first project with no folder to pick, with its project id when it is already registered.
- **What the launcher offers** - a project's commands [1], each with its description and whether it was written to be run by a person, whether the project has a start hook [2], and whether it has a git host provider [7]; nothing for an unknown project.
