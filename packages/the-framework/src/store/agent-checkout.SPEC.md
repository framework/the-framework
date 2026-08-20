Resolves which checkout — and which event journal — a session id points at, one shared rule for every surface that addresses a session by id.

## Flows

- Order: the live agent's own recorded checkout first, then its worktree directory — which exists before the agent has written any state — and finally the project root, the sane thing to act on for an unknown or finished id.
- The events variant differs in one place: for an ended agent whose worktree is gone, its archived log wins over the project's shared journal.

## Rationales

- The worktree-directory probe matters because a subscriber resolves its path once: falling back to the project root would have it tail the wrong file for its whole life.
- For an ended agent, the archived log wins because the archive is the agent's own record and proves it ended.
- Shared on purpose, so the fallback rules cannot drift apart between the daemon and the dashboard.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
