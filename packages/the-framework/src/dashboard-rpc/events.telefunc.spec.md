The live event stream telefunction (#405): `onEvents(projectId, runId?)` returns a Telefunc Channel streaming one run's feed — its `FrameworkEvent`s plus the wire-only `stream-sync` end-of-replay marker (#1383); `.close()` stops the tail.

## TLDR

- Two sources, chosen by the mount: an in-memory `EventsSource` on the context wins (the relay's own run #426, or a run the daemon relays from a device #1067, replay+follow via `forwardStream`); otherwise the run's on-disk `events.jsonl` is tailed via `tailEvents`.
- The daemon's source answers only for relayed runs, so ordinary local runs fall through to file tailing unchanged.
- With `runId` the tail follows that run's own log inside its worktree (#749) — since #736 runs append there, so the project-root feed for a worktree run is empty; omitting it keeps pre-#736 behavior.
- Unknown project → a channel that closes immediately, mirroring the read model's empty results rather than throwing at the client.
- `stream-sync` (#1383): sent once per subscription by the on-disk tail after the replay is delivered, so a reconnecting client can swap its feed atomically instead of blanking while history re-streams. Wire-only — not a `FrameworkEvent`, never journaled, swallowed client-side. The in-memory sources have no replay boundary to report and send none; the client falls back to a grace deadline.

## Facts

- Each JSONL line maps 1:1 to a `channel.send(event)`; serialization, validation and reconnect come from Telefunc.
- Events path: `<checkout>/.the-framework/events.jsonl` (`FRAMEWORK_DIR`/`EVENTS_FILE`).
