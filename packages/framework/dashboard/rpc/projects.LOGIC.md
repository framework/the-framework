The browser's typed stubs for what the dashboard asks the daemon about projects: the registered projects, adding one, picking its directory, the onboarding suggestion, whether a project's GitHub repository allows auto-merge, and the preflight [1] of the driver [2] the launcher [3] has picked. One stub per call, addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for it, taken from `src/dashboard-rpc/projects.ts`; a call the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking the page at runtime. The stubs add no rule of their own: what each call answers and refuses is the daemon's logic in `src/dashboard-rpc/projects.ts`; only the calls' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] preflight: the check that the chosen driver's coding agent can start an agent, run before a checkout is spent.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[3] launcher: the Start form on a project's own page (the project home).
[4] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[5] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[6] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[7] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[8] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that call, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a page that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **The registered projects** - every registered project with its id, path, name, whether it is still activated, its last activity, the defaults its repo file [4] sets, and whatever the daemon's sweeps [5] currently find wrong with it, which rides on this list because every project surface already polls it.
- **Adding a project** - install and register a repository by its path, learning whether it was already activated or why it could not be added; an empty path is refused with "a project path is required".
- **Picking a directory** - open the OS folder picker on the daemon's machine, the only place an absolute path can come from, and receive the chosen path, none when the dialog was dismissed, or the reason no dialog could open.
- **The onboarding suggestion** - the directory the daemon runs in, offered as the one-click first project, with its project id when it is already registered.
- **Whether the repository allows auto-merge** - so the launcher [3] can note, when the merge rung of the handoff [6] is armed on a repository that does not, that the merge then falls to the daemon's CI watch [7] and holds only while the daemon runs; nothing for an unknown project, and "could not say" when the GitHub CLI cannot tell, which renders nothing.
- **Whether the driver can start** - the preflight [1] of the chosen driver [2]: whether its coding agent [8] is installed, signed in and not running as root, reported as problems that each name their fix and as warnings, never as what is right; with the pull request or merge rung armed the GitHub CLI is checked as well, and a driver name the daemon does not know is checked as `claude`.
