The read-only shared-run watch view (#426/#230) shown when the dashboard is opened on the relay at `/?run=<id>` — a teammate watches one run's live feed without any rails or steering.

## TLDR

- Renders a minimal header (Logo + "watching" badge + "read-only shared session") over a `RunFeed` of the run's streamed events.
- Streams via `useLiveEvents(runId)` — the run id rides in the `projectId` slot because the relay keys its in-memory `onEvents` Channel by run id (it has no project registry).
- `isRunActive(events)` drives the animated Logo and the favicon (#875), since the one watched run is all the relay knows about.

## Facts

- An unknown or ended run closes the channel cleanly with zero events and `done: true`; the view then says the session isn't available instead of showing "Waiting for the session to start…" forever (#948).
