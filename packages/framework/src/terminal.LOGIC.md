Renders an agent's [1] event stream [2] in a terminal, one human-readable line per event, as the CLI's projection of the same events the dashboard shows: what the agent is set up with, what it does and signals, what it asks, what the handoff [3] will do and did, what everything cost, and how the agent ended. It also holds the wording for why an armed merge was withheld, shared with the CLI's own output so the two surfaces cannot drift.

## Context

**User story**: the user runs an agent [1] from a terminal, or watches the daemon's output, and reads the agent's life as it happens: the prompt it was given, each turn's [4] text and actions, the question it stops at with the recommended option marked, "✓ ready for merge", and one line saying what happens to the work when the agent ends, and then what did happen, merge included.

**Problem**: after "auto-merge was on", silence about the merge reads as "it merged", so every merge outcome is said out loud; and a reason is said in the reader's terms, never as an internal code.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[4] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[5] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[6] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id. Say "session id" and "session link" for its id and URL.
[7] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent.
[8] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[9] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[10] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[11] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[12] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[13] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[14] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[15] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[16] autopilot: the dashboard's switch that accepts a gate's recommended option for the user after a countdown.

## Business logic — TL;DR

- **The agent's setup** - the driver and model in the checkout with the session link, the prompt, the branch, the ticket, the cloud anchor, the preview and browser addresses, the pull request number.
- **What the agent signals** - its log lines, errors with their detail indented, views by title, "✓ ready for merge", the pull request it wrote, and "done for now" when it is settled.
- **Gates and picks** - the question with one option per line, the recommended one marked, and the pick with who made it.
- **The handoff, announced then reported** - one line saying what will happen when the agent ends, then what happened to the push and the pull request, and always a line for the merge.
- **Why a merge was withheld** - "the session never signalled ready-for-merge" or "the session's own TODO file still has open entries", the same words the CLI prints.
- **Why a handoff or the extra turn was skipped** - every reason as a sentence in the reader's terms.
- **Usage** - the spend in dollars over the turns, or the tokens when no price was reported, never a zero that reads as free.
- **The driver's own events** - the prompt, the text, the actions, the turn boundary, quota warnings only when the quota is tight, errors and notices.
- **The end** - "✓ finished", "■ stopped", or "✗ failed" with the detail.

## Business logic

### The agent's setup

#### Context

See `## Context`.

#### Business logic

The opening line names the driver [5] (or "fake" for a fake agent [1]), the model when one was chosen, the checkout, and the session link [6] when the driver reports one: "◆ <driver> (<model>) in <checkout> — <link>". A later session id is "session <id>", with the link when known. The system prompt is acknowledged by its size only: "system prompt sent (<n> chars)". The prompt the agent was given is "▶ "<prompt>"", flattened to one line and cut to 100 characters. Then, as they happen: "your app is running at <url>" for a preview, "◆ browser preview: http://127.0.0.1:<port>/stream" and "◆ browser: <url>" for a browser, "branch: <branch>", "implementing <ticket path>", "hand-off anchor: <the first seven characters of the cloud anchor [7]>", and "pull request: #<number>".

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

### The handoff, announced then reported

#### Context

**Problem**: the handoff [3] is two flags, push and pull request, plus a merge, but a reader takes the line in at a glance, so it is said as what will happen; and merging unattended is the one consequence a reader must not be left to infer.

#### Business logic

When the handoff [3] is armed, one line says what will happen: "when this ends: push the branch, open a PR, and merge it" when the merge is armed, since that pull request opens ready, not as a draft, and lands by itself; "when this ends: push the branch and open a draft PR" with a pull request but no merge; "when this ends: push the branch" with only a push; "when this ends: nothing — push and PR are both off" otherwise.

When the agent [1] ends, the handoff's outcome is one line: "✓ opened <pull request url>" or, with no pull request, "✓ branch pushed"; "~ handoff skipped: <reason>"; or "! could not open the PR: <error>" and "! could not push the branch: <error>". Unless the handoff failed, a second line always says what became of the merge: "✓ auto-merge armed: the PR lands when its checks pass" (GitHub's own auto-merge), "✓ merge on green: the daemon merges the PR when its checks pass" (the CI watch [13]), "✓ merged the PR", "~ merge withheld: <why>", or "! could not merge the PR: <error>".

### Why a merge was withheld

#### Context

**Problem**: the CLI prints its own line about a withheld merge; the two surfaces must say it in the same words.

#### Business logic

An armed merge is withheld for one of two reasons, said as: "the session never signalled ready-for-merge", or "the session's own TODO file still has open entries" (the rule behind the second is `todo-loop.ts`'s). The wording is shared with the CLI's own output line.

### Why a handoff or the extra turn was skipped

#### Context

See `## Context`.

#### Business logic

A skipped handoff [3] gives its reason as one of: "push and PR are both off for this session", "the branch no longer exists", "the session committed nothing", "this repo has no remote to push to", "the branch already has a pull request", "the branch's pull request already landed everything the session did", "the branch is already on the remote", "the run was stopped", "this was a fake run".

The extra turn [4] an agent [1] may get after ready for merge [9] (the rules are `on-before-mergeable-prompt.ts`'s) reports "✓ post-merge cleanup: quality follow-ups queued", "! post-merge cleanup: queueing did not complete cleanly", or "~ post-merge cleanup skipped: <reason>", the reason being one of: "the session never signalled ready-for-merge", "the run was stopped", "this was a fake run", "the session was never named", "the framework binary path is unknown".

### Usage

#### Context

**Problem**: a coding agent on a subscription reports no price, and a "$0.0000" would read as free.

#### Business logic

With a price, usage prints "spend: $<cost, four decimals> over <n> turn(s)". Without one it prints the tokens the agent [1] did report: "tokens: <input + cache-read + output tokens> (<output tokens> out) over <n> turn(s) — no price reported". The turn [4] count is singular or plural as it should be.

### The driver's own events

#### Context

**Business logic story**: the driver [5] streams the coding agent's own doings while a turn [4] runs; they are printed indented under the agent's [1] lines.

#### Business logic

A turn starts with "› prompt: <the prompt, flattened and cut to 140 characters>" and ends with "‹ turn complete". The coding agent's text prints flattened and cut to 100 characters, each action as "· <label>", an error as "! agent error: <message>", and a notice as "~ <message>". A session id the driver reports mid-stream prints as "session <id>" so a stray one reads as what it is. The quota [14] is quiet on the happy path: "✗ quota exhausted (<window>), resets <time>" when a request was rejected, "! quota running low (<window>), resets <time>" when the coding agent warns, and otherwise "· quota <status> (<window>), resets <time>", the time as an ISO timestamp.

### The end

#### Context

See `## Context`.

#### Business logic

The last line is "✓ finished" for an agent [1] that ended well, "■ stopped" for one that was stopped [15], and otherwise "✗ failed: <detail>", or "✗ failed: unknown error" when the end carried no detail.
