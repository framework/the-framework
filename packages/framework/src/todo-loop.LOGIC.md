Works the agent queue [1] once a build agent's [2] opening work settles, as the backlog loop [3]: read the queue's first open queue entry [4] fresh off the `agent-data` branch [5], ask the user whether to start it when someone can answer, prompt the agent [6] to complete exactly that entry, take the entry off the queue, and repeat until the queue is empty, within a cap of 25 entries and stopping when a removal will not land. Beside the loop live the guess of which ticket the next drain [7] will work, which only labels a lane on the Overview [8], and the check whether an agent's own session backlog still has open work, which withholds its merge.

## Context

**User story**: the user starts a build with a very large scope, or a research preset that queues deep dives; the agent [6] adds follow-ups to the agent queue [1] as it goes, and once its opening work settles it works them one at a time. With the dashboard watching, a card "Start the next queue item?" precedes each entry, and the dashboard's autopilot [9] accepts it after a countdown, so a switched-on autopilot consumes the whole queue; unattended [10], nothing is asked and the agent ends when the queue is empty.

**Problem**: the queue lives on the `agent-data` branch [5], which the agent's checkout [11] does not hold, and every edit of that branch goes through the `queue` skill's [12] one writer; so The Framework, not the agent, reads the queue and takes entries off it, and the agent is only ever told the one entry to complete. Left unattended, the loop must stay bounded: a stop [13] ends any turn [14], the entry cap bounds the agent, and a removal that never lands must not re-serve the same entry.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[2] build agent: one of the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[3] backlog loop: After a build agent's opening work settles, the loop that works the agent queue one entry per turn until it is empty.
[4] queue entry: an item on the agent queue.
[5] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[6] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[7] drain: Starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[8] the Overview: The dashboard's cross-project page at `/`.
[9] autopilot: the dashboard's switch that accepts a gate's recommended option for the user after a countdown.
[10] unattended: Said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles. The opposite is attended.
[11] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[12] skill: One of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[13] stop: Ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[14] turn: One prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[15] hands-off: Said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[16] driver session: The coding agent's own conversation for one agent, which the driver can resume by its session id.
[17] event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[18] turn signals: What The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.
[19] ready for merge: The signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[20] gate: A question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[21] pick: The answer to a gate: the option or options chosen, by the user or automatically.
[22] await limit: The cap on consecutive gates within one exchange; an agent still asking past it finishes with its latest turn.
[23] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[24] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[25] routine: A preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[26] session name: The name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.

## Business logic — TL;DR

- **When the loop runs** - for a build agent that is not hands-off, after its opening exchange, with one turn-signal reader for the whole loop.
- **One entry per turn, fresh off the branch** - every round fetches the `agent-data` branch and reads the queue's first open entry; an empty queue ends the loop as done.
- **The gate before each entry** - when someone can answer, "Start the next queue item?" is asked with "Work on: …" recommended and "Stop the queue loop" as the other option; unattended, nothing is asked.
- **The prompt for one entry** - the agent is told to work on exactly that task and nothing else, and that The Framework takes it off the queue when the turn ends; the turn's gates and signals count like any other turn's.
- **A rejecting pick ends the whole agent** - a pick marked to stop inside an entry's turn ends the agent, not only the loop, so rejected work is never published.
- **The Framework takes the entry off the queue** - through the `queue` skill, tried twice; when the removal will not land, the loop stops with the queue intact rather than re-serving the entry.
- **Bounds** - at most 25 entries per agent, announced when entries are left; a stop ends the loop before the next entry without narration.
- **The next queued ticket** - the ticket the queue's first open entry links to, a best guess that only labels a lane on the Overview.
- **A hand-started drain** - a prompt that is exactly the "Drain queue" preset is a drain, and its ticket is the next queued ticket.
- **The agent's own backlog withholds the merge** - `TODO_<session name>.agent.md` in the checkout with an open entry means the agent is not done, whatever it signaled.

## Business logic

### When the loop runs

#### Context

**Business logic story**: the agent lifecycle in `agent.ts` starts the loop once the opening exchange has settled, for a build agent [2] that is not hands-off [15]: a prompt agent stops at its one prompt, and a hands-off agent's work is not on this machine. A build's live chat comes after the loop.

#### Business logic

The loop drives the agent's [6] existing driver session [16] in the agent's checkout [11] and writes what it does to the agent's event stream [17]. It reads each turn's [14] turn signals [18] with one reader kept for the whole loop, so ready for merge [19] fires once across every entry and an error restated on later entries is reported once (the reader's rules are `turn-gate.ts`'s). It runs with the agent's stop [13] signal, with a gate [20] answerer when a surface has one, and with the entry cap, 25 unless its caller sets another.

### One entry per turn, fresh off the branch

#### Context

See `## Context`.

#### Business logic

Each round begins by checking for a stop [13]; a stopped agent [6] ends the loop before another entry. The round then fetches the `agent-data` branch [5] and reads the queue's open entries in file order, since a long-lived agent's local view may trail what other writers pushed; by the `queue` skill's [12] rules an entry is a markdown list item, a task checkbox counting only while unchecked, so a queue written in priority sections drains in priority order. The first open entry is the one to work. An empty queue, or none written at all, ends the loop as done: when at least one entry was worked, "Queue done: empty after N item(s)." is written to the event stream [17]; a loop that finds nothing on its first round writes nothing at all. On the first round the count is announced: "Queue: N open item(s).". Wherever the loop names the entry, an entry longer than 100 characters is cut to 100 characters followed by an ellipsis.

### The gate before each entry

#### Context

**User story**: attended, the user decides before every entry whether the agent [6] goes on: the dashboard shows the card, the autopilot [9] accepts it after a countdown, and "Stop the queue loop" ends the loop and leaves the rest of the queue for later.

#### Business logic

Only when a surface can answer does the loop ask: a gate [20] titled "Start the next queue item? (N open)" with two options, "Work on: <the entry>", which is the recommended one, and "Stop the queue loop". Each round's gate is distinct from the one before, so a surface never confuses a new question with the answer it just gave. A pick [21] to stop writes "Queue loop stopped by you (N item(s) left)." to the event stream [17] and ends the loop with the reason "stopped"; the agent [6] itself is not ended, and the queue keeps its entries. Unattended [10], no gate is emitted and the entry is started.

### The prompt for one entry

#### Context

See `## Context`.

#### Business logic

"Queue item K: <the entry>" is written to the event stream [17], K counting the entries worked so far plus one, and the agent [6] is prompted with exactly "Work on exactly this task from the project's agent queue, and nothing else:", the entry, and "Complete it fully and verify your work. Do not start any other task; the framework takes this entry off the queue when the turn ends.". The turn [14] is a turn like any other: a gate [20] it stops at is answered and the agent resumed, up to the await limit [22] (the rounds are `await-gate.ts`'s), and its views, errors, ready-for-merge [19] signal and pull request are read. The entry counts as worked once the turn is over, whatever the turn produced.

### A rejecting pick ends the whole agent

#### Context

**Problem**: a plan the user declined inside an entry's turn [14] must not be followed by the handoff [23] publishing the very work that was rejected.

#### Business logic

When a gate [20] inside the entry's turn [14] is answered with a pick [21] marked to stop, the loop writes "Session stopped by your answer (N item(s) left)." to the event stream [17] and ends with the reason "stopped" together with the mark that the whole agent [6] is stopped; the agent lifecycle then ends the agent as stopped by the user's answer, and no handoff [23] runs. This is distinct from "Stop the queue loop" at the gate before an entry, which ends only the loop.

### The Framework takes the entry off the queue

#### Context

**Problem**: the agent's [6] checkout [11] does not hold the `agent-data` branch [5], and every edit of the queue must go through the one writer; and re-doing finished work is worse than stopping with the queue intact.

#### Business logic

After the turn [14], the entry is taken off the queue through the `queue` skill [12], which re-reads the fresh queue before writing and counts an entry already gone, removed by someone else meanwhile, as landed. The removal is tried up to two times in a row; when neither lands, "Queue loop stopped: "<the entry>" could not be taken off the queue after 2 attempt(s)." is written to the event stream [17] and the loop ends with the reason "stalled", the queue left as it was.

### Bounds

#### Context

**Problem**: an unattended [10] agent [6] must not work an unbounded queue on one subscription; and a stop [13] must end the loop without extra narration, since the agent is ending anyway.

#### Business logic

At most 25 entries are worked in one agent [6] unless the caller sets another cap. When the cap is reached, the queue is read again from the `agent-data` branch [5] as this machine last saw it, without fetching: when it is empty the loop ends as done, otherwise "Queue loop stopped at the 25-item cap; N item(s) left." is written to the event stream [17] and the loop ends with the reason "max-items". A stop [13] that arrives mid-loop ends it with the reason "stopped" and writes nothing. The result names how many entries were worked, whatever their outcome, and why the loop ended.

### The next queued ticket

#### Context

**User story**: the Overview [8] shows which ticket is being implemented; when a drain [7] starts, its lane must name the ticket the drain is about to pick up.

#### Business logic

The next queued ticket is the ticket the queue's first open entry links to, read from the `agent-data` branch [5] as this machine last saw it, without fetching: the same copy the sweep [24] consults when it decides whether there is anything to drain [7], so the entry named is the entry that decision was made on. "First" is the queue's first open entry, because the "Drain queue" preset works the first open entry only and the queue reads in file order. Which entry links to a ticket is the `tickets` skill's [12] rule: only a markdown link into `tickets/`. An empty queue, or a first open entry that is plain text, names no ticket, even when a later entry links to one. It is a best guess by construction: the agent [6] reads the queue a moment later, and an entry taken off in between moves it on. Being wrong costs a mislabeled lane on the Overview [8] and nothing else, since no agent is started or steered by it.

### A hand-started drain

#### Context

**Problem**: the daemon knows its own drain [7] by a mark on the routine [25], but a drain the user starts from the dashboard arrives as bare prompt text; unrecognized, the ticket it implements would sit in no lane on the Overview [8].

#### Business logic

A prompt is a drain [7] when, trimmed, it equals the rendered "Drain queue" preset exactly (the comparison is `preset-catalog.ts`'s), so a prompt that merely mentions the queue is not one. For a drain, the ticket the agent [6] is about to implement is the next queued ticket; for any other prompt, none. A failure to read the queue names no ticket and never fails the start: it is a lane label, not an agent.

### The agent's own backlog withholds the merge

#### Context

**Business logic story**: the ready-for-merge [19] signal is the agent's [6] own word that it is done and what authorizes the handoff's [23] merge. This check is a safety belt beside that word: it catches an agent declaring done while its own session backlog file still says otherwise, and nothing more.

#### Business logic

An agent's [6] own backlog is the file `TODO_<session name>.agent.md` at the root of its checkout [11], the file a research preset or a very large scope has the agent keep for its own work, where the session name [26] is the agent's. It still has open work when that file exists and holds at least one open entry by the `queue` skill's [12] entry rules; a file with every checkbox ticked has none. No session name, a name that cannot name a file (only letters, digits, dots, underscores and dashes can; a path separator above all cannot), and a missing or unreadable file all count as no open work: pendingness unknown is not pendingness. The agent queue [1] is never consulted here: it is decoupled from agents, and withholding on it would mean an armed merge never fires while the project has any backlog at all. The handoff [23] in `cli.ts` uses this to withhold an armed merge once the agent has signaled ready for merge [19]; the push and the pull request go ahead regardless.
