The signal protocol: the exact syntax for the three things an agent [1] tells The Framework without stopping its turn [2]. An empty `ready-for-merge` block is the ready-for-merge [3] signal the built-in system prompt calls `setReadyForMerge()`; an `open-pr` block names and describes the pull request The Framework opens for the agent; an `error` block reports something only the user can fix. It is the last thing in every agent's system channel, vanilla [4] agents included; only a transparent agent does not receive it. The session name is not a signal: the agent names its branch and the name is read off the branch.

## Context

**User story**: the user sees the agent's badge flip from building to ready the moment the agent says its work is complete, and later a pull request whose title and body are the agent's own words about what the work turned out to be, not the prompt repeated; an error the agent hit shows up counted on the agent, with a headline the user reads without opening the whole event stream.

**Business logic story**: the built-in system prompt says when to signal ready for merge [3]; this protocol only pins how. The composition rule in `src/system-prompt.ts` keeps it last in the system channel; what The Framework reads off each turn's [2] final message is the rule in `src/turn-gate.ts`, summarized below per signal. All three signals are non-blocking: the agent emits the block and keeps going.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[4] vanilla: an agent started without the built-in system prompt but with the signal protocols kept. transparent: an agent started with nothing of The Framework's, the raw coding agent.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local`, `push`, `pr` (the default), `merge`.
[6] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[7] event / event stream: everything an agent does, one event per line; every surface (dashboard, terminal, archive, run) is a projection of it.
[8] gate: a question with options at which an agent stops and waits for an answer.

## Business logic — TL;DR

- **Ready for merge** - calling `setReadyForMerge()` means emitting an empty `ready-for-merge` block, which flips the dashboard from building to ready and does not stop the turn.
- **Opening a pull request** - with every ready signal the agent also emits an `open-pr` block shaped like a commit message, and The Framework opens the pull request from it, adding the ticket's issue reference and recording the number; the last block of a turn wins.
- **Reporting an error** - something only the user can fix is an `error` block, headline first, detail below; The Framework records and counts it on the agent, once per identical block, without stopping the turn or asking the user anything.

## Business logic

### Ready for merge

#### Context

**Business logic story**: the built-in system prompt tells the agent [1] to call `setReadyForMerge()` only when its work is finished with nothing left to do, and that the work is never merged without it.

#### Business logic

When the agent [1] calls `setReadyForMerge()`, meaning it believes the work is complete and ready for human review, it emits an empty fenced block tagged `ready-for-merge`. The agent is told this flips the dashboard status from building to ready and does not stop its turn [2].

What The Framework does: a `ready-for-merge` block anywhere in the final message marks the agent ready for merge [3], once for the whole span of the agent's turns however often it is restated; the badge flips and the handoff [5] is authorized.

### Opening a pull request

#### Context

**Problem**: a pull request opened without the agent's own words can only be titled and described from the prompt the agent [1] was given, which says what was asked, not what the work turned out to be; and an agent opening the pull request itself would have to know the ticket's issue reference and tell The Framework the number, which the handoff [5] otherwise keeps consistent on its own.

#### Business logic

Whenever the agent [1] emits `ready-for-merge`, it also emits a fenced block tagged `open-pr`, written like a commit message: the first line names what the change does, under 100 characters, and the rest, markdown as long as it needs to be, says what changed and why. The agent is told that The Framework opens the pull request for it, so it need not run `gh pr create`; that The Framework supplies the ticket's issue reference where there is one and records the number so every surface shows the same pull request; that it does not stop; that it may re-emit the block as the work changes and the last one is used; and that opening the pull request itself still works, in which case it owns all of the above.

What The Framework does: the last non-empty `open-pr` block of the turn [2] is the pull request's title and description. A first line longer than 100 characters is not taken as a title: the whole block is then the description and the title falls back to the session name [6], so a paragraph never becomes a squash-merge subject. Across turns, the description is re-emitted only when it actually changed.

### Reporting an error

#### Context

**User story**: the agent [1] was told to read a file that does not exist, a command will not run, or it lacks a login; the user learns of it from a headline counted on the agent, without reading the whole event stream [7].

#### Business logic

When the agent [1] hits something only the user can fix, it emits a fenced block tagged `error`: the first line is the headline, what is wrong in one line; anything below it is the detail, what it ran and what that said. It then carries on or stops as the task requires. The agent is told that The Framework marks the error in the agent's log and counts it on the agent so the user sees it without reading everything; that the block does not stop its turn [2] and does not ask the user anything, a question being what a gate [8] is for; and that it should report the same thing once, because a re-emitted identical block is ignored.

What The Framework does: every non-empty `error` block of the final message is recorded as an event [7] on the agent, in the order written, so two things going wrong in one turn are two errors; an empty block is not an error; an identical block, headline and detail together, is recorded once for the whole span of the agent's turns, while a second attempt that fails differently is its own error.
