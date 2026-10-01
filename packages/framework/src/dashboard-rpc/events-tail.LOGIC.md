Tails an agent's [1] diary [2] for the live stream: everything already written is delivered first, then each new complete line as it is appended, with the end of the replay reported exactly once. For an agent whose diary moves — to another file, or out of its checkout once it is finished — the tail follows it, delivering every line once and repeating none.

## Context

**Business logic story**: the diary [2] is append-only, one line per event, written by the tool that runs the agent. The tail reads only the bytes appended since its last read and follows the file by watching its directory, with a poll every second as the backstop because directory watching is unreliable across platforms. The reading and following are `jsonl-tail.ts`'s; this adds the replay boundary and the relocation.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] diary: what an agent said and did, one line per event: `<id>.jsonl`, written by the tool that runs the agent under the `.the-framework/` of the agent's checkout while it works, and answered whole by the project's runs provider [4] once it has ended.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents (`../store/runs.ts`).
[5] live file: `<id>.live` beside the diary, holding the message the coding agent is writing, as far as it has got; it exists only while a message is being written and is never recorded.

## Business logic — TL;DR

- **Read what is there, then follow** - the lines already logged are delivered first, then each new line as it lands; a malformed line is skipped; a file rewritten from scratch is re-read from the top, as a fresh agent's log by the plain tail, and as the same agent's diary, with the lines already delivered passed over, by the tail of one agent's diary; a stopped tail delivers nothing more.
- **The replay boundary is reported once** - after the first read and before any followed line, and never a second time. The plain tail reports it even when the file does not exist yet or the first read fails; the tail of one agent's diary reports it only once lines could be delivered: after the first read that finds the file, or after the finished agent's lines.
- **The message being written is read beside the diary** - after each read of the diary the caller may read the files beside it on the same watch; the live file reader sends the text of the live file [5] each time it changed, and an empty text once the file is gone.
- **A diary rewritten in place sends only its new lines** - when an agent continued in the checkout it kept has its diary written again, whole, the tail of that agent's diary skips as many lines as it already delivered and delivers only the ones after them.
- **The tail follows a relocated diary** - whenever the file is not there, the tail asks where the diary is now: a new file, it moves there carrying its position; the finished agent's lines, it delivers the ones past what it already delivered and waits for the agent to be resumed, asking again once a second from shared, cached reads; a resumed agent's new file is followed from its first line the feed does not have yet; so the lines the move swallowed arrive exactly once and nothing already delivered is repeated; this holds even for an agent it never saw in its checkout.

## Business logic

### Read what is there, then follow

#### Context

See `## Context`.

#### Business logic

The tail first delivers every complete line already in the file, then follows appends: a change in the file's directory or the one-second poll triggers a read of the bytes added since the last one, and a line whose newline has not arrived yet waits for it. A line that is not valid JSON is skipped and never breaks the stream. A file that shrank below what was already read, or was rewritten to the same length with a newer modification time, is treated as a fresh agent's log and re-read from the top (the detection is `jsonl-tail.ts`'s); the tail of one agent's diary reads it differently, see "A diary rewritten in place sends only its new lines". A file that does not exist yet delivers nothing until something writes it. Stopping the tail removes the watcher and the poll, and nothing is delivered after it.

### The replay boundary is reported once

#### Context

**Problem**: a reconnecting browser needs to know when the replay of what was already logged is over, so it can buffer the replay and swap its feed atomically instead of blanking while history re-streams. A browser waiting for that boundary forever would freeze its feed.

#### Business logic

The boundary is reported once the first read has delivered everything already logged, and the following only starts after it, so no appended line can slip in ahead of the boundary. The plain tail of a log file reports it even when the file does not exist yet (an absent log is an empty replay, not a boundary withheld) and even when the first read fails (the poll retries the read).

The tail of one agent's diary [2] withholds it until lines could be delivered. A reconnecting browser replaces what it shows with the replay at the boundary, and an agent being continued has, for a second or more, no diary to read: its record says it is running while its checkout [3] is on its way back, or its checkout exists a moment before the diary is written into it. A boundary reported then said "the replay is empty", and the browser emptied a full transcript until the lines came. So:

- a diary that is nowhere yet is asked for again once a second, and the boundary is reported once its home's lines are delivered: after the first read of its file, or after the finished agent's lines;
- a diary whose file does not exist when it is first read has its boundary reported after the first read that finds the file, or, when the file never comes and the agent turns up finished, after the finished agent's lines;
- a file that is there, and an agent already finished, report it after their lines, as before.

Either tail reports it exactly once: when nothing can be tailed at all (no file could be resolved) it is still reported and the tail stays silent, and a relocation of the file is not a new replay.

### A diary rewritten in place sends only its new lines

#### Context

**User story**: the user keeps an agent's page open while the agent is continued: they answer its question, send it a message, or, for an agent that split its task across other agents, one of those ends and the tool that runs agents continues it with the line saying so. The page shows the new turn under what was already there.

**Problem**: an agent continued in the checkout [3] it kept has its diary [2] file written again, whole, in place, before the new lines are appended. The reader takes a file that shrank, or that was rewritten to the same length, for a new log and reads it again from the top, so the tail delivered every line it had already delivered: the open page showed the first part of the conversation twice until a reload. An agent whose task is split is continued once per agent it started, so it showed this on every turn.

#### Business logic

This applies to the tail of one agent's diary, the one that also follows a relocated diary (next section). That tail counts the lines it has delivered. Each time the reader finds the file rewritten (`jsonl-tail.ts` tells it, before reading the file again from the top), the tail passes over as many lines from the top as it has delivered and delivers only the lines after them: the file is the same agent's diary, so it starts with the lines already sent. This holds whether the file was rewritten to the same content, rewritten and grown in one step, or rewritten shorter than what had been read. The plain tail of a log file is unchanged: there a rewritten file is a fresh agent's log and is delivered from its first line.

### The tail follows a relocated diary

#### Context

**Problem**: an agent's diary [2] does not sit still. While the agent works it is a file in the agent's checkout [3]; when the agent ends, the tool that runs it records it and reclaims the checkout, and the diary is then the finished agent's, answered by the runs provider [4]; a resumed agent writes on in a checkout again. A tail fixed on one path whose file was retired went silent without the final lines whenever the last directory-watch signal was lost, so the browser never learned the agent ended. And a short agent, started, ended and reclaimed between two polls, was only ever visible at its second home.

#### Business logic

Whenever the file the tail follows is not there, the tail asks where the diary is now. When the answer is the finished agent's lines, which are the lines the file had, in the same order, the tail delivers the ones past the count it already delivered and stops following the file. A finished agent may be resumed, so for as long as the tail is open it asks again once a second, from the shared, cached reads only, since the question may stay open for hours. A resumed agent writes on in a checkout again, its diary starting with every line it had: when the answer becomes that file, it is followed from its start with as many lines skipped as were already delivered, so the feed gets the resumed agent's lines live, each once. When the answer is finished lines again, longer than those delivered (the agent was resumed and ended between two asks), the extra lines are delivered. An agent already finished when the tail starts gets every line, then the replay boundary. When the answer is a different file, the tail retargets the same reader to it, keeping the number of bytes already consumed: for a content-identical copy the consumed bytes are a prefix of the new file, so the next read delivers exactly the lines the move would have swallowed and repeats nothing; the first read after a retarget adopts the copy's newer modification time instead of mistaking it for a same-length rewrite, so a fully consumed file is not replayed. A tail that never saw the file in the checkout has delivered nothing, and gets the finished lines from the first. When the answer is the same file or nothing at all, the tail keeps polling its current home and catches up once the file or a new answer appears, rather than hopping somewhere wrong. When the diary is nowhere yet from the first ask — an agent started a moment ago, whose checkout is not made — the question is asked again once a second until the diary has a home: a file, followed from its first line, or the finished agent's lines; the replay boundary is reported only then, after those lines (see "The replay boundary is reported once"). Only one such question is in flight at a time.
