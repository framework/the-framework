The shared live run feed (#405): `useLiveEvents(projectId, runId?, resetKey?)` streams `FrameworkEvent`s over a Telefunc Channel and returns `{events, lost, done}`.

## TLDR

- The dashboard is a projection of the selected run's `.the-framework/events.jsonl`; the channel pushes one `FrameworkEvent` per new line, stamped with an arrival time (`stampReceived`) on the way in.
- The subscription lives here because two consumers (main event view and the right rail's choice gates, #440) read the same stream — each owns one channel instead of opening a second.
- `lost`: stream down and being retried (feed may be behind reality); `done`: the server closed on purpose (relay stream ended, unknown run) — final.

## Problems

- A dead stream used to be silent (#948): daemon restarts, events just stop, and "agent went quiet" was indistinguishable from "feed died". Now an errored close or failed subscribe flips `lost` and retries with backoff (1s/2s/4s then settling at 8s); a clean close is deliberate and neither alarms nor retries.
- Run boundary vs. buffer: the subscription survives run boundaries (resets only on project/run-id change), so a new Start would keep showing the finished run until events.jsonl is truncated. `resetKey` (bumped by a fresh Start) clears the buffer WITHOUT tearing down the subscription; the pane waits empty and JsonlTailer's rewrite detection re-reads the truncated file (#705 jump-to-live would otherwise show the old run).
- Reconnect duplicates vs. the mid-run blank (#1383): the tail replays the whole log on subscribe. Clearing the buffer on every (re)subscribe avoided duplicate history but blanked a populated feed while the replay re-streamed — the lost banner cleared on resubscribe, then the feed sat empty until the replay caught up. Now only the FIRST subscribe of an effect starts clean (the pane was just cleared anyway); a RECONNECT buffers the replay and swaps atomically on the server's `stream-sync` marker, or at `SYNC_GRACE_MS` (1.5 s) for in-memory sources that send none (relay #426, relayed device #1067). The feed never shows less than it already showed (#1402's rule applied to the live channel). A close mid-replay drops the partial buffer — swapping it in would be the collapse this prevents.

## Decisions

- The feed is per RUN, not per project (#749): each run tails its own worktree's log since #736, so `runId` is an effect dependency — selecting run A vs B resubscribes to different logs. Omitted (relay, or a Start whose id isn't adopted yet) falls back to the project root.
- Events are additionally scoped through `currentRunEvents()` so a second run never shows the previous run's lines even within one long-lived buffer.

## Flows

- subscribe (first): `onEvents(projectId, runId)` → clear buffer, `attempt = 0`, `lost = false` → `listen`: swallow `stream-sync`, stamp + append each event → `onClose(err)`: err → `retry()` (backoff, `lost = true`); clean → `done = true`.
- subscribe (reconnect): keep the shown feed → buffer replayed events → swap wholesale on `stream-sync` or at the grace deadline → append live after; a close mid-replay discards the buffer.
- teardown/switch: effect cleanup sets `cancelled`, clears the retry timer, closes the channel.
