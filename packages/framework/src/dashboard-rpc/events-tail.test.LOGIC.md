What the tests cover, against real files on disk and finished agents' lines handed to the tail:

- **Replay, then follow** - the lines already in the file are delivered first, and a line appended afterwards follows within the poll's cadence.
- **A rewritten log is re-read** - a file rewritten from scratch to exactly the same length is recognized as a fresh log and its new content delivered, not missed.
- **Malformed lines and stopping** - a line that is not JSON is skipped without breaking the stream, and nothing is delivered once the tail is stopped.
- **The replay boundary** - it lands exactly after the lines already logged and before any followed line; the plain tail reports it even when the file does not exist yet.
- **Following the diary into the finished agent** - lines appended in the same breath as the file disappears arrive exactly once each from the finished agent's lines, and the boundary is reported only once across the move.
- **No replay once finished** - a file fully consumed before it disappears delivers nothing more from the finished agent's lines.
- **Following a file that moves to another file** - the tail keeps its position across the move and follows appends at the new path.
- **Waiting for the new answer** - while the file is gone and nothing can be resolved yet, the tail idles rather than hopping somewhere wrong, then catches up once the finished agent appears.
- **A diary never seen in the checkout** - an agent started and recorded between two polls gets every finished line, and the boundary is still reported once.
- **A diary nowhere yet** - nothing is reported while the diary is nowhere; the tail asks again each poll, then once the diary has a file it delivers that file from its first line, reports the boundary after those lines, once, and follows appends; when it turns up finished instead, the finished lines are delivered, then the boundary.
- **A checkout whose diary is not written yet** - no boundary is reported over a file that is not there; once the file is written its lines are delivered, then the boundary, once, and appends follow.
- **The message being written** - a change to only the live file beside the diary is read on the diary's watch; each new text is sent once, and an empty text once the file is gone.
- **An agent already finished** - every line, then the boundary, and nothing follows.
- **A finished agent that is resumed** - after the finished lines, the tail keeps asking from cached reads; the resumed agent's file, starting with the lines already delivered, delivers only the new ones and its appends; ended again, the extra finished lines arrive.
- **A diary rewritten in place** - an agent's diary written again whole with the same lines delivers nothing again; a line appended after that is delivered once; written again and grown in one step, it delivers only the new line.
- **A diary that is there and still empty** - no boundary is reported while the file holds nothing; once its first lines are written they are delivered, then the boundary.
