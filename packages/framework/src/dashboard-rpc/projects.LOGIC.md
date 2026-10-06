Everything the dashboard asks the daemon about projects [1]: the list of registered projects with whatever the daemon currently finds wrong with each, adding a new one (opening the machine's own folder dialog, then installing and registering the chosen folder, with the person's answer on where the agents' records go), removing one from the list, where a project's records go now and the switch that shares them with the remote or keeps them on this machine, the folder the onboarding offers as a first project, and what the launcher [2] offers for a project: its commands [3], whether an agent can be started there at all, whether a pull request can be opened there, which branches an agent can start from, and what would stop an agent before it is started.

## Context

**User story**: the user registers a repository in the dashboard so agents [4] can work it, sees at a glance when something is wrong with one of their projects [1], and finds on a project's launcher the commands that project has, or the reason Start is off, and reads there, before pressing Start, what would stop the agent.

**Problem**: the dashboard runs in a browser. It cannot open a folder dialog that yields an absolute path, and cannot read a project's folders or its hooks file. All of that is the daemon's, which runs on the machine the user is sitting at.

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[2] launcher: the Start form on a project home — a project's own page with the launcher and its composer (the prompt editor, also used for live chat).
[3] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[6] sweep: a background job the daemon runs on its clock: the data sync, the cloud scratch sweep, cloud work adoption.
[7] start hook: the one shell line under `start` in a project's `.openagent/hooks.yml`, which the daemon runs when the user presses Start.
[8] check hook: the one shell line under `check` in a project's `.openagent/hooks.yml`, which the daemon runs when the launcher asks what would stop an agent; it answers a list of problems and a list of warnings.

## Business logic — TL;DR

- **The projects list carries what is wrong with each project** - every registered project [1] comes back with its identity and, when there is one, the fault the daemon's background work recorded against it.
- **Adding a project** - a path is registered only after it has been installed as a project; an empty path is refused outright; the add carries the person's answer on sharing the agents' records, and anything but a plain yes is a no.
- **Removing a project** - the project is named by its id and the removal is the daemon's; an empty id is refused outright; the daemon's answer, a refusal included, is the answer.
- **Where a project's records go, and the switch** - a read answers whether the project's `agent-data` branch [5] reaches the remote, has no remote, or is kept on this machine; turning sharing on sends what is there at once, and a remote that refuses turns it back off and is told in its words; a project with no remote is refused; turning it off just stops.
- **The folder dialog is the daemon's** - the machine's own choose-a-folder dialog is opened by the daemon, because a browser cannot learn an absolute path; dismissing it is an ordinary answer, not a failure.
- **The onboarding's first suggestion** - the directory the daemon was started in is offered as the first project, together with whether it is already registered.
- **What the launcher offers** - the project's commands [3], read off its skills folders, whether its hooks file has a start hook [7], whether one of its packages provides a git host, and whether its repository has an `origin` remote (`../has-remote.ts`), without which the launcher shows no publish menu, and the two branches an agent can start from, named only where the pick would be obeyed; an unknown project answers nothing.
- **What would stop an agent** - the project's check hook [8], run with the coding agent the user picked: its problems and its warnings; a check hook that fails is one warning; no check hook, or an unknown project, answers nothing.

## Business logic

### The projects list carries what is wrong with each project

#### Context

**User story**: the user sees the registered projects [1] in the sidebar, and a project whose bookkeeping cannot reach its remote is marked so — an agent [4] started there would work from stale tickets and write a queue nobody else will ever see.

**Problem**: a separate read for "what is wrong" would need its own subscription on every surface that shows a project. The list is what every project surface already reads, so the faults ride on it: the sidebar dot and the project's banner both come from that one read.

#### Business logic

The list answers with every registered project [1]: its id, its absolute path, its display name, whether it still carries its installation marker, whether one of its packages provides a git host, and when it was last active.

To each project the daemon attaches whatever its background sweeps [6] currently find wrong with it — a `agent-data` branch [5] that cannot reach its remote, for instance — oldest first. A project with nothing wrong carries no faults at all, rather than an empty list. A project whose `agent-data` branch stays on this machine, as the daemon's last successful data sync found it, also carries the local only note (`../project-errors.ts`) with its reason, `no-remote` (the repository has no remote) or `kept` (it has one, and the person does not share the records with it): not a fault, and absent otherwise.

### Adding a project

#### Context

**User story**: the user picks a folder, confirms they trust the repository in it, and the folder becomes a project [1] in the list. The trust confirmation is the dashboard's step (`../../dashboard/components/AddProjectPanel.tsx`); registering only happens after it.

#### Business logic

Adding takes a path and the person's answer, asked in the dialog before the add, on whether the agents' records may go to the repository's remote. The surrounding whitespace is stripped from the path. An empty path is refused with "a project path is required" without anything being touched. The answer is handed to the daemon as a yes only when it is exactly yes; anything else is a no, and nothing is pushed for a project added with a no. What a yes means for a repository with no remote is the daemon's rule (`../daemon-runtime.ts`): the records are kept.

Otherwise the daemon installs the repository as a project [1], writes the answer to it and registers it, and answers one of three ways: registered, already registered, or the reason it could not be. A registered answer also says when a yes was not taken because the repository has no remote. The installation itself is the daemon's (`../daemon-runtime.ts`, `../install.ts`).

A host that has no ability to add projects at all fails this call outright rather than answering as though nothing happened, because being unable to add is a misconfiguration, not a state a user can be in.

### Removing a project

#### Context

**User story**: in a project's menu the user picks "Remove project…" and confirms (`../../dashboard/components/AgentActionsMenu.tsx`); the project [1] leaves the list and nothing in its folder is deleted.

**Problem**: removing is the daemon's to do, like adding: it runs the project's `close` hooks and writes the registry. And a project whose folder was deleted must still be removable, so a removal cannot name the project by its folder.

#### Business logic

Removing takes the project's id, not its path. An empty id is refused with "a project id is required" before the daemon is asked. Otherwise the daemon removes the project (`../daemon-runtime.ts`) and its answer is the answer: removed, or the reason it was not, for instance "An agent is working in this project. Stop it, then remove the project."

A host that has no ability to remove projects at all fails this call outright, as for adding.

### Where a project's records go, and the switch

#### Context

**User story**: in a project's menu the user reads whether the agents' records are shared to the remote, turns sharing on after reading what it pushes, or turns it off again (`../../dashboard/components/AgentActionsMenu.tsx`).

**Problem**: the records hold what the user asked each agent [4] and what it answered, and everyone who can read the remote can read what is pushed there; whether they go is the user's word, not a consequence of the repository having a remote. The rule that keeps the `agent-data` branch [5] on this machine until then is the `agent-data` package's.

#### Business logic

The read answers, for a project [1], how far its `agent-data` branch reaches right now, read off the repository itself and not off the last sync: `origin` (it has an `origin` remote and sharing is on), `no-remote` (no `origin`), or `kept` (an `origin`, and sharing off). A project id that names no registered project answers nothing.

The switch takes a project and on or off, and writes the repository's sharing setting. Turning it on in a project whose repository has no `origin` remote is refused with "this project has no remote to share with", and the setting is not written, so it is not left on for a remote made later. Turned off, it answers success and does nothing else: later writes stay on this machine, and the remote keeps what it was sent. Turned on, it pulls the branch at once through the shared branch library, which sends everything kept here; when that pull fails (a remote that refuses the push, for instance) the setting is written back to off and the answer is the failure in the pull's own words, so the records stay where they were and the user is told at once. A project id that names no registered project is refused with "this project has no local path on this server". The project's local only note changes at the daemon's next data sync, not at the switch.

### The folder dialog is the daemon's

#### Context

**Problem**: a page in a browser cannot learn the absolute path of anything the user picks, and a project [1] is identified by its absolute path. Asking the user to type one is asking them to get it right.

#### Business logic

The dashboard asks the daemon to open the machine's own choose-a-folder dialog, and the daemon waits for the answer. A folder chosen comes back as its absolute path. A dialog the user dismissed comes back as no path at all, which is an ordinary answer and not an error. A machine on which no such dialog could be opened comes back with the reason. The dialogs themselves are in `../pick-directory.ts`.

### The onboarding's first suggestion

#### Context

**User story**: on a fresh install the onboarding checklist offers to add a first project [1] without the user typing a path or picking a folder: the directory the daemon was started in is almost always the repository they want.

#### Business logic

The daemon answers with the directory it is running in, and with that directory's project id when it is already registered — which is how the checklist can tell "add this" from "already added, open it".

### What the launcher offers

#### Context

**User story**: a project's launcher [2] lists every command [3] the project has under `/` and in its Commands menu; on a project with no start hook [7], Start is off and the launcher says why; on a project where no package provides a git host, the launcher's publish menu offers "Nothing", "Commit" and "Publish branch" only; the launcher shows a chip that says which branch the agent starts from, the project's main branch or the user's own local branch, and lets the user pick.

**Problem**: a project's start line is written once and kept, so a line written before the pick existed, or a person's own line, may not pass the picked branch on to the tool. A pick shown there would silently do nothing.

#### Business logic

For a given project [1] the daemon answers three things, read fresh each time: the project's commands (the rule is `project-commands.ts`'s: the skills written to be run by a person, each with its name and description), and whether the project's `.openagent/hooks.yml` names a `start` line (`project-hooks.ts`; a hooks file that is missing or refused counts as no start line), and whether one of the project's packages declares that it provides the git host (`../store/git-host.ts`; a declaration that cannot be read counts as none): without one no pull request can be opened, so the launcher's publish menu stops at "Publish branch".

It also answers the two branches an agent can start from, `startFrom`: `main`, the name of origin's default branch (`main` for `origin/main`), and `local`, the name of the branch the project's folder has checked out now, which is the same name when the folder is on the default branch itself. Both are read from the local repository, never fetched (`originDefaultBranch` of `@openagt/agent-data`, and the branch read of `../dashboard/git-status.ts`). `startFrom` is answered only when all of these hold, and is absent otherwise, so the launcher shows the chip only where the pick is obeyed: the project's start line mentions `$BASE` or `${BASE` (`project-hooks.ts`), the repository has an `origin` remote with a default branch this clone knows, and the folder is on a branch (a folder on a detached commit has no local branch to start from).

A project id that names no registered project answers nothing at all.

### What would stop an agent

#### Context

**User story**: the user opens a project's launcher [2], or picks another coding agent in it, and reads under the prompt box, before pressing Start, what would stop the agent [4] (Claude Code not logged in, with the command that fixes it) and what is only worth knowing (`gh` missing).

**Problem**: the daemon names no tool and no coding agent's CLI; only the project's own line knows what to ask.

#### Business logic

For a given project [1] and, when the user picked one, a coding agent, the daemon runs the project's check hook [8] (`project-hooks.ts`), the pick in `DRIVER`, and answers its two lists: the problems and the warnings. A check hook that fails, hangs, answers something else, or sits in a hooks file that is refused, is answered as no problem and one warning, its error in words ("the check hook: <what it said>"): a broken check is worth saying, not a reason to stop. A project with no check hook, and a project id that names no registered project, answer nothing at all: there is nothing to say.
