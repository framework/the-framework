Surfaces: one replayable multi-consumer event stream serving a terminal sink, an in-page/SSE consumer, and a detached background handle.

## TLDR

- `EventStream` buffers every event (no eviction) and gives each iterator its **own cursor** over the shared buffer — a late subscriber replays all history, then goes live; `history(fromOffset)` serves polling clients.
- `launchAutopilot` wraps a run into a handle (status / events-from-offset / stream / result), generic over the event type, so bootstrap and supervisor runs launch the same way.

## Facts

- The iterator implements `return()` to remove its waiter — without it, a disconnected SSE consumer leaks until the next push. The subtlest code in the directory.
- The handle attaches a no-op catch to the result so an unobserved failure never becomes an unhandled rejection — the real rejection still arrives through `result()`.
- `push` is a bound property usable directly as an event callback, and a no-op after close.
- The bundled formatter/terminal sink understands supervisor events only; bootstrap and product narration format themselves.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
