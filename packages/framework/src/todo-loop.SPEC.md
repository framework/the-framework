The backlog loop and the agent queue's read/write rules: once an agent's main work settles, it consumes the agent queue (`TODO_AGENTS.md` on the data branch) one entry per turn until the queue is empty — the framework drives (read the next entry, gate, prompt, check it off, repeat) while the queue itself is only ever edited through the data branch's write cycle.

## User story

- An agent facing a very large scope, the maintenance follow-ups, or the [Research] preset's deep-dive picks appends entries to the queue; a later agent drains them.
- With autopilot on, the whole queue is consumed unattended; with autopilot off, the user is asked before each entry.
- A paused agent leaves word to pick itself up again, as an ordinary queue entry.
- The user queues a ticket from the dashboard and expects it to be worked in its priority's turn, not last.
- The Overview labels which ticket the next drain will pick up.

## Glossary

- **open entry** — a markdown list item that still counts as work: a bullet or numbered item, or an unchecked task checkbox; a checked-off item is done.

## Business logic — TL;DR

- **What counts as open** - open entries are read in file order; headings, prose, and blank lines are not entries, so a priority-sectioned queue needs no special handling: a priority-sorted file drains in priority order.
- **Every queue edit rides the data branch** - appending an entry (plain, or placed into its `## Priority N` section), and checking one off, each run as one committed-and-pushed change; the queue is readable from the project checkout and any agent worktree alike, and an edit that could not land reports so instead of throwing.
- **The loop works one entry per turn** - gate ("start the next item?") when someone can answer, prompt the agent to complete exactly that entry, then the framework — not the agent — checks it off; a backlog turn honors gates and all turn signals like any other turn.
- **Safe to leave unattended** - a hard per-agent item cap, the agent's abort signal, and a stop-after-two-failed-check-offs rule bound the loop; a stop-marked answer inside an item's turn (a declined plan) ends the whole session, not just the loop.
- **A session's own TODO file can withhold its merge** - an agent that declares ready for merge while its session-scoped TODO file still has open entries is not merged; the global queue never withholds a merge.
- **The next drain's ticket is named, best-effort** - the first open entry's linked ticket labels the dashboard lane for the sweep's drain and a hand-fired drain alike; being wrong costs a label, never a run.

## Business logic

### Reading the queue

#### User story

Queue authors write ordinary markdown — priority sections, prose, checkboxes — and every reader must agree on what is still open.

#### Business logic

An open entry is a list item (`-`, `*`, or numbered) whose text is non-empty; a task checkbox counts only while unchecked. Headings, prose, and blank lines are skipped, and entries come back in file order — which is why the backlog format's `## Priority N` sections need no parser support: the file is priority-sorted, so file order *is* priority order. The queue is read off the data branch (never off any checkout copy, including the retired session-scoped backlog files and the retired root locations); a long-lived agent about to act on the queue re-fetches the branch first, since its local ref may trail what other writers pushed meanwhile. A queue with no open entry is no backlog.

### Writing the queue

#### User story

A paused agent leaves a resume note; the user queues a ticket from the dashboard with a priority; the loop checks a worked entry off.

#### Business logic

Every edit resolves the project root (an agent calls from its worktree; the data checkout lives beside the main repo), applies a pure text edit to `TODO_AGENTS.md` on the data branch — creating the file when the branch has none — and lets the write cycle commit and push it. None of these writes ever throws: appending a resume note runs while an agent is already unwinding and must not mask the reason it stopped; an edit that did not land reports so.

A plain append lands at the end of the file. A priority-placed entry lands in its `## Priority N` section instead: joining the end of an existing section (arrival order within a priority), otherwise creating the section before the first lower-priority section (the format sorts high to low), after every higher-priority section when all outrank it, above the file's first heading when the file has no priority sections at all (its own sections are unranked, and burying a deliberate pick under them is the bug), and as a plain tail on a file with no headings. Checking an entry off checks its box (giving a bare bullet a checked one); an entry already checked, or no longer present, changes nothing.

#### Rationale

The drain preset works "the FIRST open entry", so where an entry lands *is* its priority: the old plain append put a just-queued ticket at the end of the file, meaning "work on this" queued it last, behind everything already there.

### Driving the loop

#### User story

See `## User story`: unattended consumption under autopilot, a per-item gate when a human is watching.

#### Business logic

Each iteration re-reads the queue fresh off the data branch; an empty (or never-written) queue ends the loop as the success case, announced when any work was done. When an interactive gate handler is wired, the loop pauses before each entry with a two-option choice — work on the next entry (the recommended pick, which autopilot auto-accepts) or stop the loop; picking stop ends the loop benignly with the queue intact. Headless agents emit no gate and just proceed. The agent is then prompted to complete exactly that one entry and told the framework checks it off when the turn ends — the queue file is not the agent's to touch, since it lives on a branch the agent's checkout does not hold. The turn honors await gates and emits the turn signals like any other; one signal emitter spans the whole loop, so ready for merge fires once across all items and a session name only re-emits on an actual rename.

After the turn, the framework checks the entry off on the data branch, retrying once inline: two consecutive check-offs failing to land stop the loop ("stalled") rather than re-serving — and re-doing — the same entry. The other bounds: the agent's abort signal (Stop button, budget cap) ends the loop before the next entry, and a hard per-agent item cap (default 25) stops it with a count of what is left. An answer marked stop inside an item's own turn — a plan the user declined — ends the whole session, not just the loop, so the session cannot go on to publish work that was just rejected; the caller aborts on that flag.

### The session's own TODO withholds its merge

#### User story

An agent declares ready for merge while the TODO file it kept for its own session still lists open work; merging then would land a half-done session.

#### Business logic

Pendingness is read only from the session-scoped `TODO_<session name>.agent.md` in the agent's workspace — never from the global queue, which is decoupled from sessions: counting it would mean auto-merge never fires while the project has any backlog at all. A missing or unreadable file, no session name, or a name that could not name a file all read as nothing pending. This is an explicitly temporary safety belt over the agent's own ready-for-merge word, built to be deleted once that word is deemed enough.

### Naming the drain's ticket

#### User story

The Overview shows which ticket is being worked; a drain fired by hand from the dashboard must label its lane the same way the sweep's drain does.

#### Business logic

The next drain's ticket is the ticket linked from the queue's first open entry — the entry the drain preset says to work — read from the same copy the sweep consults; a first entry that is plain text names no ticket. A hand-fired prompt earns a ticket label only when it is the drain preset (whitespace-insensitively); any other prompt gets none, since labeling the queue's next entry onto an unrelated agent would put a ticket in the in-progress lane on the strength of nothing. The label is a best guess by construction — an entry checked off in between moves the drain on — and being wrong costs a mislabelled lane on the Overview and nothing else: no run is started or steered by it, and a failing read yields no label rather than taking the start down.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
