Session persistence and workspaces: the append-only event log every surface is a projection of, and the per-session git worktrees the agents work in.

## TLDR

- Persisting *is* logging: a session's history is the events it appended, and everything else — status, name, branch, outcomes — is folded from that log into a small snapshot for cheap list reads.
- A session that crashed without saying goodbye is healed on the next boot: the missing end is synthesized, so no session stays "running" forever.
- Finished sessions are archived into the repo under a per-user directory, and live state beats the archive when both exist.
- Each session works in its own worktree on its own branch, with the parent checkout's dependency directories linked in instead of reinstalled.
- A daemon shutting down writes down which sessions were mid-flight so they can be offered for resume on the next boot.

## Flows

- **Persist by appending.** Every surface reads projections of the session's own event log; a restarted dashboard rehydrates by replaying it.
- **Heal on boot.** For a session with no recorded end, check whether its process is genuinely dead before synthesizing the missing end.
- **Archive on finish.** A finished session's history moves into the repo under a directory keyed by the user's configured git identity, visible to the whole team.
- **Workspace per session.** Create a worktree on a fresh branch, rename the branch once the agent picks a session name, link in the parent checkout's dependency directories, and hide the links from git.
- **Shutdown bookkeeping.** Mid-flight sessions are recorded at shutdown and offered for resume on the next boot — but only for a day.

## Rationales

- Folding status from the log instead of storing it separately means there is no second source of truth to drift.
- Sessions archive into the repo because the live state directory is untracked and an ordinary `git clean` used to erase a project's entire history.
- The archive is per-user (keyed by the git identity already configured) so two people on one repo sit side by side instead of conflicting — every user's archive being visible to the whole team is the point, not a leak.
- Dependency links are hidden from git so an agent's sweeping commit can't drag them onto the PR.
- Resume offers expire after a day; past that, a "resume?" would be more confusing than helpful.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
