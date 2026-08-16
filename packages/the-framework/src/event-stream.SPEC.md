A replayable, multi-consumer stream of events: every event is buffered, live consumers get async iterators, and history replays from any offset.

## TLDR

- One producer, many consumers: pushing an event wakes every waiting iterator, and a consumer that arrives late replays what it missed from an offset rather than starting blank.
- Closing is final and idempotent: pushes after a close are ignored and every live iterator ends, so a finished agent cannot leave a reader hanging.

## Notes

- Absorbed from `@gemstack/ai-autopilot` when that package was deleted. Its element type used to default to the supervisor's event type; the only caller here passes `FrameworkEvent`, so the type parameter is required.
