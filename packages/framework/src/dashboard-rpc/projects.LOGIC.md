Everything the dashboard asks the daemon about projects [1]: the list of registered projects with whatever the daemon currently finds wrong with each, adding a new one (opening the machine's own folder dialog, then installing and registering the chosen folder), the folder the onboarding offers as a first project, and what the launcher [2] offers for a project: its commands [3], and whether an agent can be started there at all.

## Context

**User story**: the user registers a repository in the dashboard so agents [4] can work it, sees at a glance when something is wrong with one of their projects [1], and finds on a project's launcher the commands that project has, or the reason Start is off.

**Problem**: the dashboard runs in a browser. It cannot open a folder dialog that yields an absolute path, and cannot read a project's folders or its hooks file. All of that is the daemon's, which runs on the machine the user is sitting at.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[2] launcher: the Start form on a project home — a project's own page with the launcher and its composer (the prompt editor, also used for live chat).
[3] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[6] sweep: a background job the daemon runs on its clock: the data sync, the notification watchers, the cloud scratch sweep, cloud work adoption.
[7] start hook: the one shell line under `start` in a project's `.the-framework/hooks.yml`, which the daemon runs when the user presses Start.

## Business logic — TL;DR

- **The projects list carries what is wrong with each project** - every registered project [1] comes back with its identity and, when there is one, the fault the daemon's background work recorded against it.
- **Adding a project** - a path is registered only after it has been installed as a project; an empty path is refused outright.
- **The folder dialog is the daemon's** - the machine's own choose-a-folder dialog is opened by the daemon, because a browser cannot learn an absolute path; dismissing it is an ordinary answer, not a failure.
- **The onboarding's first suggestion** - the directory the daemon was started in is offered as the first project, together with whether it is already registered.
- **What the launcher offers** - the project's commands [3], read off its skills folders, and whether its hooks file has a start hook [7]; an unknown project answers nothing.

## Business logic

### The projects list carries what is wrong with each project

#### Context

**User story**: the user sees the registered projects [1] in the sidebar, and a project whose bookkeeping cannot reach its remote is marked so — an agent [4] started there would work from stale tickets and write a queue nobody else will ever see.

**Problem**: a separate read for "what is wrong" would need its own subscription on every surface that shows a project. The list is what every project surface already reads, so the faults ride on it: the sidebar dot and the project's banner both come from that one read.

#### Business logic

The list answers with every registered project [1]: its id, its absolute path, its display name, whether it still carries its installation marker, and when it was last active.

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

### What the launcher offers

#### Context

**User story**: a project's launcher [2] lists every command [3] the project has under `/` and in its Commands menu; on a project with no start hook [7], Start is off and the launcher says why.

#### Business logic

For a given project [1] the daemon answers two things, read fresh each time: the project's commands (the rule is `project-commands.ts`'s: the skills written to be run by a person, each with its name and description), and whether the project's `.the-framework/hooks.yml` names a `start` line (`project-hooks.ts`; a hooks file that is missing or refused counts as no start line). A project id that names no registered project answers nothing at all.
