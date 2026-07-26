---
"@gemstack/the-framework": patch
---

Fix a session showing (and acting on) the wrong PR (#1251, #1255). A run's PR is now resolved from the run's own branch names and start time: an open PR on the branch counts, a closed one only when it was created after the run started. Previously the session header could show a predecessor's merged PR (a triage prompt pins its branch name, and `gh pr view` answers with the newest PR in any state), which also made auto-handoff skip opening the real PR; and once a finished run's worktree was gone, the PR link degraded to whatever branch the project root checkout was on, giving every finished run the same PR. Hands-off web runs are now found through their unique run-id branch, and a branch that no longer exists locally still reports its PR.
