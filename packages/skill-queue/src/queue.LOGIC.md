Reads and edits the agent queue [1], `TODO_AGENTS.md` on the `agent-data` branch [2]: which lines of the file are open queue entries [3] and in what order they are worked, where an entry lands when it is added with a priority or without one, how an entry is removed once done, and how every edit lands on the branch as one commit through the caller's write cycle. The same rules serve the `queue` command an agent [4] runs and the daemon that drains the queue.

## Context

**User story**: the user, or an agent, puts a task on the agent queue and sees it in the dashboard's queue under the priority it was given; the daemon starts the next agent on the first open entry; when the task is done its entry disappears and the queue is only the remaining work. The file stays a readable markdown document the user can also edit by hand.

**Business logic story**: the write cycle, the branch and the file's name are the rules of `store.ts`, `names.ts` and the `agent-data` package; this file holds the queue's own rules. The queue does not know tickets: a caller that queues a ticket writes the entry itself as a markdown link to the ticket, and reads the link back to claim the ticket for the agent it starts.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[3] queue entry: an item on the agent queue.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.

## Business logic — TL;DR

- **Which lines are entries** - any `-`, `*` or `N.` list item with text is an open entry, wherever it sits; a task box counts only while unchecked, and its text is the entry without the box; headings, prose and blank lines are not entries.
- **The order of work is the file's order** - entries are taken top-down as they stand in the file, so a file sorted `## Priority 10` down to `## Priority 0` drains in priority order, first within a section first; nothing re-sorts on read.
- **Placing an entry by priority** - the entry joins the end of its `## Priority N` section; without one, a new section is created before the first lower-priority section, or last when every section outranks it, or above the file's first heading when the file has no priority section at all, or at the file's end when it has no headings.
- **An entry with no priority goes at the end** - as a plain bullet at the end of the file, in whatever section ends it.
- **Done means deleted** - the first open line whose text is exactly the entry is deleted whole; a checked line is never matched; an entry the queue does not have changes nothing.
- **Reading the queue** - from anywhere in the repository, the file as it stands on the branch, or nothing when the branch has no queue; a long-lived process about to act fetches first.
- **An edit lands as one commit** - the repository root is resolved, the file read (a missing queue reads as empty), the edit applied, the file written only when it changed, then committed and pushed as "queue add: <entry>" or "queue done: <entry>"; an edit never throws, and reports whether it landed and whether it changed anything.

## Business logic

### Which lines are entries

#### Context

**Problem**: the queue is a markdown document people and agents write by hand, so the reader must accept every common way of writing a list item and never mistake prose or a heading for work.

#### Business logic

A line is a list item when, after any leading whitespace, it starts with `-`, `*` or a number followed by a period, then whitespace, then text; its text with surrounding whitespace removed is the entry, and an item with no text is skipped. When the text starts with a task box, `[ ]`, `[x]` or `[X]`, the box decides: a checked box (`[x]` or `[X]`) is not an open entry, and an unchecked box is one whose entry is the text after the box, trimmed, provided anything remains. Every other line, a heading, prose, a blank line, is not an entry. An entry is plain trimmed text: the task a future agent [4] is started with, or a markdown link back to the ticket it came from.

### The order of work is the file's order

#### Context

**User story**: the dashboard and the drain [5] both take the queue's first open entry as the next task; the user orders work by moving lines and sections in the file.

#### Business logic

The open entries are read in file order, so the priority sections need no support from the reader: a file whose sections run from `## Priority 10` down to `## Priority 0` drains in priority order, and within a section the first entries are the next tasks. Nothing re-sorts on read; the writing rules below keep the file sorted high to low.

### Placing an entry by priority

#### Context

**Problem**: an entry added with a priority must land where the file's order will take it at that priority, whether or not the file already has a section for it, and without burying a deliberate pick under sections nobody ranked.

#### Business logic

A priority section is a second-level heading reading `## Priority N`, in any case, N a number of one or two digits, with anything after the number allowed (the format's own gloss, `## Priority 10 (critical — act immediately)`). A section runs to the next second-level heading of any kind, or to the end of the file, its trailing blank lines excluded. Placement is tried in this order: a section for the entry's priority exists, and the entry is appended at that section's end as `- <entry>`, so a section keeps its arrival order and never gains a second heading; otherwise a section with a lower priority exists, and a new section (`## Priority N`, a blank line, `- <entry>`, a blank line) is inserted before the first such section, since the file sorts high to low; otherwise every priority section outranks the entry, and the new section is added after the last one, as the file's last section; otherwise the file has no priority section but has second-level headings, and the new section goes above the first of them, because the file's own sections are then unranked and burying a deliberate pick under them would be the bug, while anything above that heading (a title, an introduction) stays on top; otherwise the file has no headings at all, and the section is appended at the end.

### An entry with no priority goes at the end

#### Context

See `## Context`.

#### Business logic

An entry added without a priority is appended as `- <entry>` on its own line at the end of the file, a line break added first when the file does not end with one, so it lands in whatever section ends the file, last in the order of work. On a branch with no queue, this creates the file with that one line.

### Done means deleted

#### Context

**User story**: the queue is the remaining work; the history of what ran is kept elsewhere, in the runs, so a finished task leaves the file rather than being checked off.

#### Business logic

Removing an entry deletes the first list item line, with or without an unchecked task box, whose trimmed text is exactly the entry, the whole line included; every other line stays. A checked line is not an open entry and is never matched. An entry the queue does not have changes nothing.

### Reading the queue

#### Context

**Problem**: a long-lived process's local view of the branch may trail what other writers pushed.

#### Business logic

The queue is read from anywhere in the repository, an agent's checkout included, as the file stands on the `agent-data` branch [2]; a branch with no queue reads as no queue, and its entries as none. A caller about to act on the queue, the daemon's drain [5], asks for a fresh read, which fetches origin first; a plain read does not fetch.

### An edit lands as one commit

#### Context

**Problem**: the daemon may queue a note while it is already unwinding after a failure, and an error while queueing must not mask why it stopped.

#### Business logic

Adding and removing are each one edit of the file: the repository root is resolved from wherever the caller is, an agent's checkout included; the file is read from the branch's checkout, a missing queue reading as empty; the edit is applied; the file is written only when the edit changed it; and the write cycle of `store.ts` commits and pushes it, an addition as "queue add: <entry>" and a removal as "queue done: <entry>". An edit never throws: it answers that it landed, and whether it changed anything, or that it did not land, which is also the answer when no repository root can be resolved or the cycle did not push. Removing an entry that is already gone lands, changing nothing. Adding creates the queue file when the branch has none.
