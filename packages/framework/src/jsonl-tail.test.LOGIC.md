What the tests cover:

- **Only new lines** - only the lines appended since the last read are delivered; a file that does not exist yet delivers nothing and is not an error.
- **A torn trailing line** - a last line without its newline is held back, and delivered once its newline arrives.
- **A rewritten file** - a file rewritten to the very same length is read again from the top.
- **A failing read surfaces to the follower** - reading a path that opens but cannot be read as a file (a directory) rejects, which is exactly what the follower has to absorb.
- **The follower survives failing reads** - reads that fail on the first attempts do not stop the polling, which continues and recovers; the same holds with the real tailer pointed at a directory.
- **A watcher failure does not end the tail** - a failure of the directory watch neither crashes the process nor stops delivery: lines appended afterwards still arrive through the poll.
- **Not holding the process open** - a follower started as not holding the process open lets the process exit, the directory watch included, instead of pinning it forever.
