Renders an agent's [1] event stream [2] in a terminal, one human-readable line per event, as the CLI's projection of the same events the dashboard shows: what the agent is set up with, what it does and signals, what it asks, what everything cost, and how the agent ended.

## Context

**User story**: the user runs an agent [1] from a terminal, or watches the daemon's output, and reads the agent's life as it happens: the prompt it was given, each turn's [4] text and actions, the question it stops at with the recommended option marked, "✓ ready for merge", the pull request, and how the agent ended.

**Problem**: a reason is said in the reader's terms, never as an internal code.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, one event per line of the agent's diary — the file `<id>.jsonl` the tool that runs the agent writes under `.the-framework/` in the agent's checkout, copied onto the `agent-data` branch when the agent ends. Every surface (dashboard, terminal, replay) is a projection of it.
[4] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[5] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[6] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id. Say "session id" and "session link" for its id and URL.
[7] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent.
[8] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[9] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready.
[10] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[11] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[12] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[14] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[15] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[16] autopilot: the dashboard's switch that accepts a gate's recommended option for the user after a countdown.

## Business logic — TL;DR

- **The agent's setup** - the driver and model in the checkout with the session link, the prompt, the branch, the cloud anchor, the pull request number, and a screen's label.
- **What the agent signals** - its log lines, errors with their detail indented, views by title, "✓ ready for merge", the pull request it wrote, and "done for now" when it is settled.
- **Gates and picks** - the question with one option per line, the recommended one marked, and the pick with who made it.
- **Usage** - the price of one turn in dollars.
- **The driver's own events** - the prompt, the text, the thoughts, the actions, the turn boundary, quota warnings only when the quota is tight, errors, notices, and the question a turn ended on.
- **The end** - "✓ finished", "■ stopped", "? waiting for an answer", or "✗ failed" with the detail.

## Business logic

### The agent's setup

#### Context

See `## Context`.

#### Business logic

The session opening prints "◆ <driver> in <checkout>" ("fake" in place of the driver for the fake driver), with " (<model>)" after the driver when a model was chosen and " — <session link>" when the link is known; a later session id prints "session <id>", with its link when known. The intent prints as "▶ "<the prompt, flattened and cut to 100 characters>"". The branch prints "branch: <branch>", the cloud anchor "hand-off anchor: <its first seven characters>", and the pull request "pull request: #<number>". A screen prints "◆ <label>", its `ended` line included, since the terminal shows no live page.


### What the agent signals

#### Context

See `## Context`.

#### Business logic

A log line is printed as is. A reported error is "✗ <headline>", with its detail, when there is one, indented on the lines below. A view [8] is "▶ view: <title>". The ready-for-merge [9] signal is "✓ ready for merge". The pull request the agent wrote is "pull request written", followed by ": <title>" when it has one. A settled [10] agent prints "◆ done for now — waiting for your next message".

### Gates and picks

#### Context

**User story**: in a terminal the user sees the question and its options the way the dashboard's card shows them, with the option that will be taken when nobody answers marked.

#### Business logic

A gate [11] prints "? <title>" and then one option per line, indented. On a gate that takes several picks each option carries "[x]" when it starts checked and "[ ]" otherwise; on a single-pick gate the recommended option carries "●" and every other "○". The pick [12] prints "✓ chose <the picked ids, comma-separated>" or "✓ chose (none)", followed by who picked in parentheses: the user, the autopilot [16] countdown, or the automatic fallback.

### Usage

#### Context

**Problem**: a coding agent on a subscription reports no price, and a "$0.0000" would read as free. The agent's [1] record keeps a cost line only for a turn [4] the coding agent priced, so a turn without a price has no usage event to print.

#### Business logic

Usage prints "spend: $<cost, four decimals>", the price of the one turn [4] the event is about.

### The driver's own events

#### Context

**Business logic story**: the driver [5] streams the coding agent's own doings while a turn [4] runs; they are printed indented under the agent's [1] lines.

#### Business logic

A turn starts with "› prompt: <the prompt, flattened and cut to 140 characters>" and ends with "‹ turn complete". The coding agent's text prints flattened and cut to 100 characters, each action as "· <label>", followed by two spaces and its detail cut to 140 characters when it has one ("· Bash  git status"), each thought as "💭 <the thought, cut to 140 characters>", an error as "! agent error: <message>", a notice as "~ <message>", and the question a turn ended on as "? <its title, cut to 140 characters>". A session id the driver reports mid-stream prints as "session <id>" so a stray one reads as what it is, and the model the coding agent says a turn runs on as "model <its full id>". The quota [14] is quiet on the happy path: "✗ quota exhausted (<window>), resets <time>" when a request was rejected, "! quota running low (<window>), resets <time>" when the coding agent warns, and otherwise "· quota <status> (<window>), resets <time>", the time as an ISO timestamp.

### The end

#### Context

See `## Context`.

#### Business logic

The last line is "✓ finished" for an agent [1] that ended well, "■ stopped" for one that was stopped [15], "? waiting for an answer" for one that ended on a question and waits for the user's answer, and otherwise "✗ failed: <detail>", or "✗ failed: unknown error" when the end carried no detail.
