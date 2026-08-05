Session persistence and workspaces: the append-only event log every surface is a projection of, and the per-session git worktrees the agents work in.

## TLDR

- Persisting *is* logging: a session's history is the events it appended, and everything else — status, name, branch, outcomes — is folded from that log into a small snapshot for cheap list reads. A restarted dashboard rehydrates by replaying the log; there is no second source of truth to drift.
- A session that crashed without saying goodbye is healed on the next boot: the missing end is synthesized (checking whether the process is genuinely dead), so no session stays "running" forever.
- Finished sessions are archived into the repo under a per-user directory (keyed by the git identity already configured), because the live state directory is untracked and an ordinary `git clean` used to erase a project's entire history. Every user's archive is visible to the whole team — that's the point, not a leak. Live state beats the archive when both exist.
- Each session works in its own worktree on its own branch (renamed to the session's chosen name once the agent picks one). The parent checkout's dependency directories are linked in instead of reinstalled — instant, no extra disk — and the links are hidden from git so an agent's sweeping commit can't drag them onto the PR.
- A daemon shutting down writes down which sessions were mid-flight so they can be offered for resume on the next boot — but only for a day; after that a "resume?" would be more confusing than helpful.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
