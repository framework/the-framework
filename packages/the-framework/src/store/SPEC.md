Agent persistence and workspaces: the append-only event log every surface is a projection of, and the per-agent git worktrees they work in.

## User Stories

- The user's own checkout is never touched: each agent works in its own worktree on its own branch.
- The user sees a project's history — every user's finished agents — survive restarts, crashes, and even a `git clean`.
- The user removes an agent's checkout and still finds the work on its branch.
- The user never finds a crashed agent still shown as running.

## Flows

- Persisting is logging: an agent's history is the events it appended, and everything else — status, name, branch, outcomes — is folded from that log into a small snapshot for cheap list reads. A restarted dashboard rehydrates by replaying the log.
- An agent that crashed without saying goodbye is healed on a later boot or read: after checking its process is genuinely dead, the missing ending is written on its behalf, so none stays "running" — or keeps asking its last question — forever.
- Finished agents are archived into the repo under per-user directories and committed; every user's archive is visible to the whole team, and live state beats the archive when both exist.
- Each agent works in its own worktree on its own branch, named after its id until the agent picks a session name. Teardown commits leftover work first, so the branch outlives the checkout. The parent checkout's installed dependencies are symlinked in instead of reinstalled — instant, no extra disk — and hidden from git so a sweeping commit cannot drag them onto the PR.
- Nothing is resumed at boot; what boot does instead is mark as stopped anything a dead process left claiming to be running.

## Rationales

- There is no second source of truth to drift: every read is a fold of the log, and a restart replays it rather than reconciling a separate state model.
- The archive is committed because untracked state does not survive an ordinary `git clean`: without the commit, one clean would erase a project's entire history.
- Every user's archive being visible to the whole team is the point, not a leak.
- Nothing is resumed at boot because Ctrl-C closed the last dashboard and every agent it was running — a deliberate act rather than a crash to recover from.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
