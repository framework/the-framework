What the tests cover: the lifecycle of an agent's own checkout.

- A checkout is placed under the project's `.the-framework/branches/` directory, in a directory named after the agent's branch, and that branch is named after the agent id.
- Creating a checkout creates its branch, optionally from a stated base, and reports the path and branch back. An agent id that could escape the branches directory is refused before git is touched at all.
- Listing reports each registered checkout's path, commit and branch, treats a detached checkout as having no branch, and yields nothing when git fails or there is no repo.
- Removal tries a plain removal first and only forces when git calls the checkout unclean; removing a path that is already gone is harmless. Pruning is likewise tolerant of failure.
- Re-attaching a continued agent recreates its branch from the current head when the branch is gone, and still refuses a branch git will not attach — one another checkout already has out.
- A directory is judged a checkout root only when it is one: the project's main checkout and an agent's own both are, while a subdirectory of a checkout, a leftover `.the-framework/branches/` directory git no longer knows, and a directory in no repository at all are not. Asked plainly, that leftover directory reports the enclosing repository's branch — the bug — while the guarded read reports nothing for it and the real branch for a real checkout.
- Committing what an agent left behind stages and commits it in the agent's own checkout, leaves a clean checkout untouched, retries past a transient failure to win the lock, and reports failure so the caller keeps the checkout rather than deleting uncommitted work. A checkout whose pending files are past the safety commit's limit is refused after one look — nothing staged, no retries — with the reason logged.
- The branch currently checked out is reported, and a detached checkout or a non-repo reads as unknown.
- The branch is renamed to the session name only while the checkout is still on its original branch; an agent that already made its own branch is left alone, and a rename that fails never brings the agent down.
- Against a real repo: creating, listing and removing a checkout round-trips, and an agent's uncommitted edit survives teardown on the agent's branch after the checkout is gone.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
