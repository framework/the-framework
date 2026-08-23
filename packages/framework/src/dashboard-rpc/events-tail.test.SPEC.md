What the tests cover: how a subscriber to an agent's event log is fed, and what happens when that log moves.

- A subscriber first receives everything already logged, then each newly appended event.
- A log rewritten from scratch by a fresh agent is recognised as a rewrite and replayed from its new beginning, even when the new content happens to be exactly as long as the old.
- Malformed lines are skipped without breaking the feed, and nothing is delivered after the subscriber stops.
- The end-of-replay announcement lands exactly between the history and the first newly appended event, and it is still made when the log does not exist yet, so a client waiting on it never hangs.
- When an agent's event log moves — its final events appended and the log retired into the archive in the same breath — the subscriber receives every event, each exactly once, and the end-of-replay announcement is not repeated for the move.
- A log that was already fully read before it moved is not replayed again from its new location.
- While the log's new location cannot be resolved yet, the subscriber idles instead of following the wrong file, and catches up once the new location appears.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
