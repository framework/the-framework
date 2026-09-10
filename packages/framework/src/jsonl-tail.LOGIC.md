Follows an append-only JSONL file, one JSON value per line, delivering each complete line exactly once as it is written: the daemon tails an agent's [1] event stream [2] this way for the dashboard, and an agent's process tails its control file [3] the same way for steering. A reader sees only what was appended since it last looked and never a half-written line; a file truncated or rewritten by a fresh agent is read again from the start; a file relocated intact is followed from the same offset; and the follower that drives the reads survives everything that can go wrong in it.

## Context

**Business logic story**: the file is the seam between an agent and the daemon. The agent appends events to `.the-framework/events.jsonl` in its checkout [4] and the dashboard is a projection of that file; the daemon appends stops, picks and messages to `.the-framework/control.jsonl` and the agent's process reads them from there. Neither side talks to the other directly, so the tail has to be right about what is new, what is torn, and what was replaced.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[4] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] archive: The transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.

## Business logic — TL;DR

- **Only what is new** - each read starts where the previous one ended and delivers the complete lines appended since; a file that does not exist yet delivers nothing and is not an error.
- **A torn line waits for its newline** - the trailing fragment without a newline is held back and delivered once the rest arrives; a line that still does not parse is skipped, because the file never rewrites history.
- **Truncation and rewrite restart the read** - a file that shrank below what was consumed, or that was rewritten to the same length, is read again from the top, so a fresh agent's stream replaces the old one.
- **Relocation carries the offset** - when the file is copied intact elsewhere, the tail is pointed at the copy and continues from the same offset, delivering only the lines the move would have swallowed and replaying nothing.
- **The follower never dies** - change notifications trigger reads and a periodic poll guarantees them; reads never overlap; a failed read or a broken watcher is survived and the poll carries on alone; a follower marked as not holding the process open releases both its handles.

## Business logic

### Only what is new

#### Context

See `## Context`.

#### Business logic

The tail remembers how many bytes it has consumed and each read takes only the bytes appended past that point, so a line is delivered once and a file that grew by one line costs one line's read. A file that cannot be opened yet, because nothing has written it, delivers nothing and is not an error: the next read tries again. Blank lines are ignored.

### A torn line waits for its newline

#### Context

**Problem**: a writer appends a line in one call, but a reader can look between the write of the bytes and the write of the newline, or during a partial write, and would then parse half a line.

#### Business logic

Whatever follows the last newline is kept back as a fragment and prepended to the next read, so a line is delivered only once its newline has arrived. A complete line that still fails to parse as JSON is skipped: the file is append-only and never rewrites history, so a bad line will not be fixed later and must not stop the lines after it.

### Truncation and rewrite restart the read

#### Context

**Business logic story**: a fresh agent [1] starting in a checkout [4] truncates the event stream [2] in place, and a new control file [3] replaces the old one. The reader must switch to the new content instead of waiting for the old file to grow past where it was.

#### Business logic

Two signs mean the file was replaced: its size fell below what was consumed, or its size is unchanged but its modification time advanced, which is a rewrite to the same length. Either way the read restarts from the top with an empty fragment, and the new content is delivered from its first line.

### Relocation carries the offset

#### Context

**Business logic story**: at teardown an agent's [1] events are copied verbatim into the archive [5] and its checkout [4] is removed; on a continuation the copy is restored into a checkout. A tail fixed on the old path would go silent without the agent's final events.

#### Business logic

A tail can be pointed at the file's new home while keeping its offset. Because the copy is content-identical, the bytes already consumed are a prefix of the new file, so the next read delivers exactly the lines the move would otherwise have swallowed and replays nothing. The first read after a move adopts the copy's modification time, which is younger than the original's by construction, instead of treating it as a same-length rewrite that would replay every line already delivered.

### The follower never dies

#### Context

**Problem**: the follower runs unattended for the life of an agent [1] or of the dashboard. A read that fails (a network mount, a directory where a file was expected, a file grown past what can be read at once) or a watcher that errors would, unhandled, end the process; and a tail that holds the process open would keep a finished agent alive forever.

#### Business logic

A follower watches the file's directory for change notifications, which give latency, and polls on a fixed period, which guarantees delivery where notifications are unreliable; the first read happens at once so whatever is already written is delivered. Reads are serialized: a trigger arriving during a read is dropped, since the read in progress picks up the same bytes. A read that fails is swallowed and retried at the next trigger, not logged, because a persisting fault would otherwise print once per poll forever. A watcher that errors is dropped and the poll alone carries the tail, which is a complete tail on its own. A follower started as not holding the process open releases both the poll and the watch, since either one alone would keep the process alive; this is how steering alone never keeps a finished agent's process running. Stopping the follower ends both.
