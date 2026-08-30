The backlog loop: once an agent's main work settles, it consumes the agent queue one entry per turn until the queue is empty — the framework drives (read the next entry, gate, prompt, take the entry off the queue, repeat). The queue itself is the `tickets` skill's: it lives on the project's `tickets` branch, and the framework reads and changes it only through that skill, holding no copy of it and editing no file of its own.

## User story

- An agent facing a very large scope, the maintenance follow-ups, or the [Research] preset's deep-dive picks puts entries on the queue; a later agent drains them.
- With autopilot on, the whole queue is consumed unattended; with autopilot off, the user is asked before each entry.
- The Overview labels which ticket the next drain will pick up.

## Glossary

- **open entry** — an entry the queue still lists as work. What counts as one, and in what order entries come back, is the `tickets` skill's rule.

## Business logic — TL;DR

- **The loop works one entry per turn** - gate ("start the next item?") when someone can answer, prompt the agent to complete exactly that entry, then the framework — not the agent — takes the entry off the queue; a queue turn honors gates and all turn signals like any other turn.
- **The queue is not the agent's to touch** - it lives on a branch the agent's checkout does not hold, and the removal is the framework's own write, so the queue keeps one local writer.
- **Safe to leave unattended** - a hard per-agent item cap, the agent's abort signal, and a stop-after-two-failed-removals rule bound the loop; a stop-marked answer inside an item's turn (a declined plan) ends the whole session, not just the loop.
- **A session's own TODO file can withhold its merge** - an agent that declares ready for merge while its session-scoped TODO file still has open entries is not merged; the global queue never withholds a merge.
- **The next drain's ticket is named, best-effort** - the first open entry's linked ticket labels the dashboard lane for the sweep's drain and a hand-fired drain alike; being wrong costs a label, never a run.

## Business logic

### Driving the loop

#### User story

See `## User story`: unattended consumption under autopilot, a per-item gate when a human is watching.

#### Business logic

Each iteration re-reads the queue fresh off the `tickets` branch; an empty (or never-written) queue ends the loop as the success case, announced when any work was done. When an interactive gate handler is wired, the loop pauses before each entry with a two-option choice — work on the next entry (the recommended pick, which autopilot auto-accepts) or stop the loop; picking stop ends the loop benignly with the queue intact. Headless agents emit no gate and just proceed. The agent is then prompted to complete exactly that one entry and told the framework takes it off the queue when the turn ends — the queue is not the agent's to touch, since it lives on a branch the agent's checkout does not hold. The turn honors await gates and emits the turn signals like any other; one signal emitter spans the whole loop, so ready for merge fires once across all items and a session name only re-emits on an actual rename.

After the turn, the framework takes the entry off the queue — an entry that is done is deleted, not marked — retrying once inline: two consecutive removals failing to land stop the loop ("stalled") rather than re-serving — and re-doing — the same entry. A removal is harmless when someone else already took the entry off meanwhile, because it is applied to the queue as it stands then. The other bounds: the agent's abort signal (Stop button, budget cap) ends the loop before the next entry, and a hard per-agent item cap (default 25) stops it with a count of what is left. An answer marked stop inside an item's own turn — a plan the user declined — ends the whole session, not just the loop, so the session cannot go on to publish work that was just rejected; the caller aborts on that flag.

### The session's own TODO withholds its merge

#### User story

An agent declares ready for merge while the TODO file it kept for its own session still lists open work; merging then would land a half-done session.

#### Business logic

Pendingness is read only from the session-scoped `TODO_<session name>.agent.md` in the agent's workspace — never from the global queue, which is decoupled from sessions: counting it would mean auto-merge never fires while the project has any backlog at all. The file is read with the same rule for what is still open as the queue itself, so the two agree on what an open entry is. A missing or unreadable file, no session name, or a name that could not name a file all read as nothing pending. This is an explicitly temporary safety belt over the agent's own ready-for-merge word, built to be deleted once that word is deemed enough.

### Naming the drain's ticket

#### User story

The Overview shows which ticket is being worked; a drain fired by hand from the dashboard must label its lane the same way the sweep's drain does.

#### Business logic

The next drain's ticket is the ticket linked from the queue's first open entry — the entry the drain preset says to work — read the same way the sweep reads it; a first entry that is plain text names no ticket. A hand-fired prompt earns a ticket label only when it is the drain preset (whitespace-insensitively); any other prompt gets none, since labeling the queue's next entry onto an unrelated agent would put a ticket in the in-progress lane on the strength of nothing. The label is a best guess by construction — an entry taken off the queue in between moves the drain on — and being wrong costs a mislabelled lane on the Overview and nothing else: no run is started or steered by it, and a failing read yields no label rather than taking the start down.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
