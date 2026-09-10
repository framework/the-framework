Runs the exchange in which an agent [1] stops to ask: a turn [2] whose final message ends on a gate [3] is shown to the user as a question with options, the pick [4] is worded back to the agent as the next prompt, and this repeats until the agent stops asking, a pick says to stop, or the await limit [5] trips. After the work settles, the same loop carries the user's live chat [6], each message a turn on the same driver session [7]. When nobody can answer, the gate takes its recommended option so the agent never hangs.

## Context

**User story**: an agent working the user's task reaches a decision it will not take alone and asks, with options; the dashboard shows the question as a card with the recommended option pre-selected. The user picks, and the agent continues with that decision. The user may pick an option the agent marked as a stop, which ends the agent at that turn. When the user is not there, the recommended option is taken and the agent goes on. Once the agent's work has settled, the user writes to it from the composer and each message continues the same conversation.

**Business logic story**: one loop serves every path that runs gates: the opening exchange of a build agent [8] and of a prompt agent [8], each live-chat message, and the backlog loop [9]. The paths differ only in how a turn is continued. The syntax of a gate in a final message and the wording of the continuation are fixed in `turn-gate.ts`; the queue of live-chat messages in `agent-messages.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[5] await limit: the cap on consecutive gates within one exchange; an agent still asking past it finishes with its latest turn.
[6] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[7] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[8] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[9] backlog loop: after a build agent's opening work settles, the loop that works the agent queue one entry per turn until it is empty.
[10] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[11] turn signals: what The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.
[12] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[13] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.

## Business logic — TL;DR

- **A turn that stops to ask becomes a gate** - the final message's question and options are put on the event stream as a card for the dashboard, under an id that tells a re-ask from the answer just given.
- **The pick re-prompts the agent** - the picked option's label is worded back to the agent as its next prompt, and the new turn is read for a gate in turn.
- **The await limit** - at most 5 consecutive gates in one exchange; an agent still asking after the fifth answer finishes with its latest turn and is reported as having run out.
- **Multi-select** - a checklist gate answers with every checked label, or "(none)", and takes its pre-checked set when nobody answers.
- **An option marked to stop** - picking it ends the exchange at the turn that asked, telling the agent nothing; one stopping pick among several is still a stop.
- **The recommended option, and who takes it when nobody answers** - the option the agent named, else the first, is what a headless agent, an aborted wait, a failed ask, or an unknown answer resolves to.
- **The opening exchange** - the prompt that opens the exchange, optionally resuming a finished agent's conversation, then its gates, then live chat unless a pick stopped it.
- **The live-chat phase** - each message resumes the same driver session and honors its gates; by default the agent ends once no message is queued, or it stays parked for the next message for an agent whose terminal is its only surface.

## Business logic

### A turn that stops to ask becomes a gate

#### Context

See `## Context`.

#### Business logic

- The final message of every turn [2] is read for a gate [3]. A gate has a question, at least one option (each with an id, a label, an optional one-line detail, and possibly marked as a stop or as checked by default), an optional recommended option, an optional checklist form (multi-select), and optionally the markdown file the question is about, which the dashboard's right rail renders (a plan under approval).
- The gate is put on the agent's event stream [10] as a question with its options, so the dashboard shows it as a card; the resolution follows on the same stream, naming the option or options picked and who picked them.
- The first gate of an exchange keeps one stable id; every later gate in the same exchange gets a unique id numbered by its position in the exchange, so a dashboard never confuses a re-ask with the answer it just resolved.

### The pick re-prompts the agent

#### Context

See `## Context`.

#### Business logic

- A pick [4] is mapped back from option ids to labels: a single-select answers with the one label picked (or the raw id, should the id name no option), a multi-select with the checked labels joined by ", " or with "(none)" when nothing is checked.
- The agent's log gets "Continuing with your choice: <answer>", and the agent [1] is prompted with the continuation "You paused to ask: "<question>". The user chose: <answer>. Continue with that decision." on the same driver session [7].
- The new turn's turn signals [11] are emitted like any other turn's, and its final message is read for a gate again; the loop repeats while the agent keeps asking.

### The await limit

#### Context

**Problem**: an agent that asks at every turn would keep a human, or the automatic fallback, in a loop forever; the limit is a property of the gate protocol itself, so every path that runs gates shares the one number.

#### Business logic

An exchange answers at most 5 consecutive gates [3]. When the turn after the fifth answer still ends on a gate, that gate is not answered and the exchange ends with that turn's text, reported as exhausted: the agent [1] was still asking when the cap ran out. A stop is never reported as exhausted, so a deliberate stop never reads as an agent that ran out.

### Multi-select

#### Context

**User story**: the agent hands the user a checklist, such as the "Research" preset's list of problems to deep-dive into, some already checked, and the user keeps or changes the checks.

#### Business logic

- A multi-select gate [3] shows each option as a checkbox, pre-checked when the agent marked it as a default.
- The pick [4] is the subset of option ids the user left checked; ids that name no option are dropped. The answer worded to the agent is the checked labels joined by ", ", or "(none)".
- When nobody can answer, the default set is taken, and the resolution records that it was taken automatically.

### An option marked to stop

#### Context

**User story**: the agent offers "stop here" among its options, or the user's answer is to take over; picking such an option ends the agent at that turn instead of continuing it, and the dashboard's composer is not left waiting for a next message that stopping does not mean.

#### Business logic

- A pick [4] of an option the agent marked as a stop is the one answer the agent [1] is never given: the exchange ends with the turn that asked, the log reads "Stopped at your answer: <answer>. Awaiting your instructions.", and the outcome is reported as stopped, not exhausted.
- On a multi-select, one stopping option among several checked is still a stop: an answer that says "stop" is not softened by the answers next to it.
- Whether a pick stops is read off the option picked, not off the gate.
- A stop on the opening exchange ends the agent there without opening live chat; a stop during live chat ends the whole agent, not just the message it came from, since the user is taking over.

### The recommended option, and who takes it when nobody answers

#### Context

**Problem**: a gate [3] parked for an answer must never hang the agent [1]: an agent nobody watches, an agent stopped [12] while parked, or an ask that fails still has to resolve to something deterministic. The recommended option is that something, and taking it is what lets unattended work go on.

#### Business logic

- On a single-select gate the recommended option is the one the agent named, else the first option. It is shown pre-selected.
- A headless agent, one with no surface at all to ask on, takes the recommended option without pausing. A multi-select takes its pre-checked set.
- A gate parked for a pick resolves to the recommended option the moment the agent is stopped or hits its budget cap, and also when the ask itself fails; the wait never rejects.
- An answer that names no option of the gate resolves to the recommended option rather than to an unknown id.
- The resolution recorded on the event stream [10] says who picked: the user, the dashboard on the user's behalf, or the automatic fallback.

### The opening exchange

#### Context

See `## Context`.

#### Business logic

- The exchange opens with the prompt given; when the driver session [7] was seeded with a finished agent's conversation, the opening prompt resumes that conversation so the agent [1] replies with its full prior context, otherwise it starts fresh.
- The opening turn's turn signals [11] are emitted, then its gates are answered as above.
- A pick that stopped ends the exchange here. Otherwise, when a live chat [6] source is wired, the chat phase follows; a headless agent has none and ends when the agent stops asking.
- The result is the last turn's text, whether the agent was still asking past the await limit [5], and whether a pick stopped it. Once chat has run, those are the chat's last turn and outcome, not the opening's, so a chat closed by the Stop button never reports an await-limit notice the opening exchange did not earn.

### The live-chat phase

#### Context

**User story**: the agent's work has settled; the user writes a message in the composer and the agent answers in the same conversation, then the next message, and so on. A message that arrives while the agent works is answered once the current turn settles.

#### Business logic

- Each message [6] is delivered by resuming the same driver session [7], so the agent [1] has the whole conversation; the message appears in the dashboard's feed panel as the agent's own "YOU" row and is not echoed as a separate log line. The message's turn has its turn signals [11] emitted and its gates [3] honored by the same loop, with the same await limit [5].
- By default the phase only drains: a message that has already arrived is processed, and once no message is queued the agent ends itself rather than parking, so the handoff fires at that natural end and a later message reopens the conversation by resuming the driver session. A stopped agent takes no queued message.
- With stay-open on, for an agent whose own terminal dashboard is its single surface and has no daemon to resume through, the agent parks for the next message instead, and says so each time it parks by marking itself settled [13] on the event stream [10], so a reader can tell waiting from working. It ends when the message source closes or the agent is stopped.
- A pick marked to stop ends the whole agent, not just the message it came from.
- The outcome reported is that of the last chat turn: a phase that ends on Stop or on an idle queue is not exhausted.
