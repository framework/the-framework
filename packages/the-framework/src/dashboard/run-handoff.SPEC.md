How a finished session's work is handed back to the human: measure what its branch holds, push it, open a pull request, and decide whether it may merge.

## TLDR

- Branch-addressed: a session reads the same whether or not its checkout still exists, and a locally-gone branch still reports its PR — a hands-off cloud run only ever pushed remotely.
- A session that produced nothing — no commits, or only the framework's own bookkeeping — is said so and never published.
- Push and a draft PR are armed by default; drafts keep the automatic path out of reviewers' inboxes, and uncommitted leftovers are swept into a commit first (guarded so only the session's own checkout and branch are ever committed).
- No PR number is stored: the run's PR is re-resolved live across the branch names it may have used, counting a closed PR only when it postdates the run's start — a reused branch never wears an old PR, and a branch with one never gets a second.
- Configuration arms an automatic merge; only the agent's declared-done signal plus an empty session backlog authorizes it, and a withheld merge still pushes and opens the draft for a human.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
