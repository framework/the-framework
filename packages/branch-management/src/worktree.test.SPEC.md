What the tests cover: the lifecycle of an agent's own checkout.

- A checkout is placed under the project's `.branches/` directory, in a directory named after the agent's branch, and that branch is named after the agent id.
- Creating a checkout creates its branch, optionally from a stated base, and reports the path and branch back. An agent id that could escape the branches directory is refused before git is touched at all.
- Listing reports each registered checkout's path, commit and branch, treats a detached checkout as having no branch, and yields nothing when git fails or there is no repo.
- Removal tries a plain removal first and only forces when git calls the checkout unclean; removing a path that is already gone is harmless. Pruning is likewise tolerant of failure.
- Re-attaching a continued agent recreates its branch from the current head when the branch is gone, and still refuses a branch git will not attach — one another checkout already has out.
- A directory is judged a checkout root only when it is one: the project's main checkout and an agent's own both are, while a subdirectory of a checkout, a leftover `.branches/` directory git no longer knows, and a directory in no repository at all are not. Asked plainly, that leftover directory reports the enclosing repository's branch — the bug — while the guarded read reports nothing for it and the real branch for a real checkout.
- Whether a checkout is clean is a read that commits nothing: a checkout with uncommitted work reads dirty, a clean one reads clean.
- The branch currently checked out is reported, and a detached checkout or a non-repo reads as unknown.
- Naming: a rename that loses the race to a sibling taking the same name re-reads the branches and takes the next suffix; any other rename failure is raised. (The rest of naming — the suffix rule, the refusals — is covered against real git by the command-line tests.)
- Listing the checkouts on disk names the agent of each `agent-<agent id>` directory, ignores anything else in the branches directory, yields nothing for a project that never ran an agent, and never mistakes a rename link or a file for a checkout — only a directory is one.
- Against a real repo: creating, listing and removing a checkout round-trips; an agent's uncommitted edit reads dirty and is never swept into a commit, and once the agent commits, the edit survives on the agent's branch after the checkout is gone.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
