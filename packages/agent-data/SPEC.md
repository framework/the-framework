A branch of a project's repository used as a file store, as an npm library: `agent-data`, the one branch every skill a coding agent uses keeps its files on, checked out once under the project's `.branches/`. Every write goes through one cycle — sync with origin, apply the change, commit, push, re-apply when the push loses a race — from a long-lived process's checkout, or one-shot from any clone. It ships the git runner and the exclude rule that machinery is built on, plus the two names every consumer needs: the checkouts directory and the data branch.

A library, not a skill: it is read by code, never by an agent, so it ships no `SKILL.md` and no command. It knows git and the filesystem, nothing else — the caller names the branch and decides what the files mean. Every skill that keeps files on the branch depends on it; no skill depends on another.

## Business logic — TL;DR

- **The two names** (`names`) - `.branches`, the directory every checkout of a project lives under, and `agent-data`, the shared data branch: defined once, importable without pulling in git.
- **Running git** (`git`) - one runner with a time budget per subcommand, a timeout told apart from a git failure, whether a directory is in a working tree and which checkout it is in, and a push whose failure is git's own reason.
- **Hidden from the project's git** (`git-exclude`) - a rule in git's own exclude list, never a tracked file, covering every worktree of the repository at once.
- **A branch used as a file store** (`file-branch`) - a branch the caller names, holding files nobody edits in a working tree: born parentless or adopted from origin, written through one serialized cycle from a long-lived process's checkout or one-shot from any clone, readable from anywhere without holding a copy.
- **The entry point** (`index`) - everything above in one place for a caller to import.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
