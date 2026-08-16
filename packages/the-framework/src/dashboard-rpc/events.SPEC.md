Streams one agent's events live to the browser: everything already logged is replayed, then each new event as it happens.

## TLDR

- The session id picks whose journal to follow — each session logs in its own checkout — so the feed is that session's alone; without it, the project root's journal is followed, which is only right for a session that has no checkout.
- The tail follows the journal when teardown archives it mid-stream, so a watcher never misses the ending — but an agent-scoped feed never falls back to the project-root journal, which is another agent's story: a deleted agent's tab goes quiet instead.
- After the replay, a one-time caught-up marker lets a reconnecting viewer swap its feed whole instead of blanking and refilling; the marker travels only on the wire, never into any journal.
- A session with no file on this host — the relay's own, or one relayed from a device — streams from memory instead.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
