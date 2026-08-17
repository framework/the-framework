The git-worktree lifecycle behind concurrent agents: each agent gets its own checkout on its own branch, so several on one repo never fight over the working tree.

## TLDR

- An agent's branch is first named after its id (the only name that exists at start) and renamed to its chosen name once the agent picks one — unless the agent already moved to a branch of its own, which is then left alone.
- Continuing an agent re-attaches the branch its work is already on, rather than branching afresh and stranding what it did last time.
- Teardown commits whatever the agent left uncommitted before removing the checkout — the agent deliberately never commits its own final work, and removing without committing would destroy the diff — so the branch outlives the worktree; the commit retries briefly past a lock race that once made an agent's real work look like nothing.
- Removal tries politely first and forces only as a told-about fallback; a checkout's size read is best-effort, since it only labels a delete button.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
