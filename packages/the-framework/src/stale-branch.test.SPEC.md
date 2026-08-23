What the tests cover: a pinned routine branch whose pull request is closed is released (both the remote and the local copy; a remote-only leftover leaves local refs untouched); an open PR keeps the branch as genuinely pending work; a branch with no PR history is treated as unprovable and kept; a branch that exists nowhere reports "absent" without querying PR history at all; and git refusing the deletions does not throw — the outcome still reads as released and the next sweep tick retries.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
