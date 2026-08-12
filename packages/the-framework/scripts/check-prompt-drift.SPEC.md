Fails when the prompt files drift from the GitHub issue where the system prompt is designed and reviewed — the issue is the source of truth ("change it there first"), and this guards the sync direction that once went unnoticed for two days.

## TLDR

- The system prompt ships verbatim, so issue and repo copy are compared directly; the post-merge block cannot ship verbatim (it nests one template fragment inside another), so it is compared against a reviewed snapshot — when the design moves, a human re-flattens it and refreshes the snapshot.
- An unreachable GitHub skips the check (an outage is not drift), while a misconfigured request fails hard, since silently passing would make the check a no-op.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
