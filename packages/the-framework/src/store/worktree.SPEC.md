The git-worktree lifecycle behind concurrent agents: each agent gets its own checkout on its own branch, so several on one repo never fight over the working tree.

## Flows

- An agent's branch is first named after its id (the only name that exists at start) and renamed to its chosen name once the agent picks one — unless the agent already moved to a branch of its own, which is then left alone.
- Continuing an agent re-attaches the branch its work is already on, rather than branching afresh and stranding what it did last time.
- Teardown commits whatever the agent left uncommitted before removing the checkout, so the branch outlives the worktree; the commit retries briefly past a transient lock race.
- Removal tries politely first and forces only as a told-about fallback; a checkout's size read is best-effort, since it only labels a delete button.

## Rationales

- Teardown commits first because the agent deliberately never commits its own final work, and removing the checkout without committing would destroy the diff.
- The commit retries because the daemon itself commits in the same checkout and is busiest exactly when teardown runs: a first attempt can lose a lock race, and giving up there would make the agent's real work read as nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
