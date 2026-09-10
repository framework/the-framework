Decides which cloud sessions [1] the Claude web bridge's [2] Driver tab [3] should serve: every `web` agent's [4] session started within the last 12 hours, newest first and all of them, plus every session the dashboard holds a pick [5] for, whatever its age.

## Context

**User story**: the user starts an agent [4] whose location [6] is `web` and does not watch claude.ai; the extension's Driver tab visits the sessions the daemon names, so a question the session parks on shows up in the dashboard, and the pick [5] the user makes there is typed back.

**Business logic story**: the daemon answers the extension's request for the sessions to serve with this rule, over the agents of every registered project (`../daemon.ts`); the bridge store (`bridge-store.ts`) says which sessions hold a queued pick; the daemon's bridge endpoints carry the list to the extension (`bridge-endpoints.ts`).

## Glossary

[1] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[2] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[3] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[6] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[7] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.

## Business logic — TL;DR

- **Only web agents that reached a session** - an agent is a candidate when its location is `web` and it recorded a cloud session id; nothing else is.
- **Recency is the filter, not status** - a session counts for 12 hours after its agent started; a web agent's status says nothing, since every one of them reads done once its task is handed off.
- **Newest first, all of them, once** - the recent sessions are ordered by their agent's start, without a cap, and a session two agents share appears once.
- **A queued pick forces a visit** - a session with a pick waiting is flagged, and is served even outside the window or with no agent at all.

## Business logic

### Only web agents that reached a session

#### Context

See `## Context`.

#### Business logic

An agent [4] is a candidate only when its location [6] is `web` and its record carries a cloud session [1] id: a hands-off [7] agent whose task never reached a session has nothing to visit, and a `local` or `actions` agent has no session on claude.ai at all. Each candidate's session is offered with its URL, `https://claude.ai/code/<session id>`.

### Recency is the filter, not status

#### Context

**Problem**: a web agent ends as soon as its task is handed to the cloud session, so its status reads done whether the session is parked on a question or finished an hour ago. Filtering on status would offer nothing; the read-back that tells those apart is the list status the Driver tab [3] reports, kept in the bridge store rather than on the agent's record.

#### Business logic

A session counts while its agent [4] started within the last 12 hours — the same window after which a cloud session [1] is assumed finished, shared with the cloud state rule in `../cloud-run-state.ts`. An agent whose start time cannot be read is skipped rather than treated as having started now.

### Newest first, all of them, once

#### Context

**Problem**: one Driver tab [3] serves the whole list by reading claude.ai's own session list and visiting only the sessions that need it, so a long list costs a sidebar read rather than a tab each; no cap is needed on how many sessions are offered.

#### Business logic

The recent sessions are ordered by their agent's [4] start, newest first, with no cap. A session listed by two agents (an agent continued after its first leg) is offered once.

### A queued pick forces a visit

#### Context

**Problem**: a pick [5] is made on a question the page reported, and the page reports whichever session the user happens to be on — outside the window, or one no agent [4] of this daemon carries. A pick nothing serves would sit queued forever.

#### Business logic

Every session the dashboard holds a queued pick [5] for is flagged as having an answer queued, which the Driver tab [3] treats as a visit to make whatever the session list says. Such a session that is outside the window, or that no agent's record carries, is appended after the recent ones, flagged the same way.
