What the tests cover:

- **Replay, then live** - events buffered before anyone was listening are delivered first, and an event pushed afterwards follows.
- **Stopping** - nothing pushed after the stop is forwarded.
- **An absent stream** - forwarding nothing is a no-op whose stop can be called twice without effect.
