Tails a `.the-framework/events.jsonl` — replays what is logged, then follows appends, handing each parsed JSONL line to `onEvent` (malformed lines skipped) and returning a stop function. `onReplayed` fires once, between the replay and the first follow-append (#1383) — the boundary a reconnecting client swaps its feed on.

## Decisions

- Built from the store's shared `JsonlTailer` + `followFile` (the same pieces as the run's control tail) instead of its own copy — the old copy missed the tailer's same-length-rewrite detection (#567).
- Transport-agnostic (plain callback, not a Channel) so the file side is testable alone; `events.telefunc.ts` wires it to a Telefunc Channel.

## Facts

- `fs.watch` is backstopped by a 1 s poll (`POLL_MS`).
- `onReplayed` fires even when the first read fails or the log does not exist yet (an empty replay, not a marker withheld): a client waiting forever would freeze its feed; the follower's poll retries the read.
