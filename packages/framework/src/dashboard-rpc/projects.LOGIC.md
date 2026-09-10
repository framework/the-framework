Everything the dashboard asks the daemon about projects [1]: the list of registered projects with whatever the daemon currently finds wrong with each, adding a new one (opening the machine's own folder dialog, then installing and registering the chosen folder), the folder the onboarding offers as a first project, and the two questions the launcher [2] asks before a Start — whether this project's repository will merge a pull request by itself, and whether the chosen coding agent [3] can start an agent [4] at all.

## Context

**User story**: the user registers a repository in the dashboard so agents [4] can work it, sees at a glance when something is wrong with one of their projects [1], and is warned before starting an agent when the start cannot work or will not finish the way they expect.

**Problem**: the dashboard runs in a browser. It cannot open a folder dialog that yields an absolute path, cannot look at the machine's installed programs, and cannot ask GitHub about a repository. All of that is the daemon's, which runs on the machine the user is sitting at.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[2] launcher: the Start form on a project home — a project's own page with the launcher and its composer (the prompt editor, also used for live chat).
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[6] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[7] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[8] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[9] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[10] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[11] preflight: the check that the chosen driver's coding agent can start an agent, run before a checkout is spent.
[12] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[13] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **The projects list carries what is wrong with each project** - every registered project [1] comes back with its identity, its committed defaults and, when there is one, the fault the daemon's background work recorded against it.
- **Adding a project** - a path is registered only after it has been installed as a project; an empty path is refused outright.
- **The folder dialog is the daemon's** - the machine's own choose-a-folder dialog is opened by the daemon, because a browser cannot learn an absolute path; dismissing it is an ordinary answer, not a failure.
- **The onboarding's first suggestion** - the directory the daemon was started in is offered as the first project, together with whether it is already registered.
- **Will this repository merge by itself** - the launcher [2] asks whether the project's repository allows GitHub's own auto-merge, and "could not say" is answered as such rather than as "no".
- **Can this coding agent start an agent** - the launcher asks whether the chosen coding agent [3] is installed, logged in and not running as root, and gets back only what is wrong and how to fix it.

## Business logic

### The projects list carries what is wrong with each project

#### Context

**User story**: the user sees the registered projects [1] in the sidebar, and a project whose bookkeeping cannot reach its remote is marked so — an agent [4] started there would work from stale tickets and write a queue nobody else will ever see.

**Problem**: a separate read for "what is wrong" would need its own subscription on every surface that shows a project. The list is what every project surface already reads, so the faults ride on it: the sidebar dot and the project's banner both come from that one read.

#### Business logic

The list answers with every registered project [1]: its id, its absolute path, its display name, whether it still carries its installation marker, when it was last active, and the defaults its repo file [7] commits.

To each project the daemon attaches whatever its background sweeps [6] currently find wrong with it — a `agent-data` branch [5] that cannot reach its remote, for instance — oldest first. A project with nothing wrong carries no faults at all, rather than an empty list.

### Adding a project

#### Context

**User story**: the user picks a folder, confirms they trust the repository in it, and the folder becomes a project [1] in the list. The trust confirmation is the dashboard's step (`../../dashboard/components/AddProjectPanel.tsx`); registering only happens after it.

#### Business logic

Adding takes a path, and the surrounding whitespace is stripped from it. An empty path is refused with "a project path is required" without anything being touched.

Otherwise the daemon installs the repository as a project [1] and registers it, and answers one of three ways: registered, already registered, or the reason it could not be. The installation itself is the daemon's (`../daemon-runtime.ts`, `../install.ts`).

A host that has no ability to add projects at all fails this call outright rather than answering as though nothing happened, because being unable to add is a misconfiguration, not a state a user can be in.

### The folder dialog is the daemon's

#### Context

**Problem**: a page in a browser cannot learn the absolute path of anything the user picks, and a project [1] is identified by its absolute path. Asking the user to type one is asking them to get it right.

#### Business logic

The dashboard asks the daemon to open the machine's own choose-a-folder dialog, and the daemon waits for the answer. A folder chosen comes back as its absolute path. A dialog the user dismissed comes back as no path at all, which is an ordinary answer and not an error. A machine on which no such dialog could be opened comes back with the reason. The dialogs themselves are in `../pick-directory.ts`.

### The onboarding's first suggestion

#### Context

**User story**: on a fresh install the onboarding checklist offers to add a first project [1] in one click, without the user typing or picking anything: the directory the daemon was started in is almost always the repository they want.

#### Business logic

The daemon answers with the directory it is running in, and with that directory's project id when it is already registered — which is how the checklist can tell "add this" from "already added, open it".

### Will this repository merge by itself

#### Context

**Problem**: with the top handoff [8] rung armed, an agent's [4] pull request is expected to merge itself. On a repository that does not allow GitHub's own auto-merge, the merge is instead performed by the daemon's CI watch [9] once the checks pass — sound, but only while the daemon is running. The launcher [2] says so before the agent is started.

#### Business logic

For a given project [1] the daemon answers whether that repository allows GitHub auto-merge. The answer is read through the GitHub CLI, is read-only, and is cached so an armed launcher does not ask GitHub on every keystroke.

Three answers are distinguished, because the launcher shows its notice for only one of them:

- The project id names no registered project: nothing is answered at all.
- The question could not be answered — the GitHub CLI is not installed, or the project is not a GitHub repository: the answer is explicitly "not known", and the launcher shows nothing rather than warning about a setting it cannot see.
- The repository allows auto-merge, or it does not: answered as such.

### Can this coding agent start an agent

#### Context

**Problem**: a coding agent [3] that is installed but logged out, or a daemon started with elevated privileges, kills every agent [4] before it writes anything, while each attempt still spends a branch and a checkout [13]. The user is left watching a dashboard wait for an agent that will never appear.

#### Business logic

For a named driver [10], the daemon runs the preflight [11] and answers with two lists:

- Problems: things that will stop an agent [4] from starting — the coding agent's [3] CLI is not installed, or it is not logged in. Each is already written as a sentence naming its own fix.
- Warnings: things worth saying that must not block — the daemon runs as root, so the coding agent looks for credentials in the wrong home directory; or, when asked for, a missing or logged-out GitHub CLI, which would leave a finished agent's publishing stopped at the pushed branch.

Two rules shape what comes back:

- Only what is wrong is answered. What passed — the installed version, the account that is logged in — is of no use to the launcher [2] and never leaves the daemon, because the browser asking may be a guest connected over a relay [12].
- The GitHub CLI is only checked when the caller says the pull request rung is armed, so a launcher whose handoff [8] stops at the pushed branch never warns about a program its agent will not use.

A driver name the daemon does not recognize is checked as Claude Code rather than refused.
