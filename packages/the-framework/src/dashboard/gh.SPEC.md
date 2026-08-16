Everything the dashboard asks or tells GitHub — pull request lookups, merging, CI status — in one place.

## TLDR

- Reads are quick, cached, and forgiving: an unreachable GitHub reads as nothing, never a failed page.
- An agent's PR is picked from its branch's whole history — an open PR always counts, a closed one only if created after the agent began — so a reused branch name cannot wear a predecessor's merged PR.
- Merging prefers GitHub's auto-merge, so the PR lands when its checks pass; where the repo refuses, a human-requested merge goes through directly, while the automatic path merges only on green checks and otherwise hands the PR to the daemon's CI watch — unverified work never lands.
- A draft in the way is marked ready and retried: asking for the merge says its review already happened.
- CI status boils down to passing, failing (naming the failures), pending, or none; an unreadable status is never green.
- A cloud agent authenticates with a token from the environment or, failing that, the user's existing GitHub login.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
