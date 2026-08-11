The tests cover the worktree lifecycle, against fakes and a real repo: add/list/remove/prune round-trips, teardown committing leftover work so it survives on the branch (retrying past a transient lock race, forcing removal only as a fallback), and branch renaming that never touches a branch the agent made itself.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
