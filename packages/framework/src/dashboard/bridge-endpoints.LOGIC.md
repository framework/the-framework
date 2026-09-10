Serves the daemon's side of the Claude web bridge [1]: the routes under `/_bridge` that the Chrome extension calls to report the question a cloud session [2] is parked on, the session's transcript, what claude.ai's session list says about each session and what the injected page script is doing, and to fetch which cloud sessions to serve, the answer [3] queued for one of them, and the next cloud session the daemon wants created. Every route sits behind the bridge token [4] and an exact extension version, accepts one small and fully validated shape, and answers no CORS headers.

## Context

**User story**:
- The user turns the bridge on in Settings and pastes its token into the extension's options page; "Save and test" there tells the user which of the two failure modes they have, the bridge off or a wrong token. From then on, a hands-off [5] agent's [6] question shows up in the dashboard within about a minute, the pick [7] the user makes there is typed into the cloud session [2], and a hands-off agent's cloud session gets created on claude.ai without the user opening it.
- A user running a stale copy of the extension is told so outright, with the steps to update it, instead of watching the bridge half-work.

**Problem**: this is the first route of the daemon meant to be reached from another origin, so neither of the daemon's other guards protects it — the same-origin check keeps a page on another origin out of the RPC surface, and the shared token exists only on a non-loopback bind (`server.ts`). And the daemon spawns processes, so whatever these routes accept must be worth nothing to an attacker holding the token: the worst a stolen token buys is a bogus question card in someone's dashboard.

**Business logic story**: the daemon's HTTP server dispatches `/_bridge/*` to these routes ahead of its shared-token guard and wires them, only when the bridge is on, to the bridge store that keeps questions, transcripts, statuses and answers (`bridge-store.ts`), to the queue of cloud sessions to create (`bridge-starts.ts`) and to the list of cloud sessions worth serving (`bridge-sessions.ts`); the caller is the extension's worker (`packages/chrome-extension/background.js`), which runs a cycle twice a minute.

## Glossary

[1] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[2] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[3] answer: the text the daemon composes from a pick for the extension to type into the cloud session; it is queued in the dashboard until a Driver tab collects it, then marked sent or failed as the extension reports.
[4] bridge token: the secret the extension presents.
[5] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[7] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[8] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[9] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[10] list status: what claude.ai's own session list says a session is doing, as the Driver tab reads it off the status icon beside the session's row: `awaiting`, `unread`, `idle`, `running`, `landed`, `missing` or `unknown`.
[11] session request: the daemon's request that the extension create a cloud session on claude.ai for a hands-off agent: a repository, a branch, a prompt and optionally a model; queued on the daemon, claimed by the worker that reads it, and reported back as created or failed.

## Business logic — TL;DR

- **Off unless the bridge is on, and every contact recorded** - with the bridge off every route is 404 "bridge not enabled"; with it on, every request's route and outcome is recorded, refusals included.
- **The bridge token on every route** - each request must present the bridge token as a bearer token, compared in constant time, before anything is read; anything else is 401.
- **No CORS headers, by design** - the daemon never allows a cross-origin page in, so the extension must call from its worker, never from a page.
- **The version gate** - the extension states its version on every call and the daemon refuses any version but `0.12.0` with 426 and the update steps, ping included, so a stale extension never half-works.
- **What the bridge accepts is deliberately tiny** - one shape per route, every field checked with a reason, unknown fields dropped, capped bodies, session ids of one exact form, and a batch refused whole on one bad entry.
- **The ping** - a bare 200 "ok" once past the token and the version, which is what the options page's test needs.
- **The question the session is parked on** - a title and one to twenty distinctly labeled options, optionally a detail, a pre-checked default and a stop flag per option, a recommendation that must name an option, and multi-select; timestamped by the daemon and recorded.
- **The transcript, by position** - batches of up to fifty entries, each an agent or user message at an integer position, refused whole on a bad entry so the sequence never has silent gaps.
- **The page's hello and the list statuses** - the injected script's version, session and note are recorded for diagnosis; what the session list says about up to five hundred sessions is recorded per session, stamped with the daemon's time.
- **The sessions to serve** - the cloud sessions the Driver tab should serve, newest first, each flagged when an answer waits; an empty list, never a fault, when the daemon has none.
- **Collecting an answer and reporting its delivery** - the answer for a session is claimed by the read that returns it, always as a 200 with null when there is none; the extension then reports whether it typed it, with a note.
- **Claiming a session to create and reporting the creation** - the next session request is taken off the queue by the read that returns it, so two polling tabs never create two cloud sessions; the extension reports the created session's id, or a failure with a note.

## Business logic

### Off unless the bridge is on, and every contact recorded

#### Context

**User story**: the bridge is off by default; turning it on in Settings is an explicit choice, because it opens the daemon's one route reachable from another origin.

#### Business logic

When the daemon has no bridge token [4] configured — the bridge [1] switched off — every path under `/_bridge` is answered 404 "bridge not enabled", whatever it is. When the bridge is on, every request is recorded by its route and the status it was answered with, including refusals, so the dashboard can say whether the extension has reached the daemon at all and how (`bridge-store.ts`). A path under `/_bridge` that names no route is answered 404 "not found".

### The bridge token on every route

#### Context

See `## Context`.

#### Business logic

Every request, on every route, must carry the bridge token [4] as `Authorization: Bearer <token>`; anything else is answered 401 "unauthorized". The check happens before the body is read, so an unauthenticated caller cannot make the daemon buffer anything. The comparison is constant-time, and a presented value of a different length never matches, without leaking that the length differed.

### No CORS headers, by design

#### Context

**Problem**: a page's own request carries the page's origin, and the browser lets it through only when the daemon answers a header allowing that origin; a wildcard allowance would let any page the user visits post to their daemon.

#### Business logic

The bridge [1] answers no CORS headers on any route. An extension worker holding host permissions for the daemon's address is not subject to CORS and fetches without a preflight, so the extension has to call the bridge from its worker rather than from the script it injects into claude.ai pages, and the token never lives in a page.

### The version gate

#### Context

**Problem**: a version-skewed extension does not fail loudly; it half-works — missed messages, silently ignored fields — which reads as a bug in The Framework and burns a debugging session.

#### Business logic

The extension states its own version on every call, in the `x-tf-extension-version` header. The daemon expects exactly `0.12.0`, the number the extension's manifest must carry; a test keeps the two in lockstep. Any other value, a missing header included (read as "unknown"), is refused with 426 and the message "extension v<got> does not match the v0.12.0 this daemon expects: update the extension (pull the repo, then reload it at chrome://extensions) and retry". The gate applies to every route past the token, the ping included, so there is no degraded mode: the only way forward from a stale extension is updating it. It sits behind the token, so an unauthenticated caller learns nothing about versions. The version the caller claimed, and whether it was turned away, is recorded for the dashboard (`bridge-store.ts`).

### What the bridge accepts is deliberately tiny

#### Context

See `## Context`.

#### Business logic

- Each route accepts one shape and nothing else. Every field is checked, and a rejection says why, as a 400 with the reason. Fields the daemon does not know are dropped rather than refused, so a newer extension posting an extra field still works against an older daemon.
- A cloud session [2] is always addressed by an id of the form `session_<id>`, where the id is one to 128 letters or digits; anything else is refused with "sessionId must look like session_<id>", the same message on every route, so a caller cannot learn a different thing from each.
- A route that takes a body accepts only a POST (405 otherwise) and only JSON: a body over the cap is refused with "body too large" without being buffered, and an unparseable one with "body must be JSON". The cap is 64 KB, except 512 KB for the transcript route. A route that is read accepts only a GET (405 otherwise).
- Nothing the extension posts carries a path, a command, a prompt or free text the daemon acts on; the only free text is what the session said, recorded to be shown. Free text travels the other way only, in a session request [11], which the daemon writes and the extension reads.
- A batch is validated entry by entry and refused whole on the first bad entry, never partially accepted.
- Every recorded time is the daemon's own clock, never one the caller supplies.

### The ping

#### Context

**User story**: on the extension's options page, "Save and test" pings the daemon and tells the user whether the bridge is off or the token is wrong.

#### Business logic

A GET of `/_bridge/ping` that passed the token and the version gates is answered 200 with the body "ok". The body is what proves the bridge [1] is there: a dashboard too old to have a bridge route serves its app shell with a 200 for any path it does not know, so only the word "ok" tells "the bridge is here" from "this dashboard has none". A bridge that is off answers the ping 404 and a wrong token 401, which is how the options page tells the two apart; a stale extension gets the 426 like every other route. The ping is guarded like everything else: reachability is not public.

### The question the session is parked on

#### Context

**User story**: a hands-off [5] agent's [6] cloud session [2] stops at a gate [9]; the extension reads the question off the page and reports it, and the dashboard shows it as the same card a local agent's question gets.

#### Business logic

A POST to `/_bridge/question` names the cloud session [2] and carries:

- a title of 1 to 500 characters, not blank;
- 1 to 20 options, each with a label of 1 to 300 characters, not blank, and labels distinct across the options; optionally a detail of at most 500 characters, whether the option starts checked (a boolean), and whether picking it hands the session back to the user (a `stop` boolean); a blank detail and a false flag are dropped;
- optionally whether several options may be picked (a boolean);
- optionally a recommended option, of at most 300 characters, which must be the label of one of the options: a recommendation naming no option would render a default the user cannot see.

The question is stamped with the moment the daemon accepted it and recorded (`bridge-store.ts`); the reply is 204. The extension reports the same question again on every change of the page, and the store keeps one per session; what the recorded question looks like is fixed in `bridge-question.ts`.

### The transcript, by position

#### Context

**User story**: the agent view of a hands-off [5] agent [6] shows what its cloud session [2] said, mirrored from the page.

**Problem**: the page is re-read on every change, so the same message arrives many times; and a batch accepted in part would leave gaps in the sequence that a reader cannot tell from a message that has not arrived yet.

#### Business logic

A POST to `/_bridge/events` names the cloud session [2] and carries 1 to 50 entries, each with the message's position in the transcript (an integer from 0 to 10,000), a role of `agent` or `user`, and non-blank text, kept up to 8,000 characters. The position is what makes a report idempotent: the daemon keeps one copy per position rather than a growing pile of repeats (`bridge-store.ts`). One bad entry refuses the whole batch. A wrong method is refused as such (405) even on a daemon that records no transcript, and a daemon that records none answers 404 "events not enabled"; the daemon always records it (`server.ts`). Each entry is stamped with the daemon's time, and the reply is 204.

### The page's hello and the list statuses

#### Context

**Problem**: diagnosing the bridge [1] without this needs a screenshot of a panel, a round trip through a person for every wrong guess; when the page script says for itself which version is injected and what its last read found, the daemon can be asked instead. And a hands-off [5] agent's own record cannot say what its cloud session [2] is doing, because the agent ends as soon as its task leaves this machine; what claude.ai's session list shows is the only read-back.

#### Business logic

- A POST to `/_bridge/hello` records what the injected page script reports about itself: its version (up to 32 characters, "unknown" when absent), the cloud session [2] it is on when the id has the right form, a note of up to 300 characters, and the daemon's time; anything else in the body is ignored, and the reply is 204.
- A POST to `/_bridge/statuses` carries 1 to 500 entries, each naming a cloud session and its list status [10] — one of `awaiting`, `unread`, `idle`, `running`, `landed`, `missing`, `unknown` — with an optional label kept up to 80 characters, which is how an `unknown` status is named rather than guessed at; a blank label is dropped. One bad entry refuses the batch. Each status is stamped with the daemon's time and recorded per session (`bridge-store.ts`); the reply is 204.

### The sessions to serve

#### Context

**Problem**: the extension cannot know an agent [6] started; it only sees pages the user is already on. Without the daemon naming its cloud sessions [2], the bridge [1] works only while somebody happens to be looking at claude.ai.

#### Business logic

A GET of `/_bridge/sessions` answers the cloud sessions [2] the Driver tab [8] should be serving, newest first, each with its id, its URL, and whether an answer [3] is queued for it — a session with an answer waiting is visited whatever the session list says. Which sessions those are is the rule in `bridge-sessions.ts`, supplied by the daemon. A daemon with no such list, or one whose list fails, answers an empty list rather than an error, so an extension polling it degrades to doing nothing instead of reporting a fault.

### Collecting an answer and reporting its delivery

#### Context

**User story**: the user answers a cloud session's [2] question in the dashboard; within a cycle the Driver tab [8] types the answer [3] into the session and the dashboard shows it as sent, or as failed with the extension's note.

**Problem**: two Driver tabs asking for the same answer must not both type it.

#### Business logic

- A GET of `/_bridge/answer?sessionId=<id>` always answers 200 with the answer [3] queued for that cloud session [2] — its id and the exact text to type, composed by the daemon from the labels the session itself offered (`bridge-store.ts`) — or null when there is nothing to deliver, so the extension can poll it blindly; null too on a daemon that wired no answers. The answer is claimed by the read that returns it, so a second reader gets nothing.
- A POST to `/_bridge/answered` reports the delivery: the cloud session, the answer's id (up to 64 characters), whether it was typed (a boolean), and optionally a note of up to 300 characters. The outcome is recorded against the queued answer (`bridge-store.ts`); the reply is 204.

### Claiming a session to create and reporting the creation

#### Context

**User story**: the user starts a hands-off [5] agent [6]; within about a minute the extension has created its cloud session [2] on claude.ai and the dashboard shows the session link.

**Problem**: handing the same session request [11] to two polling tabs would create two cloud sessions on the user's account, so taking a request off the queue has to happen in the same step as reading it — a read that mutates, on purpose.

#### Business logic

- A GET of `/_bridge/start` always answers 200 with the next session request [11] — its id, the repository as `owner/name` as claude.ai's repository picker lists it, the branch, the prompt, and the model to pick in claude.ai's model menu when the agent [6] named one — or null when there is nothing to do or the daemon wired no queue. The request is claimed for the caller inside the read, by the queue's own rule (`bridge-starts.ts`).
- A POST to `/_bridge/started` reports the creation: the request's id (up to 64 characters), whether it succeeded (a boolean), the created cloud session's [2] id when it did, and optionally a note of up to 1,500 characters — a failure's note is the only diagnosis the agent gets, so it may carry what the page's controls looked like. The outcome resolves the request (`bridge-starts.ts`); the reply is 204.
