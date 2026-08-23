The control channel: the way steering reaches a running agent. The agent's own narration flows out through its event log; instructions flow back in through `.the-framework/control.jsonl`, which the daemon appends to and the agent tails. The file is the seam — there is no direct channel between the daemon's process and the agent's.

## Business logic — TL;DR

- **Five instructions** - Stop, a pick answering a parked gate, a live chat message, a change to how far the agent publishes itself, and the user's Merge action.
- **A fresh channel per agent** - the file is truncated when an agent starts, so a previous agent's picks can never fire into this one.
- **Malformed instructions are ignored, never fatal** - an unreadable or incomplete line is skipped rather than crashing the agent.
- **Steering never keeps a process alive** - watching the channel is not on its own a reason for the agent's process to stay running.

## Business logic

### The five instructions

#### User story

While an agent works, the user presses Stop, answers one of its gates, types it a message, changes whether it will push, open a pull request or merge, and — when they have seen enough — presses Merge.

#### Business logic

**Stop** ends the agent. **A pick** answers the gate it names, carrying who answered it (the user, or autopilot) so the record can distinguish a human's answer from an automatic one; a multi-select pick may legitimately be empty. **A message** is a live chat message for the running agent, and must carry actual text. **A handoff change** moves the whole publish ladder to one named rung — keep it local, push the branch, open a pull request, or merge it. **Merge** arms the full ladder and additionally records that a human authorized the merge.

#### Rationale

The handoff travels as one rung rather than a pair of switches, so a surface offering checkboxes resolves an impossible combination *on its own side* — down, to something coherent — instead of sending "a pull request with no push" for the agent to repair upward.

The handoff change is an instruction rather than a recorded event because it has to reach an agent whose dashboard tab was opened after that agent started; the agent echoes back what it applied as an event, which is what puts it on the agent meta that those checkboxes read.

Merge is a pre-commitment rather than an interruption: the agent still ends at its own natural end and merges there. Recording the human authorization is what lets the merge gate stop also demanding the agent's own ready-for-merge signal — a human's word outranks it.

### A fresh channel per agent

#### User story

An agent must never act on an answer that was meant for a different agent.

#### Business logic

The channel is truncated when an agent starts. Gate identifiers repeat from one agent to the next, so without this a leftover pick from a previous agent in the same checkout would silently answer a question the new agent had not finished asking.

### Nothing here can break an agent

#### User story

An agent must survive whatever ends up in the file.

#### Business logic

Each appended line is checked before it is acted on, and anything malformed, incomplete or unrecognised is skipped. A handoff instruction is only obeyed when its rung is one of the four real ones, because a half-written line would otherwise disarm publishing by accident — and this is what decides whether the agent's work reaches the remote at all. Watching the file combines a filesystem watch with a periodic poll, since the watch alone is unreliable across platforms, and the watch never counts as work keeping the agent's process alive.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
