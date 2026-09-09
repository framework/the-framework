Fixes the vocabulary of the driver [1] contract, in words: what every driver promises, how a driver session [2] is started, what one turn [3] returns, the progress events [4] a caller may show but must never decide on, and the three readings of spend that are easy to confuse: usage [5], rate limit [6] and quota [7]. It carries one rule of its own: which reasons for an empty quota reading are transient and which describe the setup.

## Context

**Business logic story**: The Framework never calls a model itself. It drives a coding agent [8] the user already pays for as a black box: a prompt goes in, the coding agent's own loop runs to completion, and a final message comes out. The seam is deliberately the prompt, the final message and the code left in the directory, never the coding agent's individual tool calls, so the coding agent keeps its own subscription-based login and its own loop, and a second coding agent slots in behind the same contract without touching anything above it. Everything above the driver, the agent [9] lifecycle included, speaks only this vocabulary.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.
[5] usage: what one turn spent, as the coding agent reports it: token counts, and a notional price in US dollars when the coding agent prices its turns.
[6] rate limit: the coding agent's per-turn reading of whether the account may still spend against one quota window, and when that window resets.
[7] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[8] coding agent: the CLI doing the actual work: Claude Code or Codex.
[9] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[10] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.
[11] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[12] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[13] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[14] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[15] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it.
[16] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[17] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).

## Business logic — TL;DR

- **What a driver promises** - a stable implementation id, a way to start a driver session [2] bound to a directory, and optionally a way to read the account's quota [7].
- **How a driver session is started** - with the directory the coding agent [8] reads and edits, the framing [10] every turn [3] carries, the model to pass through, a stop request [11] for the whole driver session, optionally the session id of an earlier driver session to continue, and a listener for progress events [4] that can never break the coding agent.
- **One turn, one final message** - a prompt goes in with optional extra framing, a stop request for this turn only and a best-effort request to continue the previous turn; the final message, the session id and the usage [5] come out.
- **Reading code and ending the driver session** - a driver [1] may let the caller read a file the coding agent produced; ending the driver session frees what it holds and may be repeated safely.
- **Progress events are shown, never decided on** - eight kinds of progress event, each with what it carries, none of which a caller may gate on.
- **Usage: what one turn spent** - token counts always, a price only when the coding agent prices its turns and never as zero.
- **Rate limit: the per-turn traffic light** - whether the account may still spend against one window and when it resets, with unknown statuses and windows passed through rather than dropped.
- **Quota: the share of each window used** - a reading is either available with its windows or unavailable with a reason, never an empty list that reads as nothing used.
- **Transient reasons and setup reasons** - a failed fetch, a timeout and an unrecognized answer describe one attempt; a missing coding agent and a login without a subscription describe the setup.
- **The implementation ids** - five ids, one per place a coding agent can run, wider than the user's two choices.

## Business logic

### What a driver promises

#### Context

See `## Context`.

#### Business logic

A driver [1] has a stable implementation id (see "The implementation ids") and can start a driver session [2] bound to a directory. It may also read where the account's quota [7] stands; that reading is account-wide and independent of any driver session, and an implementation that cannot report a quota omits the ability entirely rather than answering with a made-up number. Of the five implementations only `claude-code` reads a quota.

### How a driver session is started

#### Context

**User story**: the user starts an agent [9] from the dashboard. The whole agent is one driver session [2], and every prompt the agent receives, its opening task, each answer the user gives it and each live chat [12] message, is one turn [3] of that driver session.

#### Business logic

A driver session [2] is started with:

- The absolute path of the directory the coding agent [8] reads and edits. The product passes the agent's [9] checkout [13].
- Optional framing [10]: standing instructions that every turn [3] of the driver session carries. A role is framing, not a different kind of agent.
- An optional model id, passed through to the coding agent when it supports choosing one.
- An optional stop request [11] for the whole driver session: once raised, no further turn runs and a turn in flight ends.
- Optionally, the session id of an earlier driver session to continue. It seeds the driver session so that its very first turn, when asked to continue, resumes that earlier conversation with its full context instead of starting fresh. This is how a finished agent is revived from the dashboard. The contract is best effort: a driver [1] that cannot resume ignores it and runs fresh.
- An optional listener for progress events [4]. The listener is isolated: a listener that throws must never break the coding agent.

### One turn, one final message

#### Context

See `## Context`.

#### Business logic

A turn [3] sends one prompt to the coding agent [8], lets the coding agent's own loop run to completion, and answers with the coding agent's final message. Each turn is a fresh invocation of the coding agent unless a driver [1] documents otherwise. For one turn, the caller may add:

- Extra framing [10] for this turn only, appended after the driver session's [2] framing.
- A stop request [11] for this turn only.
- A request to continue the coding agent's previous turn instead of starting fresh, so that a live chat [12] message lands in the ongoing conversation with its full context. It is best effort: a driver that cannot resume, or has no previous turn yet, runs a fresh turn, which is the normal case. The Claude Code driver honors it (`claude-code.ts`).

A turn answers with the coding agent's final message as text, the coding agent's session id when it exposes one (the handle the dashboard links to and the driver later resumes), and the turn's usage [5] when the coding agent reports one. A driver's own id for the driver session is distinct from that session id.

### Reading code and ending the driver session

#### Context

**Business logic story**: the seam is the code, so a caller verifies a turn [3] by reading what the coding agent [8] left behind, not by watching how it got there.

#### Business logic

A driver [1] may let the caller read a file the coding agent [8] produced, by path relative to the driver session's [2] directory. It is optional: a driver whose directory this machine cannot read may omit it.

Ending a driver session frees whatever the driver holds for it, the coding agent's process included. Ending it twice is safe.

### Progress events are shown, never decided on

#### Context

**User story**: the user follows an agent [9] in the agent view as it works: what it says, which tools it uses, when a turn [3] settles, and anything the driver [1] had to work around. Every surface that shows an agent is built from these.

**Problem**: the seam is the code and the outcome. A caller that branched on which tool the coding agent [8] reached for would bind The Framework to one coding agent's internals.

#### Business logic

A driver [1] reports progress events [4] of eight kinds, for a caller to show but never to gate on:

- `start`: a prompt was sent and the coding agent's [8] loop is starting; carries the prompt.
- `session`: the coding agent announced its session id at the start of the turn [3]. The final result repeats it, but a turn that never settles, because the user stopped it, it failed, or its process died, would otherwise take the id down with it, and with it the handle to resume the driver session [2]. A caller records this one rather than showing it: the id is plumbing, not conversation.
- `text`: a chunk of the coding agent's own text.
- `action`: the coding agent used a tool; the tool's name only, never its arguments.
- `result`: the turn settled with this final text, plus the session id and the usage [5] when known. Two optional extras exist for drivers whose work leaves this machine: the session link, the real URL of the driver session, so a caller can link to a cloud session [14] instead of a generic entry point; and the cloud anchor [15], for a driver whose work lands on a branch of its own naming that this machine can only recognize later by ancestry. Drivers whose work stays on the designated branch omit both.
- `rate-limit`: a rate limit [6] reading.
- `error`: the coding agent, or the transport to it, failed; carries the message.
- `notice`: something the driver worked around that is worth telling the user, such as a driver session that could not be resumed.

### Usage: what one turn spent

#### Context

**User story**: the dashboard shows what an agent [9] cost in tokens and, when known, in money.

**Problem**: under a subscription the user pays a flat fee, so a price is notional: what the turn [3] would have cost on metered pricing. What a subscription actually spends is quota [7], which a spending gate reads instead.

#### Business logic

Usage [5] carries four token counts, always present: input tokens not served from the prompt cache, output tokens, tokens read from the prompt cache, and tokens written to it. It carries a price in US dollars only when the coding agent [8] prices its own turns [3]; a coding agent that reports tokens but no price reports the tokens and omits the price. The price is never reported as zero when unknown: zero reads as free, absent reads as unknown.

### Rate limit: the per-turn traffic light

#### Context

**Business logic story**: Claude Code emits one rate limit [6] reading per turn [3] on its streamed output, so the account's standing is free telemetry: no extra call, no polling.

#### Business logic

A rate limit [6] reading names a status (whether the account may still spend against the window: `allowed`, `allowed_warning` or `rejected`), the quota [7] window it reports on (`five_hour`, `seven_day`, `seven_day_opus`, `seven_day_sonnet`, `weekly`), and when that window resets, as epoch milliseconds (the coding agent [8] reports seconds; the driver [1] converts). Both the status and the window are left open rather than fixed to the known values: a status or window never seen before is exactly the signal worth capturing, so it must surface rather than be dropped. This is the account's limit, not the agent's [9] spend; usage [5] covers the latter.

### Quota: the share of each window used

#### Context

**User story**: the dashboard shows the account's quota [7] as bars, one per window, and work nobody asked for stands down past the quota boundary [16].

**Problem**: usage [5] is what one turn [3] spent and the rate limit [6] is a traffic light; neither says how much of a window is gone. The quota is the missing middle, the only one of the three that can fill a progress bar.

#### Business logic

A quota [7] reading is either available, with a list of windows, or unavailable, with a reason. It is never an empty list, so a caller cannot mistake "we could not ask" for "nothing is used". Each window carries:

- Its label exactly as the coding agent [8] phrased it, such as "Current session".
- Its kind, so callers gate without matching on prose: `session` (Claude's five-hour window), `week` (the quota week across all models), `week-model` (one model's own week) or `unknown`. There is deliberately no daily kind: Claude measures a session and a week, nothing per day.
- The percentage of the window used, 0 to 100.
- Optionally, when the window resets, as the coding agent worded it, such as "Jul 18 at 7am (Asia/Jerusalem)". It stays prose because the coding agent prints no year, so turning it into a timestamp would be guesswork; the rate limit [6] reading carries the exact reset time for the window it reports on.

### Transient reasons and setup reasons

#### Context

**Business logic story**: the daemon keeps a recent quota [7] reading on hand and re-reads it on a slow clock; the rules for keeping or dropping a retained reading live in `packages/framework/src/quota-poller.ts` and rest on this split.

#### Business logic

An unavailable quota [7] reading carries one of five reasons, split into two groups:

- Transient, describing this attempt: `fetch-failed` (the coding agent's [8] own usage fetch failed, for instance refused upstream, which comes with a penalty window), `timeout` (the coding agent did not answer in time) and `unrecognized` (the coding agent answered, but not in a shape the driver [1] recognizes: a reworded readout, an update notice printed ahead of the answer, or empty output while the coding agent updates itself under a long-lived process). A recent reading is still worth showing, and asking again may work.
- Describing the setup: `agent-not-found` (the coding agent is not installed or not on `PATH`) and `no-subscription` (the login has no subscription quota to report, as with an API key). These are statements about the account or the install, so a retained reading must not outlive them.

### The implementation ids

#### Context

**Business logic story**: the user's driver [1] choice is `claude` or `codex`; where the agent [9] runs is its location [17]. Which implementation carried an agent is recorded on the agent, and the product maps it back to the choice in `packages/framework/src/driver-names.ts`.

#### Business logic

An implementation id is one of `claude-code` (Claude Code on this machine), `claude-web` (Claude Code in a cloud session [14]), `github-actions` (Claude Code on a GitHub Actions runner), `codex` (Codex on this machine) and `fake` (the scripted driver [1] for tests and offline demos). One driver choice has an implementation per place it can run, which is why the id is wider than the choice.
