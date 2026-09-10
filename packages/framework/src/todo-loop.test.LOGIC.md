What the tests cover, against a real repository whose queue lives on the `agent-data` branch:

- **Working the queue to empty** - two entries are worked one turn each, each prompt naming its entry and saying that The Framework takes it off the queue; the queue on the branch ends empty; the opening count, each entry and the completion line are written to the event stream; unattended, no gate is emitted.
- **No queue** - without a queue the loop ends as done with nothing worked and writes nothing.
- **The gate before each entry** - attended, a gate precedes each entry with "Work on: <the entry>" as the recommended option, each round's gate distinct from the last; picking to stop after one entry ends the loop as stopped, says so, and leaves the second entry on the branch.
- **A removal that cannot land** - when the branch's write funnel is broken, the entry is worked once, the loop ends as stalled saying the entry could not be taken off the queue, and the queue is left untouched.
- **The entry cap** - a cap of two over three entries works two, ends as capped, says one entry is left, and leaves the third on the branch.
- **Gates inside an entry's turn** - an entry turn that stops to ask is answered and resumed with the pick like any gate, the entry's own gate coming first and the agent's question second.
- **A stop before the first entry** - an already stopped agent works nothing and ends as stopped.
- **Signals on backlog turns** - a backlog turn's view, its reported error with headline and detail, and its ready-for-merge signal reach the event stream; ready for merge is emitted once across several entries that each signal it.
- **The next queued ticket** - an empty queue names none; the first open entry's ticket link is named, skipping a checked entry above it and an entry in a lower priority section; a first open entry of plain text names none even when the next entry links to a ticket.
- **A hand-started drain** - the rendered "Drain queue" preset names the next queued ticket, with or without surrounding whitespace; any other prompt, another preset, and an empty prompt name none; a queue read that fails names none rather than failing the start.
- **One drain** - the daemon's drain routine is marked as a drain and its prompt is recognized as one; no other Auto PM routine's prompt counts as a drain.
- **The agent's own backlog** - a missing file means nothing pending; the session's file with an open entry withholds and a fully checked one releases; no session name, or one that cannot name a file, means nothing pending.
