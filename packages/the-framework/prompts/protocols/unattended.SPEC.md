Told only to a hands-off agent that nothing can answer, right after the await protocol it amends: no question this agent stops to ask could reach the user, so it is instructed to decide for itself instead of parking at a gate.

## User story

- The user hands a task to a cloud session with the Claude web bridge switched off and walks away. An agent that stops there to ask a question waits forever, because nothing attached can carry the question back or answer it.
- The user would rather get finished work resting on a stated assumption than find the task stalled on a question nobody was ever asked.

## Business logic — TL;DR

- **Decide alone** - where the instructions say to show options and await, the agent takes the most plausible reading, states in one line which assumption it made, and carries the work through to the end.
- **The gate is never emitted** - the agent neither writes the await block nor stops its turn, so there is no parked question and nothing to resume from.
- **The non-blocking signals still apply** - showing a document, setting the session name and signalling ready for merge are unaffected.
- **Told only when nothing can answer** - a hands-off agent is given this only while the Claude web bridge is off; with the bridge on its gates work and the protocol is left out.

## Business logic

### Decide alone

#### User story

See `## User story`: nothing that can answer a gate is connected to this agent's session.

#### Business logic

The prompt states outright that nothing able to answer a gate is attached. Wherever the agent's other instructions tell it to show choices, show a multi-select or show a document and then await, it must not emit the await block and must not stop. Instead it takes the most plausible interpretation — the option it would have marked as recommended — states in one line which assumption it made, and carries the work through to the end.

The non-blocking blocks are named as unaffected: showing a document, setting the session name, and signalling ready for merge all still apply.

#### Rationale

It is worded as an availability — nothing is attached to *this* session — rather than as a standing rule about the run target, because the same task on the same target is told the opposite as soon as the bridge is on.

### Told only when nothing can answer

#### User story

The user turns the Claude web bridge on and expects a cloud session's questions to reach their dashboard, rather than being decided without them.

#### Business logic

This protocol is added to an agent's system channel only when that agent is hands-off *and* the Claude web bridge is off. Which of the two it is is decided once, at the hand-off, because a session's standing instructions cannot be changed after it has left.

With the bridge on the protocol is left out entirely, and the cloud session parks on its gate exactly as a local agent would: the browser extension carries the question into the dashboard, the user answers it there, and the answer is typed back into the session.

It sits immediately after the await protocol, which describes the gates in full — so the shape The Framework parses is still taught, and only reaching for it is withdrawn.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
