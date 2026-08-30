The agent queue, `TODO_AGENTS.md`: every task agents will work on next, as markdown list items banded by `## Priority N` sections from 10 down to 0, first within a band first to be taken. An entry is either text, or a link back to the ticket it came from.

## User story

- The user reads one file and sees everything agents will work on next, in the order they will take it.
- The user, or a caller, puts a task on the queue and it lands at the priority it belongs to.
- A task is done, and disappears from the queue.

## Business logic — TL;DR

- **The open entries, in order of work** - list items in file order; a checked task item is not open, and headings and prose are not entries.
- **The priority sections need no parser support** - a priority-sorted file drains in priority order by itself.
- **An entry lands in its own section** - added into the section for its priority, creating that section in the right place when the file has none.
- **Done means deleted** - taking an entry off removes its line; nothing is checked off.
- **Read from anywhere, written through the caller's cycle** - the queue is read off the branch from any clone, and every edit is one commit on it.

## Business logic

### The open entries, in order of work

#### User story

See `## User story`.

#### Business logic

The queue's open entries are its markdown list items — `-`, `*` or `1.` — in file order, with the marker stripped. A task item counts only while it is unchecked; a checked one is not open. Headings, prose and blank lines are not entries, and neither is an empty item.

### The priority sections need no parser support

#### Business logic

Because headings are not entries, reading the file top to bottom already yields the entries in priority order: the sections do the sorting, and the reader needs to know nothing about them.

### An entry lands in its own section

#### User story

See `## User story`.

#### Business logic

An entry added with a priority goes into that priority's `## Priority N` section. Placement, in the order tried: the section exists — the entry joins its end, so a section keeps its arrival order; otherwise the section is created just before the first *lower*-priority section, since the file sorts high to low; every existing section outranks it — the new section goes last; the file has no priority sections at all — the new section goes above the file's first heading, because the file's own sections are then unranked and burying a deliberate pick under them is the bug; the file has no headings at all — a plain tail. A `## Priority N` heading is still matched when it carries the format's own gloss after the number.

An entry added without a priority is simply appended at the end of the file.

### Done means deleted

#### Business logic

Taking an entry off the queue deletes the first open line whose text is exactly that entry. An entry nobody has any more changes nothing. Nothing is ever checked off: the file is the remaining work, and the history of what ran is kept elsewhere.

### Read from anywhere, written through the caller's cycle

#### User story

- A caller about to hand work to an agent reads the queue and must see what other machines pushed, not a local copy that trails them.

#### Business logic

The queue is read off the branch from anywhere in the repository, including from an agent's own checkout, which holds none of the files. A read can be asked to fetch first, for a long-lived process about to act on the queue whose local view may trail what other writers pushed.

An edit is applied from anywhere in the repository too: the repository the working directory belongs to is resolved, the change is applied to a checkout of the branch by the caller's write cycle (`store`), and committed and pushed as one commit that names what it did. An edit never throws — a queue entry is written while a process may already be unwinding, and must not mask why it stopped — and reports whether it landed and whether it changed anything; an entry already gone is a landed no-op.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
