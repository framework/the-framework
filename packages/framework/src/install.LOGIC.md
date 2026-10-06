Activates a repository for OpenAgent, which is what adding a project does to it: a `.openagent/` directory holding the ignore file that hides the whole directory from git. Nothing is committed on a branch that has a commit, and git shows no new file. A repository that is already activated is left untouched, a folder that is not a repository yet is made one first, a repository with no commit is given an empty first one, and any failure is reported as an answer rather than thrown.

## Context

**User story**: the user adds a repository by path on the Overview, and from then on the repository is a project agents [1] can work. Their repository looks as it did: the same commits, the same `git status`, and nothing they had uncommitted or staged is touched. This matters most in a repository the user does not own.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. OpenAgent starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".

## Business logic — TL;DR

- **The ignore file is the activation marker** - a repository whose `.openagent/.gitignore` exists is already activated: the answer says so and nothing runs, not even git.
- **A folder that is not a repository is made one** - git is the source of truth, so a folder outside any repository is initialized for the user instead of refused, and the answer says it was.
- **What activation writes** - `.openagent/` with its ignore file, and nothing else.
- **No commit on the user's branch** - nothing is staged and nothing is committed; the ignore file hides the directory, itself included, so git shows no change.
- **An empty first commit, only in a repository that has none** - a repository with no commit, made just now or the user's own, gets one commit with no file in it, "[OpenAgent] first commit", because an agent's branch must start from a commit.
- **Failures are answers** - a git or filesystem failure at any step is returned with its message, never thrown, so the dashboard can show why the project could not be added.

## Business logic

### The ignore file is the activation marker

#### Context

**Problem**: a `.openagent/` directory can exist without the repository being activated, because the daemon creates one wherever it runs for its own state. Only the ignore file proves activation, since it is what keeps OpenAgent's state out of git.

#### Business logic

Activation first looks for `.openagent/.gitignore`. When it exists the repository is already activated: the answer is a success flagged as already activated, and no file is written and no git command runs. The same file is what `project.ts` reads to tell an activated project from any other directory.

### A folder that is not a repository is made one

#### Context

**User story**: the user adds a folder that has never been under git; OpenAgent treats git as the source of truth, so it needs a repository to work in.

#### Business logic

When the folder is not inside a git working tree (a git that cannot answer the question counts as "not inside one"), a repository is initialized in it before anything else, and the final answer says the repository was initialized. A folder already inside a repository is used as it is.

### What activation writes

#### Context

**Business logic story**: the ignore file's rules are in `framework-gitignore.ts`. OpenAgent ships no prompt text, so activation writes no prompt files.

#### Business logic

Activation creates `.openagent/` and writes into it the ignore file, which ignores everything under `.openagent/`, itself included. The ticket format's specification is deliberately not written: it ships inside the package and versions with it.

### No commit on the user's branch

#### Context

**Problem**: the user may add a repository they do not own, or one whose history they keep carefully. A commit made in their name on the branch they are on is a change they did not ask for, and it can travel to the remote with their next push. The user's checkout [3] may also hold uncommitted or staged work that must stay exactly as it is.

#### Business logic

Activation stages nothing and commits nothing in a repository that has a commit. Because the ignore file ignores itself along with everything else in the directory, `git status` lists no new file and `git log` shows no new commit. The user's uncommitted and staged changes are exactly as they were. What activation writes is this machine's: another person who clones the repository gets none of it, and gets their own when they add the project.

### An empty first commit, only in a repository that has none

#### Context

**Problem**: an agent [1] works on its own branch in its own checkout [3], and git cannot start a branch in a repository that has no commit. A folder initialized a moment ago is such a repository, and so is one the user initialized and never committed in. There is no history of the user's in it for a commit to disturb.

#### Business logic

When the repository has no commit, activation makes one, with the message "[OpenAgent] first commit". The commit holds no file: it is made from git's empty tree and not from what is staged, so a file the user has staged stays staged, and every other file stays uncommitted. It is made before the ignore file is written: when it fails (git has no author name, for example), the repository is not activated, and adding the project again tries again. A repository that has a commit gets none.

### Failures are answers

#### Context

See `## Context`.

#### Business logic

Any failure after the activation check, a git command that fails or a file that cannot be written, ends the activation with a failure carrying the error's message, never with a thrown error. The caller (`daemon-runtime.ts`, for the dashboard's add-project action) reports that message to the user.
