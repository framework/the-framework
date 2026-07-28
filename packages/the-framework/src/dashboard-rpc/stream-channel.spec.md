Channel plumbing shared by the event stream: wrap a live source in a Telefunc Channel, and pump an async-iterable into a send sink.

## TLDR

- `streamChannel(start)` owns the whole Channel lifecycle (#405/#426): `start` gets a `send` sink and returns a stop function wired to `.close()`; returning undefined (unknown project, nothing to stream) closes the channel immediately, mirroring the read model's empty results rather than throwing at the client.
- `forwardStream(iterable, send)` (#426) forwards an async-iterable — the relay's in-memory run, which replays buffered history then follows live, exactly what `serveSSE` consumes — until exhausted or stopped; the stop is idempotent and cancels the iterator via `iterator.return()`, releasing a follower waiting on the next event.

## Decisions

- `forwardStream` stays transport-agnostic (plain `send` callback, not a Channel) so the pump is testable on its own; `streamChannel` wires the Channel.
- The `as never` on `channel.send` works around telefunc's `ChannelData<T>` not resolving for a free type parameter.
