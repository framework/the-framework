What the tests cover: which event log a view scoped to one agent follows.

- A missing or unsafe agent id falls back to the project root's event log.
- An agent whose worktree still exists follows that worktree's own event log.
- An agent whose worktree is gone but whose archive exists follows the archived event log rather than the project root's — including when the archive is filed under a user directory on the logs branch.
- A live worktree wins over an archive left from an earlier stint, so a resumed agent streams its current output.
- An agent id with neither worktree nor archive still falls back to the project root's event log.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
