The gate machinery: how an agent's parked question reaches the user, how the pick comes back, and how the agent is carried on from there — including the live chat that follows once the agent stops asking.

## User story

- While an agent works, it can stop and ask the user a question with a list of options; the user answers on the dashboard and the agent carries on with that answer.
- One of the options an agent offers can mean "stop, I will take it from here" — picking it hands control back to the user instead of continuing.
- Once an agent's work has settled, the user can keep talking to it, and each message continues the same driver session with all its prior context.

## Business logic — TL;DR

- **One question, one pick, one continuation** - a gate is put on the agent's event log as a choice, the agent parks until a pick arrives, and the picked option's label is what the agent is told.
- **Pick one, or pick several** - single-select answers with the one label; multi-select answers with the labels kept, or `(none)`.
- **A stopping pick ends the agent** - the agent is never told the answer; the turn it asked from is its last.
- **Ask until the agent stops asking** - each answered gate continues the agent, up to a fixed cap on rounds.
- **A gate never hangs** - with nobody to ask, or when the agent is stopped mid-question, the gate resolves itself to the recommended option (or the pre-checked set).
- **Chat after the work** - the user's own messages each resume the same driver session, and any gate they produce is answered the same way.
- **Every turn's signals are read** - the answer rounds and the chat turns are turns like any other, so each one's final message is parsed for signals.

## Business logic

### Asking one question

#### User story

The agent has reached a decision it should not make alone — which plan to follow, whether to proceed — and needs the user to choose.

#### Business logic

The question and its options go onto the agent's event log as a choice, and the agent parks. When the pick comes back, the picked option's label is what the agent is told; a multi-select gate is answered with all the labels kept, joined together, or `(none)` when the user cleared everything. A pick naming an option the gate never offered is treated as the recommended one; unknown ids in a multi-select answer are dropped.

A single-select gate can name a markdown file it is asking approval for, which the dashboard renders in its document sidebar. Both the question and its resolution are recorded on the event log, including whether the answer came from the user or was filled in automatically.

The first question of an exchange keeps a fixed gate identity, and each re-ask after it gets its own — otherwise the dashboard cannot tell a fresh question from the one it just answered.

### Answering until the agent stops asking

#### User story

An agent may need several answers in a row, but it must never be able to hold a user in an endless question loop.

#### Business logic

Each answer is fed back to the agent, whose next turn may ask again; this repeats up to a fixed cap on rounds. Whichever way it ends — the agent stopped asking, the user picked a stopping option, or the cap tripped — is reported, and the three are kept distinct: work that ended because the user chose to stop is never reported as an agent that ran out of rounds.

Every turn produced this way has its final message parsed for signals, exactly like the opening turn.

### Handing control back

#### User story

The user reads the agent's question and decides they would rather take over themselves, so they pick the option that says so.

#### Business logic

An option the agent marked as stopping ends the agent when it is picked. The agent is not told the answer and is not continued: the turn it asked from is its last, and a note saying the user stopped goes onto the event log. On a multi-select, one stopping pick among several still stops — an answer that says "stop" is not softened by the answers next to it. A stopping pick during live chat ends the whole conversation, not just the message it came from: the user has taken over, so parking for their next message would be waiting on someone who has already answered.

### Never hanging on a question nobody can answer

#### User story

An agent started without a user interface, or one the user stops (or that hits its budget cap) while a question is on screen, must still finish rather than sit parked forever.

#### Business logic

With no interactive answerer wired, the gate resolves immediately to the recommended option — or, for a multi-select, to the set that starts checked. The same fallback applies when the agent is aborted while the question is parked, and when the answer never arrives. This is what keeps an unattended agent deterministic.

### Live chat after the work settles

#### User story

The agent has finished its task and the user wants to keep going with it — a follow-up, a correction — without losing the conversation so far.

#### Business logic

Once the agent stops asking, the user's own messages are delivered one at a time, each resuming the same driver session so the agent keeps its full prior context; any gate a message produces is answered by the same rounds as above. The user's message shows in the feed as the driver's own turn opening, so it is not echoed a second time.

By default the conversation only drains: messages that already arrived are processed, and when none is left the agent ends itself rather than parking on the user — a later follow-up reopens the same conversation. An agent whose own terminal is its only surface instead stays parked for the next message, announcing each time that it is waiting rather than working, and ends only on Stop or its budget cap.

Once chat has run, how the chat ended is the agent's end reason — not how the opening exchange ended.

#### Rationale

Reporting the opening exchange's round cap after a chat had run made an agent the user closed with Stop read as one that had run out of answer rounds, and logged a spurious notice about the await limit.

### Resuming a finished agent

#### User story

The user reopens a finished agent to ask it one more thing.

#### Business logic

When the agent is seeded with a finished agent's session, its opening message resumes that conversation with the full prior context instead of starting a fresh one. A brand-new agent opens fresh.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
