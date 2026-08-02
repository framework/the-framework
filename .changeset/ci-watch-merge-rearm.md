---
'@gemstack/the-framework': patch
---

The CI watch re-arms a failed merge attempt when the PR's head changes (fix #1484): `attemptedMerges` is now keyed by head sha, so a watched PR that arrived unmergeable (a stale-branch bookkeeping conflict, say) gets exactly one more attempt once the conflict is resolved and its checks rerun — instead of being skipped for the daemon's lifetime.
