Tails an agent's [1] diary [2] for the live stream: everything already written is delivered first, then each new complete line as it is appended, with the end of the replay reported exactly once. For an agent whose file moves, the tail follows it to its new home, delivering every line once and repeating none.

## Context

**Business logic story**: the diary [2] is append-only, one line per event, written by the tool that runs the agent. The tail reads only the bytes appended since its last read and follows the file by watching its directory, with a poll every second as the backstop because directory watching is unreliable across platforms. The reading and following are `jsonl-tail.ts`'s; this adds the replay boundary and the relocation.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] diary: what an agent said and did, one line per event: `<id>.jsonl`, written by the tool that runs the agent under the `.the-framework/` of the agent's checkout while it works, and recorded on the `agent-data` branch by the `logs` skill once it has ended.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Read what is there, then follow** - the lines already logged are delivered first, then each new line as it lands; a malformed line is skipped; a file rewritten from scratch is re-read from the top; a stopped tail delivers nothing more.
- **The replay boundary is reported once** - after the first read and before any followed line, even when the file does not exist yet or the first read fails, and never a second time.
- **The tail follows a relocated file** - whenever the file is not there, the tail asks where the diary lives now; on a new answer it moves there carrying its position, so the lines the move swallowed arrive exactly once and nothing already delivered is repeated; this holds even for a file it never saw at its first home.

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

**Problem**: an agent's diary [2] does not sit still. While the agent works it is in the agent's checkout [3]; when the agent ends, the tool that runs it records it on the `agent-data` branch and reclaims the checkout; a resumed agent writes on in a checkout again. A tail fixed on one path whose file was retired went silent without the final lines whenever the last directory-watch signal was lost, so the browser never learned the agent ended. And a short agent, started, ended and reclaimed between two polls, was only ever visible at its second home.

#### Business logic

Whenever the file the tail follows is not there, the tail asks where the diary lives now. When the answer is a different path, it retargets the same reader to it, keeping the number of bytes already consumed. Because the recorded copy is content-identical, the consumed bytes are a prefix of the new file, so the next read delivers exactly the lines the move would have swallowed and repeats nothing; the first read after a retarget adopts the copy's newer modification time instead of mistaking it for a same-length rewrite, so a fully consumed file is not replayed. A tail that never saw the file at its first home has consumed nothing, and reads the new home from the top. When the answer is the same path or no path at all — an agent whose checkout is not made yet — the tail keeps polling its current home and catches up once the file or a new answer appears, rather than hopping somewhere wrong. Only one such question is in flight at a time.
