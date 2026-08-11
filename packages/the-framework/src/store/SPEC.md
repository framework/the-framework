Session persistence and workspaces: the append-only event log every surface is a projection of, and the per-session git worktrees the agents work in.

## TLDR

- Persisting is logging: a session's history is the events it appended, and everything else — status, name, branch, outcomes — is folded from that log into a small snapshot for cheap list reads. A restarted dashboard rehydrates by replaying the log; there is no second source of truth to drift.
- A session that crashed without saying goodbye is healed on a later boot or read: after checking its process is genuinely dead, the missing ending is written on its behalf, so no session stays "running" — or keeps asking its last question — forever.
- Finished sessions are archived into the repo under per-user directories and committed, because the live state is untracked and an ordinary `git clean` used to erase a project's entire history. Every user's archive is visible to the whole team — that is the point, not a leak — and live state beats the archive when both exist.
- Each session works in its own worktree on its own branch (renamed once the agent picks a session name); teardown commits leftover work first, so the branch outlives the checkout. The parent checkout's installed dependencies are symlinked in instead of reinstalled — instant, no extra disk — and hidden from git so an agent's sweeping commit cannot drag them onto the PR.
- A daemon shutting down writes down which sessions were mid-flight so the next boot can resume them — but only for a day; after that a resume would be more confusing than helpful.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
