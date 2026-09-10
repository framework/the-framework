The control file [1]: the steering channel from the dashboard to a running agent [2], the reverse of the event stream [3]. The daemon appends one JSON line per instruction, the agent's process tails the file and acts on each well-formed line, and an agent truncates the file at its start so a previous agent's picks [4] never fire into it. There is no other channel between the daemon and an agent's process: the file is the seam in both directions.

## Context

**User story**: the user presses Stop, answers a gate [5] card, sends a live chat [6] message, moves the handoff [7] checkboxes or presses Merge in the dashboard, and the running agent reacts, even when the dashboard tab was opened after the agent started.

**Problem**: a half-written or malformed line must never crash an agent, and must never disarm its handoff by accident, because that decides whether the agent's work reaches the remote at all.

## Glossary

[1] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[5] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[6] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[7] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[8] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Five instructions** - a stop, a pick for a parked gate, a live chat message, a move of the handoff level, and the user's Merge action.
- **Appending** - the daemon appends one JSON line per instruction to `.the-framework/control.jsonl` in the agent's checkout, creating the directory and the file as needed.
- **Reset at start** - an agent truncates the file before tailing it, so picks meant for an earlier agent in the same checkout are never taken as answers to its own gates, whose ids repeat.
- **Tailing and what is refused** - the file is followed as it grows, without keeping the process alive; a line that is not a well-formed instruction is skipped, and a handoff line whose level is not a rung is skipped rather than applied.

## Business logic

### Five instructions

#### Context

See `## Context`.

#### Business logic

An instruction is one of: a stop (the Stop button); a pick [4] for a parked gate [5], carrying the gate's id, the picked option or, for a multi-select gate, the list of picked options (possibly empty), and who picked (the user, the autopilot countdown, or an automatic accept); a live chat [6] message carrying its text; a move of the handoff [7] to one rung, sent as a single rung rather than as separate checkboxes so an impossible combination such as "a pull request with no push" is resolved on the dashboard's side and never arrives here; and the user's Merge action, which carries nothing and means "arm the full ladder and record that a human authorized the merge", a pre-commitment for the agent [2]'s own end, not a stop. What the agent's process does with each is `cli.ts`'s; the handoff move is echoed back as an event so the agent's record shows it.

### Appending

#### Context

**Business logic story**: the dashboard's steering requests end here; the daemon writes on the user's behalf.

#### Business logic

Each instruction is appended as one JSON line to `.the-framework/control.jsonl` inside the agent [2]'s checkout [8]; the `.the-framework` directory and the file are created when missing.

### Reset at start

#### Context

**Problem**: gate [5] ids such as a plan approval repeat from one agent [2] to the next, so a pick [4] left in the file by an earlier agent in the same checkout [8] would answer the new agent's gate before it was even asked.

#### Business logic

Before an agent starts tailing, the file is truncated to empty (created if missing). Only lines appended after that moment reach the agent.

### Tailing and what is refused

#### Context

**Problem**: file-change notifications are unreliable across platforms, and steering must never be the reason a process stays alive after its agent [2] ended.

#### Business logic

The file is followed as it grows, by watching the `.the-framework` directory with a polling backstop (the mechanics are `jsonl-tail.ts`'s), and each new line is parsed and handed over; the watcher never keeps the process alive on its own, and closing it is idempotent. A line is acted on only when it is a well-formed instruction: a stop and a Merge action need nothing more; a handoff move must name one of the four rungs, otherwise it is skipped rather than applied, because a half-written entry would otherwise disarm the handoff [7]; a message must have non-empty text; a pick [4] must have a non-empty gate id and a pick that is a string or a list of strings, an empty list included. Anything else, including a line that is not JSON or an instruction of an unknown kind, is skipped silently so a bad write can never crash an agent.
