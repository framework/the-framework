What the tests cover: which event log an agent's page shows, once the agent has finished.

- A finished agent swaps to its archived event log as soon as that archive has events.
- An empty archive never replaces the events already on screen, because "empty" also means "not archived yet" and stopping an agent races the archive being written.
- An agent with nothing in either place still says it has no events.
- A resumed agent's new leg is shown the moment the live stream carries it, rather than being hidden behind the stale archive until the daemon's poll catches up.
- A longer event log that is not this agent's own — the project root's, which an ended agent falls back to once its worktree is gone — never beats the agent's archive.
- Once the archive is re-read and has caught up, it takes back over, which is how events that only ever land in the archive (a clean agent's handoff, and the PR it opened) reach the screen without a manual refresh.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
