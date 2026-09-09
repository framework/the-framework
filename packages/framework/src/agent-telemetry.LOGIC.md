Keeps the accounting and the controls every agent [1] shares whatever prompt opened it: it emits the agent's session opening, follows the driver [2]'s own progress events to surface the driver session [3]'s id and link, the cloud anchor [4] and the running usage total, composes the one stop signal every turn [5] runs under, and classifies how an agent ended as a stop or a failure.

## Context

**User story**: in the agent view [6] the user sees which coding agent [7] is running, in which checkout [8], on which model, a link to jump into the coding agent's own session, and a live spend readout. When the agent ends, its badge says stopped or failed, and the detail says why.

**Business logic story**: the driver reports its progress as black-box events. `agent.ts` wires the handler defined here as the sink of those events, so the agent's own event stream [9] carries what the dashboard and the daemon need after the agent's process is gone. The one self-stop an agent has, a pick [10] marked stop [11], is composed here with the user's Stop, so that everything downstream stops the same way whichever fired.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id. Say "session id" and "session link" for its id and URL.
[4] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's.
[5] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[6] agent view: one agent's page.
[7] coding agent: the CLI doing the actual work: Claude Code or Codex.
[8] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[9] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[10] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[11] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[12] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[13] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[14] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[15] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.

## Business logic — TL;DR

- **The session opening** - the agent's first event records the driver, the checkout, whether the driver is the fake demo, the model when one was chosen, and a literal session link at once; a templated link waits for the session id.
- **The session id and its link** - the driver's turn-start announcement of its session id is consumed rather than shown, and turns into a session update the moment the id changes; the driver's own session URL beats the link template.
- **The cloud anchor reaches the record as an event** - a turn result carrying the anchor commit emits it, because only an event reaches the agent's record once its process is gone.
- **Usage totals** - every turn that reports usage is folded into a running total emitted after each such turn; the cost stays absent until a turn is priced.
- **One stop signal, and no self-stop for spending** - every turn runs under the user's Stop combined with a stop pick, and nothing else: a running agent is never cut short for cost or quota.
- **Stopped or failed** - the user's Stop or a stop pick is a clean stop, with "stopped by your answer" as the detail for a pick; any other error is a failure carrying the error's message.

## Business logic

### The session opening

#### Context

See `## Context`.

#### Business logic

The agent's first event records the driver [2]'s implementation id, the checkout [8] the agent works in, whether the driver is the fake demo driver, and the model the driver was started with when one was chosen. No model recorded means the coding agent [7] runs on its own default, which is not knowable here. A session link is included right away only when it is a literal URL; a link template that contains the session id placeholder cannot resolve yet and is left for the session update below. Every later reader takes the checkout from this event, because a finished agent's checkout is removed while the event survives.

### The session id and its link

#### Context

**Problem**: the coding agent's session id is the handle that resumes its conversation, both for "Resume" in the dashboard and for the coding agent's own resume command. It is only known once the coding agent reports it, and a turn that never settles (a Stop, a crash) would take the id down with it if the id were only read off the turn's result.

#### Business logic

The driver may announce its session id at the start of a turn [5] and repeats it on the turn's result. The announcement is consumed rather than forwarded to the transcript: a row repeating an id the very next event also carries would only be noise. Whenever the announced or the resulting id differs from the last one seen, a session update is emitted with the id and a link. The link is the driver's own session URL when the result carries one (a cloud session [12] knows its real URL), else the link template with the id filled in, else none. Every other driver event is forwarded verbatim as the coding agent's own progress and never gated on.

### The cloud anchor reaches the record as an event

#### Context

**Business logic story**: a `web` agent's work ends up on a branch of the cloud session's own naming. The daemon later recognizes that branch as the agent's by descent from the anchor commit (the rules are in `cloud-work.ts`), reading the agent's record after the agent's process is gone. Only an event reaches that record.

#### Business logic

When a turn's result carries the anchor commit's hash, a cloud-anchor [4] event with that hash is emitted before anything else is read off the result. A result without one, which is every driver whose work stays on the agent's own branch, emits none.

### Usage totals

#### Context

**User story**: the dashboard's spend readout grows as the agent works, and the agent's record says what it cost.

#### Business logic

After every turn whose result reports usage, the turn's tokens (input, output, cache read, cache creation) are added to the agent's running total, the count of reporting turns grows by one, and the total is emitted. The cost is kept in dollars as the coding agent prices it and stays absent, rather than zero, until a turn reports a price, so an agent that reports tokens without prices (Codex does) never reads as free. A turn that reports no price still counts its tokens. The arithmetic is `usage.ts`'s.

### One stop signal, and no self-stop for spending

#### Context

**Problem**: a running agent has already spent its tokens and has its work half done; cutting it short saves the cheap part and loses the expensive part. Whether an agent may spend is decided once, before it starts, by the daemon's quota boundary [13]. A running agent is never paused, degraded or cut short for cost or quota [14].

#### Business logic

Every turn runs under one composed signal: the agent process's own signal (the Stop button, Ctrl-C, a stop on the control file) combined with the agent's one self-stop, an answer to a gate [15] with an option marked stop [11]. Anything that watches the composed signal stops the same way whichever of the two fired. There is no per-agent cost cap and no mid-agent quota gate.

### Stopped or failed

#### Context

**User story**: an agent the user stopped, or ended by declining its plan, shows as stopped, never as a failure.

#### Business logic

When an agent's turn loop throws, the ending is a clean stop when the agent process's own signal is tripped (the user's Stop) or when a stop pick [10] tripped the self-stop; the end event is then flagged stopped. The detail is "stopped by your answer" when a stop pick ended the agent, and otherwise the error's own message. Anything else is a failure, with the error's message as the detail.
