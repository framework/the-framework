What the tests cover, against real files on disk:

- **Replay, then follow** - the lines already in the file are delivered first, and a line appended afterwards follows within the poll's cadence.
- **A rewritten log is re-read** - a file rewritten from scratch to exactly the same length is recognized as a fresh log and its new content delivered, not missed.
- **Malformed lines and stopping** - a line that is not JSON is skipped without breaking the stream, and nothing is delivered once the tail is stopped.
- **The replay boundary** - it lands exactly after the lines already logged and before any followed line; it is reported even when the file does not exist yet.
- **Following the file into the archive** - lines appended in the same breath as the move to a new path arrive exactly once each, and the boundary is reported only once across the move.
- **No replay after the move** - a same-content copy with a newer modification time and the same length is not replayed once the tail follows it.
- **Waiting for the new home** - while the file is gone and no new path can be resolved yet, the tail idles rather than hopping somewhere wrong, then catches up once the new path appears.
