Stamps live-feed events with their arrival time (#948): `stampReceived(event)` as it comes off the channel, `receivedAt(event)` to read it back — a `FrameworkEvent` carries no timestamp of its own.

## Decisions

- A `WeakMap` side table rather than a field on the event: the event type stays the framework's, and everything downstream (live-state selectors, the replay path, tests) keeps passing plain `FrameworkEvent[]`.
- Replayed events are never stamped, so a past run shows no times instead of wrong ones.
