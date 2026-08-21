Streams one agent's events live to the browser: everything already logged is replayed, then each new event as it happens.

## Flows

- The agent id picks whose journal to follow — each agent logs in its own checkout — so the feed is that agent's alone; without it, the project root's journal is followed, which is only right for an agent that has no checkout.
- The tail follows the journal when teardown archives it mid-stream, so a watcher never misses the ending — but an agent-scoped feed never falls back to the project-root journal, which is another agent's story: a deleted agent's tab goes quiet instead.
- After the replay, a one-time caught-up marker lets a reconnecting viewer swap its feed whole instead of blanking and refilling; the marker travels only on the wire, never into any journal.
- An agent with no file on this host — one relayed from a device — streams from memory instead.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
