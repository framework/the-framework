Agent persistence and workspaces: the append-only event log every surface is a projection of, and the per-agent git worktrees they work in.

## TLDR

- Persisting is logging: an agent's history is the events it appended, and everything else — status, name, branch, outcomes — is folded from that log into a small snapshot for cheap list reads. A restarted dashboard rehydrates by replaying the log; there is no second source of truth to drift.
- An agent that crashed without saying goodbye is healed on a later boot or read: after checking its process is genuinely dead, the missing ending is written on its behalf, so none stays "running" — or keeps asking its last question — forever.
- Finished agents are archived into the repo under per-user directories and committed, because the live state is untracked and an ordinary `git clean` used to erase a project's entire history. Every user's archive is visible to the whole team — that is the point, not a leak — and live state beats the archive when both exist.
- Each agent works in its own worktree on its own branch (named after its id until it picks a session name); teardown commits leftover work first, so the branch outlives the checkout. The parent checkout's installed dependencies are symlinked in instead of reinstalled — instant, no extra disk — and hidden from git so a sweeping commit cannot drag them onto the PR.
- Nothing is resumed at boot. Ctrl-C closed the last dashboard and every agent it was running, which is a deliberate act rather than a crash to recover from; what the next boot does instead is mark as stopped anything a dead process left claiming to be running.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
