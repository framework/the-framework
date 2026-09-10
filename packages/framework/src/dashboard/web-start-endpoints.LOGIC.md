The agent-facing side of the cloud session [1] start queue: how a web agent's [2] own process asks the daemon for a cloud session that the Chrome extension of the Claude web bridge [3] creates on claude.ai, and learns what became of the request. The agent is a separate process the daemon spawned, so it cannot touch the daemon's queue directly: it reaches these routes at the daemon URL the daemon put in its environment as `TF_DAEMON_URL`, presenting the bridge token it reads from the registry. The extension's own side of the same queue is the bridge's start routes (`bridge-starts.ts`, `bridge-endpoints.ts`).

## Context

**User story**: the user starts an agent [2] with location `web`. Its process needs a cloud session [1] opened on claude.ai for the repository, the branch and the prompt, which only the extension in the user's browser can do; the process queues the request here, then reads back the session it became and its URL.

**Problem**: a request nobody will ever drain must be refused at once rather than time out, so the agent's process learns immediately that no extension is around and can fall back another way.

## Glossary

[1] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control. A web agent is one whose location is `web`: its turns run in a Claude Code cloud session.
[3] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents.

## Business logic — TL;DR

- **Only with the bridge on, and only with its token** - every route is 404 while no bridge token is configured and 401 without that token as a bearer token.
- **Queuing a start request** - a repository, a branch, a prompt and optionally a model are queued for the extension, answered 202 with the request's id, or refused at once when no extension has spoken recently.
- **Where a request stands** - a request's state, with the cloud session's id and URL and a note once there are any, read by the request's id.

## Business logic

### Only with the bridge on, and only with its token

#### Context

See `## Context`.

#### Business logic

When the daemon configured no bridge [3], every route under `/_web-start` is 404 "bridge not enabled". Otherwise the caller must present the bridge token as a bearer token, the same token the extension holds; without it the answer is 401 "unauthorized". A path under the prefix that is neither the queue itself nor a well-formed request id is 404 "not found".

### Queuing a start request

#### Context

See `## Context`.

#### Business logic

Only a POST to `/_web-start` queues a request; another method is 405 "method not allowed". When no extension has spoken to this daemon recently enough to be trusted with a request, the answer is 409 "no browser extension has spoken to this daemon recently", given at once so the caller has its answer without waiting for a timeout. The body is JSON of at most 512 KB and must be an object carrying `repo`, `branch` and `prompt` as strings, and `model` as a string when present; anything else is 400 with the reason ("body must be an object", "repo, branch and prompt must be strings", "model must be a string"). The queue itself may refuse the request with a reason, which is answered as 400 with that reason (the rules are in `bridge-starts.ts`). A queued request is answered 202 with its id.

### Where a request stands

#### Context

**User story**: the agent's [2] process polls until the extension has created the cloud session [1], then records the session's id and opens nothing itself.

#### Business logic

A GET to `/_web-start/<id>`, where the id is 1 to 64 letters, digits or hyphens, answers the request's state, together with the cloud session's id, its URL and a note whenever the request carries them. An id the queue does not know is 404 "no such start request". Any other method is refused.
