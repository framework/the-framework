Tails an agent's [1] events [2] file for the live stream: everything already written is delivered first, then each new complete line as it is appended, with the end of the replay reported exactly once. For an agent whose file moves, the tail follows it to its new home, delivering every line once and repeating none.

## Context

**Business logic story**: the events file is append-only, one event per line, written by the agent's process. The tail reads only the bytes appended since its last read and follows the file by watching its directory, with a poll every second as the backstop because directory watching is unreliable across platforms. The reading and following are the same pieces the agent's control tail is built from (`jsonl-tail.ts`); this adds the replay boundary and the relocation.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event / event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Read what is there, then follow** - the lines already logged are delivered first, then each new line as it lands; a malformed line is skipped; a file rewritten from scratch is re-read from the top; a stopped tail delivers nothing more.
- **The replay boundary is reported once** - after the first read and before any followed line, even when the file does not exist yet or the first read fails, and never a second time.
- **The tail follows a relocated file** - a file that existed and is now gone is asked for its new home; the tail moves there carrying its position, so the lines the move swallowed arrive exactly once and nothing already delivered is repeated.

## Business logic

### Read what is there, then follow

#### Context

See `## Context`.

#### Business logic

The tail first delivers every complete line already in the file, then follows appends: a change in the file's directory or the one-second poll triggers a read of the bytes added since the last one, and a line whose newline has not arrived yet waits for it. A line that is not valid JSON is skipped and never breaks the stream. A file that shrank below what was already read, or was rewritten to the same length with a newer modification time, is treated as a fresh agent's log and re-read from the top (the detection is `jsonl-tail.ts`'s). A file that does not exist yet delivers nothing until something writes it. Stopping the tail removes the watcher and the poll, and nothing is delivered after it.

### The replay boundary is reported once

#### Context

**Problem**: a reconnecting browser needs to know when the replay of what was already logged is over, so it can buffer the replay and swap its feed atomically instead of blanking while history re-streams. A browser waiting for that boundary forever would freeze its feed.

#### Business logic

The boundary is reported once the first read has delivered everything already logged, and the following only starts after it, so no appended line can slip in ahead of the boundary. It is reported even when the file does not exist yet (an absent log is an empty replay, not a boundary withheld) and even when the first read fails (the poll retries the read). It is reported exactly once per tail: when nothing can be tailed at all (no file could be resolved) it is still reported and the tail stays silent, and a relocation of the file is not a new replay.

### The tail follows a relocated file

#### Context

**Problem**: an agent's events file does not sit still. When the agent ends, the daemon's teardown copies it verbatim into the archive [3] and removes the checkout [4]; a continuation restores it into a fresh checkout. A tail fixed on one path whose file was retired went silent without the final lines whenever the last directory-watch signal was lost, so the browser never learned the agent ended.

#### Business logic

The tail treats "the file existed and is now gone" as the relocation it is: it asks where the file lives now and, when the answer is a different path, retargets the same reader to it, keeping the number of bytes already consumed. Because the copy is content-identical, the consumed bytes are a prefix of the new file, so the next read delivers exactly the lines the move would have swallowed and repeats nothing; the first read after a retarget adopts the copy's newer modification time instead of mistaking it for a same-length rewrite, so a fully consumed file is not replayed. When the answer is the same path or no path at all, the tail keeps polling its current home and catches up once an answer appears, rather than hopping somewhere wrong. A file that is gone before anything was ever read from it is an agent still starting, not a move.
