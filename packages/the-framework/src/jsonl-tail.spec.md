Generic tailer for append-only JSONL logs: incremental reads of newly appended lines, plus a watch+poll driver that follows a growing file.

## TLDR

- `JsonlTailer<T>` reads only bytes appended since the last `pull()`, buffers a torn trailing line until its newline arrives, JSON-parses each complete line and dispatches it to `onLine`.
- `followFile(dir, pull, opts)` drives a tailer: `fs.watch` on the directory for latency + a `setInterval` poll backstop; returns a stop function.
- One generic base behind two consumers: the daemon's event tail and the run's control tail (#344) — "one tailer, two directions".

## Problems

- Truncation detection: a fresh run truncates the log in place (same inode). Detected two ways — file shrank below the consumed offset, or size unchanged while mtime advanced (rewritten to same length) — either resets offset to 0 and re-reads from the top.
- Torn lines: a half-written line without newline is buffered in `partial`; a line that fails JSON.parse is silently skipped (the log never rewrites history, so it can only be a torn write).
- Process-safety (#996): every caller discards the pump promise, so a rejected read (EIO on network mount, EISDIR, log past kMaxLength) would be an unhandled rejection killing the process — swallowed, next tick retries. Likewise an `fs.watch` `'error'` with no listener throws out of the emitter; the handler closes and drops the watcher (it is spent once it errors) and the poll alone carries the tail.

## Decisions

- Poll backstop is mandatory because `fs.watch` is unreliable across platforms; the poll alone is a complete tail.
- Pulls are serialized: a pull already in flight swallows the next trigger (no queue).
- `unref` option lets steering hold a scheduled poll without keeping the process alive.
- A missing file (`open` fails) is "nothing written yet", not an error.

## Facts

- Errors during JSON parse of a line are never surfaced — deliberately not even logged, since a persisting fault would otherwise print once per poll forever.
- `followFile` seeds with an immediate pull so already-written content is delivered on start.
