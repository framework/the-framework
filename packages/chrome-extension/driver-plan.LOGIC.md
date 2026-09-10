Decides which cloud sessions [1] the Driver tab [2] visits in a cycle [3], from what claude.ai's session list said about each one (its list status [4]), what the worker [5] remembers from earlier cycles, and which sessions have an answer [6] queued. The visits keep the list's order.

## Context

**Problem**: claude.ai's list statuses are sticky: an in-app visit clears neither "Awaiting input" nor "Unread response", so visiting every stopped session on every cycle [3] would be fifty visits every half minute for fifty agents [7]. And a session that asks its question in prose carries no question block [8] for the page to report, so the list's "Awaiting input" is the only signal that it stopped for its user, and only a fresh read of the session catches what it asked.

## Glossary

[1] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[2] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[3] cycle: one pass of the worker's loop, twice a minute: list the sessions to serve, read their list statuses, visit what is due, account for every answer and session request.
[4] list status: what claude.ai's own session list says a session is doing, as the Driver tab reads it off the status icon beside the session's row: `awaiting`, `unread`, `idle`, `running`, `landed`, `missing` or `unknown`.
[5] worker: the extension's background service worker: the half of the extension that holds the bridge token and talks to the daemon; Chrome runs it without any page and ends it when idle.
[6] answer: the text the daemon composes from a pick for the extension to type into the cloud session; it is queued in the dashboard until a Driver tab collects it, then marked sent or failed as the extension reports.
[7] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[8] question block: the JSON object with a `title` and `options` that an agent writes into its final message when it stops at a gate; claude.ai renders it as a code block in the session's transcript.

## Business logic — TL;DR

- **Visited on a change** - a session whose list status is `awaiting`, `unread` or `idle` is visited when that status differs from the one last read, or when the session was never read before.
- **An awaiting session is revisited on age** - a session the list keeps calling `awaiting` is visited again once five minutes have passed since its last visit; `unread` and `idle` sessions are not.
- **An answer always earns a visit** - a session with an answer queued is visited whatever the list says, and the answer travels with the visit.
- **Nothing else is visited** - `running`, `landed`, `missing` and `unknown` sessions are never visited on their own, and the visits come out in the list's order.

## Business logic

### Visited on a change

#### Context

See `## Context`.

#### Business logic

For each session the list reported, the planner compares its list status [4] with the status the worker [5] remembered from the last read. A session whose status is now `awaiting` (stopped for its user), `unread` (finished a turn nobody read) or `idle` (went quiet) is due when that status changed since the last read; a session never read before counts as changed. A change to any other status is not a reason to visit.

### An awaiting session is revisited on age

#### Context

**Problem**: a question asked in prose carries no question block [8], so the list's word is the only signal and a fresh read of the session is what catches it; but a session that turned `unread` was already visited once when it did, and reading it again every few minutes would mirror nothing new.

#### Business logic

A session whose list status [4] is `awaiting` is also due when five minutes or more have passed since the worker [5] last visited it, or when it was never visited. No other status is revisited on age: an `unread` or `idle` session that has not changed is left alone however long it stays so.

### An answer always earns a visit

#### Context

**Business logic story**: an answer [6] queued in the dashboard is the one thing the session list cannot know.

#### Business logic

A session with an answer [6] queued is due whatever its list status [4], even `running`, `landed` or `missing`, and the answer is attached to its visit so the Driver tab [2] types it on arrival.

### Nothing else is visited

#### Context

See `## Context`.

#### Business logic

A `running`, `landed`, `missing` or `unknown` session is never visited unless an answer [6] is queued for it. The visits are listed in the order the session list gave them; the worker [5] decides how many of them one cycle [3] can take (`background.js`).
