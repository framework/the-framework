What the tests cover, against real files on disk and finished agents' lines handed to the tail:

- **Replay, then follow** - the lines already in the file are delivered first, and a line appended afterwards follows within the poll's cadence.
- **A rewritten log is re-read** - a file rewritten from scratch to exactly the same length is recognized as a fresh log and its new content delivered, not missed.
- **Malformed lines and stopping** - a line that is not JSON is skipped without breaking the stream, and nothing is delivered once the tail is stopped.
- **The replay boundary** - it lands exactly after the lines already logged and before any followed line; it is reported even when the file does not exist yet.
- **Following the diary into the finished agent** - lines appended in the same breath as the file disappears arrive exactly once each from the finished agent's lines, and the boundary is reported only once across the move.
- **No replay once finished** - a file fully consumed before it disappears delivers nothing more from the finished agent's lines.
- **Following a file that moves to another file** - the tail keeps its position across the move and follows appends at the new path.
- **Waiting for the new answer** - while the file is gone and nothing can be resolved yet, the tail idles rather than hopping somewhere wrong, then catches up once the finished agent appears.
- **A diary never seen in the checkout** - an agent started and recorded between two polls gets every finished line, and the boundary is still reported once.
- **A diary nowhere yet** - the boundary is reported at once with nothing to replay; the tail asks again each poll, still nowhere, then once the diary has a file it delivers that file from its first line and follows appends, the boundary reported only once.
- **An agent already finished** - every line, then the boundary, and nothing follows.
