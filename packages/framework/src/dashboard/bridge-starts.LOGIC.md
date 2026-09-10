Keeps the daemon's queue of session requests [1]: the cloud sessions [2] the daemon wants the Chrome extension to create on claude.ai for hands-off [3] agents [4]. An agent's process queues a request and polls it until it exists; the extension claims the oldest request nobody holds, creates the session and reports what it became; and a request leaves the queue in the very step that serves it, coming back only when nobody reports on it within 90 seconds, so two polling tabs never create two cloud sessions and a browser that quits mid-creation makes the agent retry instead of stranding it.

## Context

**User story**: the user starts an agent [4] whose location is `web`. Within about a minute a cloud session [2] exists on claude.ai, opened on the agent's own branch, and the dashboard shows the session link; if no extension is around, the agent fails at once with the cure rather than after a timeout.

**Problem**: a session created through claude.ai's own repository picker is bound to the repository and can push and open pull requests, which is what handing a task to the cloud is for; nothing but a browser on claude.ai can create one. The agent's process is a separate process the daemon spawned, so the agent's request and the extension's claim must meet in one queue inside the daemon.

**Business logic story**: the `claude-web` driver [5] pushes the agent's cloud anchor [6] to the remote as a branch named by the agent id [7], then queues the request through the daemon's agent-facing routes and polls it (`web-start-endpoints.ts`, `../driver/cloud.ts`); the extension's worker claims requests and reports on them through the bridge [8] routes (`bridge-endpoints.ts`); the daemon wires both sides to this one queue (`server.ts`).

## Glossary

[1] session request: the daemon's request that the extension create a cloud session on claude.ai for a hands-off agent: a repository, a branch, a prompt and optionally a model; queued on the daemon, claimed by the worker that reads it, and reported back as created or failed.
[2] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[3] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[6] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's (cloud work adoption).
[7] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[8] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[9] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.

## Business logic — TL;DR

- **What a request must carry** - a repository as `owner/name`, a git branch name, a non-empty prompt of at most 200,000 characters and optionally a model of at most 100 characters; anything else is refused with the reason, and an accepted request gets its own id and is queued.
- **The oldest unheld request is claimed by the read that returns it** - the extension is handed the oldest request nobody holds, marked claimed at that moment; a claim older than 90 seconds counts as unheld again.
- **The extension's report on a claimed request** - only a claimed request takes a report; success must name the created session, else it is a failure; a created request carries the session id and its link, a failed one the extension's note.
- **How a created session reaches its agent** - the agent's process holds the request's id, polls it every two seconds until it is created or failed, and records the session id and link on the agent, which is the join every later surface uses.
- **One queue per daemon, in memory** - a single queue shared by the agent-facing routes and the bridge routes, readable by id or as a list newest first, with requests forgotten on demand and everything lost on restart.

## Business logic

### What a request must carry

#### Context

See `## Context`.

#### Business logic

A session request [1] is accepted only when:

- its repository is `owner/name` as claude.ai's repository picker lists it — two segments of letters, digits, dots, underscores and hyphens, neither made of dots only — else "repo must look like owner/name";
- its branch is a git branch name of 1 to 255 characters made of letters, digits, dots, underscores, hyphens and slashes — else "branch must be a git branch name";
- its prompt is not blank and at most 200,000 characters, long because the opening prompt of a cloud session carries the agent's [4] whole framing (the system prompt, the formats, the protocols) — else "prompt must not be empty" or "prompt must be at most 200000 characters";
- its model, when given, is at most 100 characters — a short name or id the extension matches against claude.ai's model menu — else "model must be at most 100 characters"; a blank model is dropped and leaves claude.ai's own default.

Surrounding whitespace is trimmed from every field. An accepted request gets its own id, the time it was queued, and the state "queued".

### The oldest unheld request is claimed by the read that returns it

#### Context

**Problem**: two Driver tabs [9] polling the daemon — the user's own Chrome and the daemon's own bridge browser — handed the same request would create two cloud sessions [2] on the user's account. And a browser that quits mid-creation must make the agent [4] retry, not strand it.

#### Business logic

When the extension asks for the next request, it is handed the oldest request in queue order that nobody holds, and that request is marked claimed at that moment, in the same step. A request is held while its claim is younger than 90 seconds: once a claim is that old without a report, the request counts as unheld and is offered again to the next asker. With nothing unheld, the extension is handed nothing.

### The extension's report on a claimed request

#### Context

See `## Context`.

#### Business logic

A report is taken only for a request currently claimed; a report on a request nobody holds — a tab that died after its claim expired and reports late — is ignored, so it cannot overwrite the retry that replaced it. A report of success that names no session id is recorded as a failure, with the note "reported success without a session id" unless the extension gave its own: an agent [4] pointing nowhere is not a usable outcome. Otherwise a successful report marks the request created, with the cloud session's [2] id and its link `https://claude.ai/code/<session id>`; a failed report marks it failed, with the extension's note when it gave one.

### How a created session reaches its agent

#### Context

**User story**: the agent view of a hands-off [3] agent [4] shows "Handed off to Claude Code on the web." with the session link, and later shows the question that session is parked on.

#### Business logic

The agent's process keeps the id it was given when it queued the request, and asks the daemon where that request stands every two seconds (`web-start-endpoints.ts`, `../driver/cloud.ts`). A request that reads created, with a session id and link, ends the wait: the driver [5] reports the session id and link as the agent's, and the agent records them. That recorded session id is the join every later surface uses — it is how the question a cloud session [2] is parked on, reported by the bridge [8], is shown on that agent's page, and how the agent's session is offered to the Driver tab [9] (`bridge-sessions.ts`). A request that reads failed ends the agent with the extension's note; a request that vanished, or a wait the user stopped, ends it too. The branch the session opens on is the agent's cloud anchor [6] ref, named by the agent id [7], which the driver pushed before queuing.

### One queue per daemon, in memory

#### Context

See `## Context`.

#### Business logic

There is one queue per daemon, and the agent's [4] request and the extension's claim must meet in it. A request can be read by its id, the requests can be listed newest first, and a request can be forgotten by id. The queue lives in memory: a daemon restart loses every request, and an agent still polling one is told it is gone.
