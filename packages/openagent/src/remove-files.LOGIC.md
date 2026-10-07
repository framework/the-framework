Removes OpenAgent's files [1] from a project's folder: what the daemon runs when the user removes a project and ticked "Also delete OpenAgent's files in this folder" (`daemon-runtime.ts`). Three owners remove their own, in order: every package that declares a clean-up [3], the agents' records [2], and the dashboard's own directory `.openagent/`. A clean-up that refuses or fails ends the pass there. The answer is a report [4] of what went, what stayed and why, and what could not be done.

## Context

**User story**: the user removes a project from the dashboard and asks for OpenAgent's files in the folder to go too. The folder is then as it was before the project was added, except for what the user wrote there themselves. The user reads, line by line, what was deleted and what was kept.

**Business logic story**: the dashboard holds no list of any tool's files. Each owner knows what it made: each tool runs its own clean-up [3] (`built-in.ts`), the shared branch library takes the records' branch off the machine (`agent-data`'s `file-branch.ts`), and this module removes only the dashboard's own directory.

**Problem**: this deletes things in a person's repository. So it never touches the remote, a commit, a branch with work on it or a file git tracks. And it never ends with an error: what could not be done is one line of the report [4].

## Glossary

[1] OpenAgent's files: what the product and its tools left in a project's folder: the directories `.openagent`, `.branches` and `.agent-runner`, and the local branch `agent-data` with the agents' records.
[2] the agents' records: the `agent-data` branch of the project's repository: what the user asked each agent and what it answered, the tickets and the agent queue. On this machine it is a local branch and its checkout at `.branches/agent-data`.
[3] clean-up: the command a package declares as `"openagent": { "cleanup": "<command>" }` in its `package.json`; `<command> cleanup`, run in the project, removes what that package left there and answers what it removed and what it kept.
[4] report: the answer of a removal with files, three lists in words for a person: `removed` (paths from the project's root), `kept` (a path and the reason it stayed) and `failed` (what could not be done).
[5] sharing answer: the user's answer on whether the agents' records may go to the repository's remote, kept as the git setting `agent-data.share` of the repository.

## Business logic — TL;DR

- **Three owners, in order** - every package's clean-up [3], then the agents' records [2], then `.openagent/`; the report [4] lists their lines in that order.
- **The tools' clean-ups, and a refusal ends the pass** - every package that declares a clean-up runs it, and its answer is passed on as it is; when one refuses or fails, the records and `.openagent` stay, each kept as `a clean-up before it did not finish`.
- **The agents' records** - the checkout and the local branch are taken off this machine and the sharing answer [5] is forgotten; all of it is kept when another project on the list uses the same repository.
- **The dashboard's own directory** - every file under `.openagent/` that git does not track is removed, then each directory left empty; a tracked file is kept as `git tracks it`, matched ignoring letter case and Unicode form.
- **Nothing here fails the removal** - a step that cannot be done is a line in `failed`; the caller always gets a report.

## Business logic

### Three owners, in order

#### Context

See `## Context`.

#### Business logic

The steps run one after another: the tools' clean-ups [3], the agents' records [2], the dashboard's own directory. The report [4] holds each step's lines in that order.

### The tools' clean-ups, and a refusal ends the pass

#### Context

**Problem**: the runner's clean-up refuses while a run of this machine is alive. That includes a run still booting, which the dashboard's own "An agent is working in this project" check does not see (`daemon-runtime.ts`). Nothing may be deleted from under such a run: not its records, not the project's start lines.

Which packages are asked, and how an answer is read, is `built-in.ts`'s rule.

#### Business logic

Every package that declares a clean-up [3] runs it in the project. What each removed and kept, and each line saying a clean-up refused or failed, is added to the report [4] unchanged.

When at least one clean-up refused or failed, the pass ends there. The agents' records [2] and the dashboard's directory are not touched, and the report names both as kept: `branch agent-data` and `.openagent`, each with the reason `a clean-up before it did not finish`. What the clean-ups that worked already removed stays removed, and is in the report.

### The agents' records

#### Context

**User story**: the user is told, before they confirm, that the agents' conversations go with the branch `agent-data` (`../dashboard/components/RemoveProjectDialog.tsx`).

**Problem**: the branch belongs to the repository, not to one folder. A second project on the dashboard's list that is another checkout of the same repository still reads it.

#### Business logic

When the daemon names another listed project that is a checkout of the same repository, nothing of the records is touched. The report says so in one `kept` line: `branch agent-data`, with the reason `another project on the list uses it: <that project's folder>`. The sharing answer [5] stays too.

Otherwise the shared branch library takes the branch off this machine (`agent-data`'s `file-branch.ts`): its checkout `.branches/agent-data`, then the local branch `agent-data`, then the checkouts directory `.branches` when that left it empty. The remote's copy is not touched and nothing is pushed first, so records that never reached the remote are gone. What the library removed and kept is added to the report, in its words. When the library fails, the report gets the `failed` line `the agents' records: <the error>`.

A tool's clean-up may have named a path as kept a moment before, and the library then removed it: the `branches` tool keeps `.branches/agent-data` as "not made by branches". Such a path is taken out of `kept`, so the report never says of one path that it was both kept and removed.

The sharing answer [5] goes with the records it was about. When the library kept nothing, the setting `agent-data.share` is removed from the repository's git config, and the report names it as `setting agent-data.share` when there was one. While anything of the records stays, so does the answer.

### The dashboard's own directory

#### Context

**Problem**: `.openagent/` is ignored by git as the product writes it, but a person may have committed a file there, such as the project's shared presets. A committed file is the repository's, not the product's to delete. And some file systems treat two spellings of a name as one file: a tracked file read back from disk under another letter case or Unicode form must not look untracked.

#### Business logic

A project with no `.openagent` has nothing to remove here. When `.openagent` is not a real directory (a link, or a file), it is kept with the reason `not made by OpenAgent` and never followed: what a link points at may lie outside the project.

Otherwise git is asked which files under `.openagent` it tracks. When git cannot answer, nothing is removed and the report [4] gets the `failed` line `.openagent: <the error>`.

Then the directory is walked. A file git tracks is kept, with the reason `git tracks it`; a file on disk and a tracked path are the same file when they differ only in letter case or Unicode form. Every other file is removed, the hooks file `.openagent/hooks.yml` with the project's start lines among them. A link is removed as a link and never followed. A directory is removed once nothing is left in it, and stays when something is.

The report names what went in the shortest true way: the one line `.openagent` when the whole directory went, else one line per removed file. An error during the walk is the `failed` line `.openagent: <the error>`.

### Nothing here fails the removal

#### Context

**Problem**: by the time this runs the project is already off the dashboard's list. An error thrown here would leave the user with a removed project and no word on what happened in the folder.

#### Business logic

No step throws. Each failure is one line of `failed`, in words. A clean-up that did not finish ends the pass, as said above. A failure of the records step does not: the dashboard's directory is still walked. The caller always gets a report [4].
