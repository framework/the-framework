Renders an agent's [1] event stream [2] in a terminal, one human-readable line per event, as the CLI's projection of the same events the dashboard shows: what the agent is set up with, what it does, what it asks, what everything cost, and how the agent ended.

## Context

**User story**: the user reads an agent's [1] life line by line: the prompt it was given, each turn's [3] text and actions, the question it stops at with the recommended option marked, what it cost, and how it ended.

**Problem**: a reason or a state is said in the reader's terms, never as an internal code, and a missing price must never read as free.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, one event per line of the agent's diary — the file `<id>.jsonl` the tool that runs the agent writes under `.the-framework/` in the agent's checkout, copied onto the `agent-data` branch when the agent ends. Every surface (dashboard, terminal, replay) is a projection of it.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[5] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id. Say "session id" and "session link" for its id and URL.
[6] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[7] pick: the answer to a gate: the option or options chosen.
[8] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[9] stop: ending an agent before it finishes: the Stop button or Ctrl-C.

## Business logic — TL;DR

- **The agent's setup** - the driver and model in the checkout with the session link, and the session id with its link once known.
- **Gates** - the question with one option per line, the recommended one, or the ones that start checked, marked.
- **Usage** - the spend in dollars over the turns, or the tokens when no price was reported, never a zero that reads as free.
- **The driver's own events** - the prompt, the text, the actions, the turn boundary, quota warnings only when the quota is tight, errors, notices, and the question a turn ended on.
- **The end** - "✓ finished", "■ stopped", "? waiting for an answer", or "✗ failed" with the detail.

## Business logic

### The agent's setup

#### Context

See `## Context`.

#### Business logic

The session opening prints "◆ <driver, or "fake" for the fake driver> (<model>) in <checkout>", the model part only when one was recorded, followed by " — <session link>" when the opening carried one. The driver session [5] id, once known, prints "session <id>", followed by " — <session link>" when there is one.

### Gates

#### Context

**User story**: in a terminal the user sees the question and its options the way the dashboard's card shows them, the recommended option marked.

#### Business logic

A gate [6] prints "? <title>" and then one option per line, indented. On a gate that takes several picks [7] each option carries "[x]" when it starts checked and "[ ]" otherwise; on a single-pick gate the recommended option carries "●" and every other "○".

### Usage

#### Context

**Problem**: a coding agent on a subscription reports no price, and a "$0.0000" would read as free.

#### Business logic

With a price, usage prints "spend: $<cost, four decimals> over <n> turn(s)". Without one it prints the tokens the agent [1] did report: "tokens: <input + cache-read + output tokens> (<output tokens> out) over <n> turn(s) — no price reported". The turn [3] count is singular or plural as it should be.

### The driver's own events

#### Context

**Business logic story**: the driver [4] streams the coding agent's own doings while a turn [3] runs; they are printed indented under the agent's [1] lines.

#### Business logic

A turn starts with "› prompt: <the prompt, flattened and cut to 140 characters>" and ends with "‹ turn complete". The coding agent's text prints flattened and cut to 100 characters, each action as "· <label>", an error as "! agent error: <message>", a notice as "~ <message>", and the question a turn ended on as "? <its title, cut to 140 characters>". A session id the driver reports mid-stream prints as "session <id>" so a stray one reads as what it is. The quota [8] is quiet on the happy path: "✗ quota exhausted (<window>), resets <time>" when a request was rejected, "! quota running low (<window>), resets <time>" when the coding agent warns, and otherwise "· quota <status> (<window>), resets <time>", the time as an ISO timestamp.

### The end

#### Context

See `## Context`.

#### Business logic

The last line is "✓ finished" for an agent [1] that ended well, "■ stopped" for one that was stopped [9], "? waiting for an answer" for one that ended on a question and waits for the user's answer, and otherwise "✗ failed: <detail>", or "✗ failed: unknown error" when the end carried no detail.
