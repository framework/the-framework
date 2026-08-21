The git-worktree lifecycle behind concurrent agents: each agent gets its own checkout on its own branch, so several on one repo never fight over the working tree.

## User Stories

- The user runs several agents on one repo at once, and their own checkout is never touched.
- The user sees the branch renamed to match the name the agent picks for itself.
- The user resumes an agent and it continues on the branch its work is already on.
- The user removes an agent's checkout and the uncommitted work survives on its branch.

## Flows

- An agent's branch is first named after its id — the only name that exists at start. Once the agent picks a session name, the branch is renamed to match; an agent that already moved to a branch of its own is left alone.
- When the user continues an agent, its new worktree re-attaches the branch its work is already on, rather than branching afresh and stranding what it did last time.
- Teardown commits whatever the agent left uncommitted before removing the checkout, so the branch outlives the worktree. The commit retries briefly past a transient lock race.
- Removal tries git's plain removal first and falls back to forcing, saying so when it does. A checkout's size read is best-effort, since it only labels a delete button.

## Rationales

- Teardown commits first because the agent deliberately never commits its own final work, and removing the checkout without committing would destroy the diff.
- The commit retries because the daemon itself commits in the same checkout and is busiest exactly when teardown runs: a first attempt can lose a lock race, and giving up there would make the agent's real work read as nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
