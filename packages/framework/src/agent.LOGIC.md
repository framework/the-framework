Runs one agent [1] from its first prompt to its end event: frames the coding agent [2], opens one driver session [3] for the whole agent, sends the opening prompt, honors every gate [4] the coding agent stops at, works the agent queue [5] when the agent is a build agent [6], takes the user's live chat [7], and ends, while streaming every step onto the one event stream [8] the dashboard, the archive and the run are projections of. A hands-off [9] agent is the exception to the middle of that story: its opening turn [10] is the whole agent.

## Context

**User story**: the user starts an agent from the launcher [11], or the daemon starts one on its own. The user watches it in the agent view [12], answers the questions it stops at, chats with it from the composer [13] once its work has settled, and finds the work handed off when the agent ends. Or nobody watches: the agent takes the recommended option at every gate and ends when its work settles.

**Business logic story**: the agent's own process (`cli.ts`) resolves the configuration, tails the control file [14], decides who can answer gates and whether live chat is wired, and then hands everything to this file. This file is the middle of an agent's life. What happens to the work afterwards, the handoff [15], is `cli.ts`'s; the system channel's text is composed by `system-prompt.ts`; the gate mechanics live in `await-gate.ts`; the agent queue loop in `todo-loop.ts`; the reading of turn signals [16] in `turn-gate.ts`; the usage accounting and the stop plumbing in `agent-telemetry.ts`.

**Problem**: the coding agent is a black box that answers one turn at a time and never says on its own that it stopped to ask, that it named its work, or that it is done. Everything The Framework learns about a turn it reads off the turn's final message, and every decision about what to send next is taken here.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[4] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[6] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[7] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[8] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[9] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[10] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[11] launcher: the Start form on a project's own page.
[12] agent view: one agent's page in the dashboard.
[13] composer: the prompt editor on a project's own page, also used for live chat.
[14] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[15] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[16] turn signals: what The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.
[17] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[18] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[19] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`); `SYSTEM.md` is the project's own instructions added on top.
[20] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[21] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[22] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[23] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[24] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[25] await limit: the cap on consecutive gates within one exchange; an agent still asking past it finishes with its latest turn.
[26] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles. The opposite is attended.
[27] backlog loop: after a build agent's opening work settles, the loop that works the agent queue one entry per turn until it is empty.
[28] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[29] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[30] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[31] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.

## Business logic — TL;DR

- **The agent announces itself before its first turn** - three events open the stream in a fixed order: the session opening, the intent, and the full system channel; a surface that fails to consume an event never fails the agent.
- **Framing the coding agent** - the system channel is composed once from the built-in system prompt, `SYSTEM.md`, the in-context directories and the agent's situation (owned checkout, browser, hands-off), with vanilla and transparent as the two ways to leave it out.
- **One driver session for the whole agent** - every prompt of the agent goes into one driver session; a continuation resumes the stopped leg's conversation instead of starting a new one; the session is disposed however the agent ends.
- **The opening prompt** - the user's text rendered through the built-in system prompt's user-prompt slot, or verbatim for a continuation, a vanilla or a transparent agent.
- **The opening exchange** - the opening turn plus every gate it leads to, up to the await limit of five; nobody to answer means the recommended option; a pick marked stop ends the agent.
- **A stop is honored before any phase counts as a success** - after the opening exchange, and again after the backlog and chat, a stopped agent ends as stopped, never as done.
- **The backlog loop, and when it is skipped** - only a build agent that is not hands-off works the agent queue, and only when the loop is enabled, which it is by default for every driver but the fake demo one; a pick marked stop inside an entry ends the whole agent.
- **Live chat, and where it happens** - a prompt agent takes chat inside its opening exchange, a build agent after its backlog; by default the agent drains what has arrived and ends on an idle queue, and only a stay-open agent parks for the next message.
- **A hands-off agent ends at its first turn** - no backlog loop and no chat after it, an explicit "Handed off" line before the end, and the land-everything instruction in its system channel.
- **Every turn's signals are read** - each final message is parsed for views, reported errors, the ready-for-merge signal and the pull request text, with one deduplication span across the opening exchange and chat.
- **How the agent ends** - done with its final text and the backlog result; stopped when the user's Stop or a stop pick ended it, with "stopped by your answer" as the detail for a pick; failed on any other error; the error is passed on to the agent's process either way.

## Business logic

### The agent announces itself before its first turn

#### Context

**Problem**: a dashboard tab can open at any moment of an agent's life and must be able to tell what the agent is, what it was asked and what it was told without parsing a prompt. The store titles the agent from these events, and the dashboard shows the normally hidden system channel from them.

#### Business logic

Before anything is sent to the coding agent [2], three events open the event stream [8], in this order:

- The session opening: which driver [17] runs the agent, the checkout [18] it works in, whether the driver is the fake demo driver, the model when one was chosen, and the session link when it is a literal URL. A link template that needs the driver session's id is resolved later, by `agent-telemetry.ts`.
- The intent: the prompt text exactly as the agent was given it, so every surface titles the agent by it. A continuation's intent is its continuation message.
- The system channel's full text, only when there is one. A transparent [21] agent has an empty channel and emits nothing here.

Every event is also handed to the observer the agent's process wired (the journal that writes the event file). An observer that throws is logged and ignored: a broken surface never fails the agent [1] and never robs it of its end event.

### Framing the coding agent

#### Context

**User story**: the user sees, in the agent view [12], the whole text the coding agent was framed with before its first turn, and can switch the framing off from Settings or the repo file: vanilla [20] to drop the built-in system prompt [19], transparent [21] to run the raw coding agent.

#### Business logic

The system channel is composed once, before the driver session [3] opens, and never changed afterwards. Its inputs are: whether the agent is vanilla or transparent; the project's `SYSTEM.md` text when the project has one; the in-context directories the user picked; whether the checkout is one The Framework created, in which case the agent has the `branches` skill in its checkout, while any other agent is told how to branch with git itself and how to reach the tickets, the queue and the logs; whether the agent has a browser; and whether it is hands-off [9], in which case it is told to land everything (commit and open its own pull request) because nothing on this machine follows it. Transparent empties the channel entirely and overrides every other input. The composition rules, and the order of the parts, are `system-prompt.ts`'s.

Hands-off is decided here from the agent's location [22]: only `web` is hands-off; the default location is `local`. The model the user chose, when any, is passed to the driver [17] and recorded on the session opening.

### One driver session for the whole agent

#### Context

**Business logic story**: the coding agent keeps its own conversation. Sending every prompt into the same driver session is what lets a gate answer, a queue entry and a chat message land with the full context of what the coding agent already did.

#### Business logic

The driver starts one driver session [3] bound to the agent's checkout [18], with the composed system channel, the chosen model, and the agent's stop signal. Every prompt of the agent goes into that session: the opening prompt, every gate [4] continuation, every queue entry, every chat message.

A continuation names the driver session id of a stopped leg. The driver then resumes that conversation, so the coding agent [2] answers with its full prior context, and everything around the turn still runs: the gates, the backlog loop [27], live chat [7]. The flow resumes, not just the conversation.

The driver session is disposed when the agent ends, whichever way it ends.

### The opening prompt

#### Context

**Problem**: the built-in system prompt [19] ends with a user-prompt slot, which is the one place the user's text is framed. Framing it a second time, or framing it for an agent that has no built-in prompt, stacks a preamble the coding agent has no use for.

#### Business logic

The first thing the coding agent [2] is sent is the user's text rendered through the built-in system prompt's `# User prompt` slot, the same for a build agent and a prompt agent [6]. Three cases send the text verbatim instead: a continuation, because the resumed conversation already carries the framing; a transparent [21] agent and a vanilla [20] agent, because without the built-in prompt there is no slot to render into.

### The opening exchange

#### Context

**User story**: the coding agent stops to ask ("Which data store?", "Approve the plan?"), the dashboard shows the question as a card, the user picks, and the agent continues from the pick. When nobody is watching, the agent takes the recommended option and never waits.

#### Business logic

The opening prompt is sent as one turn [10]. When the turn's final message ends on a gate [4], the gate is resolved and the coding agent is re-prompted with the pick [23], and so on until the coding agent stops asking. The rules of one round are `await-gate.ts`'s; what this file relies on:

- Who answers: the pick is the user's when an answer handler is wired, which the agent's process does only for an attended agent. With no handler, or when the agent is stopped while a gate is parked, the recommended option is taken (for a checklist, its pre-checked set), and the agent never pauses. This is what makes an unattended [26] agent run through.
- The await limit [25] is five consecutive gates in one exchange. An agent still asking past it finishes with its latest turn, and the log says "Finishing the session (await limit reached)." That line is not written when chat followed the exchange, since the chat's own end is then the agent's reason for ending.
- A pick marked stop [24] ends the exchange at once: the coding agent is never told the answer, the log says "Stopped at your answer: <option>. Awaiting your instructions.", and the agent's stop signal is tripped so the agent ends exactly the way a Stop does. Building on a plan the user just declined is the one thing not to do.

### A stop is honored before any phase counts as a success

#### Context

**Problem**: the user's Stop and a pick marked stop trip the same stop signal between turns, but the exchange, the backlog loop and the chat do not observe that signal themselves. Without a check, a stopped agent would settle as done, and a done agent authorizes the handoff [15] of the very work the user declined.

#### Business logic

The agent checks its stop signal twice: right after the opening exchange, and again after the backlog loop [27] and the live chat [7], before the success path. When the signal is tripped, the agent ends as stopped (see "How the agent ends") and no later phase runs. The two sources of the signal are the user's Stop [24], which the agent's process raises from the Stop button, Ctrl-C or the control file [14], and a pick marked stop from any phase.

### The backlog loop, and when it is skipped

#### Context

**User story**: a build agent whose opening work has settled goes on to work the agent queue [5] one entry per turn until the queue is empty, asking "Start the next queue item?" before each entry when someone can answer.

#### Business logic

The backlog loop [27] runs only when all three hold:

- the agent is a build agent [6] (a prompt agent is one prompt by definition);
- the agent is not hands-off [9];
- the loop is enabled: explicitly by the agent's process, or by default when the driver [17] is not the fake demo driver, whose scripted demo writes no queue and must stay deterministic. The agent's process turns the loop off for a transparent [21] agent.

The loop's own rules (the per-entry gate, the entry cap, the removal of each worked entry from the `agent-data` branch) are `todo-loop.ts`'s. Two of its outcomes matter here: a pick [23] marked stop [24] inside an entry's turn ends the whole agent through the stop signal, while the per-entry "Stop the queue loop" pick only ends the loop, after which the agent goes on to chat and to its end. The loop's result (entries worked, why it ended) is handed back with the agent's result.

### Live chat, and where it happens

#### Context

**User story**: once an agent's work has settled, the user writes to it from the composer [13]; each message continues the same conversation. A daemon-started agent then ends by itself once nothing is queued, and the next message from the composer reopens it as a continuation.

**Business logic story**: live chat [7] is wired only when the agent's process hands the agent a message source, which it does for an attended agent that can be steered through the control file [14]; the rule is in `cli.ts`. An unattended [26] agent still receives messages: not being watched only means its gates take the recommended option.

#### Business logic

Where chat runs depends on the kind of agent: a prompt agent [6] takes it inside the opening exchange, right after its gates, because nothing comes between; a build agent takes it after the backlog loop [27], and only if the agent has not been stopped by then. A hands-off [9] agent is wired like a prompt agent: its message source is drained inside the opening exchange.

Each message is sent as a turn [10] resuming the same driver session [3], and the gates [4] that turn ends on are honored like the opening exchange's, with the same await limit. How chat ends:

- By default the agent only drains: a message that has already arrived is processed, and once the queue is idle the agent ends itself rather than waiting on the user.
- A stay-open agent parks for the next message instead, announces each park as settled [28] so the dashboard can show waiting rather than working, and ends only when its message source is closed, which a Stop does. Stay-open is meant for an agent whose own surface is its only one.
- A pick [23] marked stop [24] inside a chat turn ends the whole agent, not just the message it came from: the user is taking over.

For a build agent that took chat, the text handed back is the last chat turn's text, or empty when no message arrived; for a prompt agent it is the last turn's text of the whole exchange.

### A hands-off agent ends at its first turn

#### Context

**Problem**: a `web` agent hands its task to a cloud session [29], and the reply this machine gets is the driver's note about where the work went, not the coding agent's own words. Reading that note as a turn would put a "Start the next queue item?" gate on a dashboard whose agent is somewhere else entirely.

#### Business logic

For an agent whose location [22] is `web`:

- the system channel carries the land-everything instruction ("This session runs detached — land everything"), and nothing else about its gates changes: a cloud session's gates are the same as a local agent's;
- the opening exchange runs as for any agent;
- the backlog loop [27] is skipped even when it was explicitly enabled, and the agent queue [5] is left untouched and unasked about;
- the chat after the backlog is skipped;
- before the end event the log says "Handed off: the rest of this session happens in its own session, which opens its own pull request.", so a finished hands-off agent does not read as one that gave up after a turn;
- the agent then ends as done; the agent's process words its own success line as handed off, since this machine built nothing it saw.

### Every turn's signals are read

#### Context

**Business logic story**: the coding agent is told it may signal on any turn: push a view [30], report an error, declare itself ready for merge [31], describe its pull request. A turn whose final message is not parsed drops the signal.

#### Business logic

Every turn's final message is read for the turn signals [16] (the parsing rules are `turn-gate.ts`'s): the markdown views become view events, each reported error an error event, the ready-for-merge signal flips the agent to ready, and the pull request title and body are recorded for the handoff [15]. The gate the message stops at is what the exchange reads. One reader spans the opening exchange and the live chat, so ready for merge fires once across them and an error restated turn after turn is reported once; the backlog loop [27] has a reader of its own for the same reason.

### How the agent ends

#### Context

**User story**: the agent view [12] shows a finished agent as done, stopped or failed, and only a done agent goes on to the handoff [15]. A stop the user asked for must read as a stop, never as a failure.

#### Business logic

- Done: once every phase has run and the stop signal is clear, the end event says the agent finished well, and the agent hands back its final text, every event in order, and the backlog loop's result when the loop ran.
- Stopped: when the agent's turn loop threw and either the user's Stop [24] signal is tripped or a pick [23] marked stop tripped the agent's own stop, the end event says the agent did not finish and was stopped. Its detail is "stopped by your answer" for a stop pick, else the message of the error the abort raised.
- Failed: any other error ends the agent with an end event that says it did not finish, with the error's message as the detail.
- In the stopped and failed cases the error is passed on to the agent's process, whose epilogue decides what the handoff does with a stopped agent.
- The driver session [3] is disposed in every case.
