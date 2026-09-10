Two read-only facts about a repository on disk: whether it is activated as a project [1], and which files git sees in it. A repository is activated exactly when it has the `.the-framework/.gitignore` file that activation writes; a `.the-framework/` directory alone, which something else may have created, never counts, because that ignore file is what keeps The Framework's state off the repository's branches. The file listing is every file git sees, tracked and untracked, honoring the ignore rules, as repository-relative paths without duplicates and sorted; a directory that is not a repository, a missing git, or any failure lists nothing rather than failing.

## Context

**User story**: the user runs `the-framework` inside an activated repository and it appears in the Projects list on its own; the dashboard's file tree and the composer's `#` file picker offer the files of the project or of an agent's [2] checkout [3].

## Glossary

[1] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Activated means the ignore file exists** - a repository is an activated project [1] when `.the-framework/.gitignore` exists as a file, the same marker activation itself checks before doing nothing twice; the daemon uses it to list the directory it was started in as a project.
- **The files git sees** - tracked and untracked files, minus what the ignore rules exclude, as sorted, deduplicated repository-relative paths; any failure lists nothing and never throws.
