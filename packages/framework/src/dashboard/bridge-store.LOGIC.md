Keeps, in the daemon's memory, everything the Claude web bridge [1] reports and everything the dashboard queues for it: the question each cloud session [2] is parked on, the answer [3] picked in the dashboard and where its delivery stands, each session's transcript by position, what claude.ai's session list last said about each session, and the extension's last contact, version claim and page report. It is one store per daemon, written by the bridge's routes and read by the dashboard, and nothing in it survives a daemon restart, on purpose.

## Context

**User story**:
- A hands-off [4] agent's [5] cloud session [2] stops to ask. The question shows in the dashboard as the same card a local agent's gate [6] gets, the user makes a pick [7] there, the extension types the answer [3] into the session, and the dashboard shows the answer as sent, or as failed with the extension's reason so the user can pick again. Until the extension has collected the answer, the user can withdraw it.
- The dashboard lists a cloud session as waiting on the user — in the open questions [8] and on the Overview [9] — while it is parked on a question, or while claude.ai's own session list shows it "Awaiting input".
- In Settings, the bridge's panel shows when the extension last reached the daemon and how it went, which version it claimed and whether it was refused, and what the page script last reported about itself.

**Problem**: a cloud session has no live local agent to hang a gate on: a hands-off agent ends at its hand-off, so by the time its session asks anything the agent is already done, and the only join back to the agent is the cloud session id the agent recorded. The store is in memory on purpose: a question is only answerable while the session that asked it is still parked, and the extension re-reports it on reconnect, so surviving a daemon restart would preserve a question that may already have been answered elsewhere.

**Business logic story**: the bridge routes write into the store (`bridge-endpoints.ts`, wired in `server.ts`); the dashboard reads it for the open questions (`open-questions.ts`), the Overview (`overview.ts`), an agent's page and its gate controls (`../dashboard-rpc/`); the sessions holding a queued answer feed the list of sessions the Driver tab [10] serves (`bridge-sessions.ts`, `../daemon.ts`); and the web-start endpoints ask it whether an extension is around before queuing a session request [11] (`web-start-endpoints.ts`).

## Glossary

[1] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[2] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[3] answer: the text the daemon composes from a pick for the extension to type into the cloud session; it is queued in the dashboard until a Driver tab collects it, then marked sent or failed as the extension reports.
[4] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[7] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[8] open question: a gate nobody has answered yet, as the dashboard lists them across projects.
[9] the Overview: the dashboard's cross-project page at `/`.
[10] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[11] session request: the daemon's request that the extension create a cloud session on claude.ai for a hands-off agent: a repository, a branch, a prompt and optionally a model; queued on the daemon, claimed by the worker that reads it, and reported back as created or failed.
[12] list status: what claude.ai's own session list says a session is doing, as the Driver tab reads it off the status icon beside the session's row: `awaiting`, `unread`, `idle`, `running`, `landed`, `missing` or `unknown`.
[13] bridge browser: the Chrome for Testing the daemon runs for it.

## Business logic — TL;DR

- **The question a session is parked on** - one question per cloud session, the newest report replacing the older; a genuinely new question drops the old one's undelivered answer; a report of a question already answered is ignored; parked questions list newest first.
- **An answer is composed only from what the session offered** - the pick must name labels of the parked question, exactly one unless the question is multi-select, and the text typed is the same continuation a local gate re-prompts with, or a takeover when the pick stops the session.
- **Withdrawal until collected** - a queued answer can be withdrawn until a Driver tab has collected it or the extension has delivered it.
- **One Driver tab served at a time** - an answer is handed to the first Driver tab asking and to nobody else for 90 seconds; a claim nobody acknowledges expires and the answer is offered again.
- **The delivery's outcome** - only the acknowledgment naming the queued answer's own id counts; delivered means the question is resolved and dropped, failed keeps the question and the extension's note so the user can pick again.
- **Sessions with an answer waiting** - every session holding a queued answer is offered to the Driver tab whatever the session window says.
- **Waiting on a human** - a session is waiting while the store holds its parked question, or while its last list status is "awaiting" and no older than the cloud session window.
- **The transcript, by position** - one entry per position with a later read replacing an earlier one, at most 300 entries per session, read in order.
- **The extension's presence and diagnosis** - the last contact (refusals included), whether an extension is around (a contact let in within three minutes), the last version claim, the last page report, and the newest list status per session.
- **One store, in memory, and forgetting a session** - a single store per daemon shared by the bridge routes and the dashboard's reads; a session can be forgotten whole; a restart forgets everything.

## Business logic

### The question a session is parked on

#### Context

**Problem**: the extension reports the question on every change of the page, and the extension's worker forgets what it sent when it restarts while the answered question block stays in the page, so the same question keeps arriving after it was answered and after the session moved on.

#### Business logic

The store keeps one question per cloud session [2], keyed by the session id, and a report replaces the earlier question for that session. Two reports are the same question when the text shown is the same — title, options, recommended option and multi-select flag — regardless of when they arrived. A report identical to the question whose answer [3] was already delivered for that session is dropped, so an answered question does not resurface as parked. A report that differs from the question currently parked means the session moved on: the old question's undelivered answer is discarded, since typing it into the new question would answer a question nobody asked, and the memory of the old question's delivered answer is discarded too. Only a re-report of the question currently parked keeps its queued answer alive. The parked questions can be listed newest first, or read one session at a time.

### An answer is composed only from what the session offered

#### Context

**User story**: the user picks an option on the question's card, or several on a multi-select, and the cloud session [2] hears the answer [3] exactly as a local agent [5] would.

**Problem**: the text the store composes is what the extension types into a claude.ai composer, so the only text it can ever produce must be built from what the session itself offered.

#### Business logic

Queuing an answer [3] for a session:

- is refused when the store holds no parked question for that session, with "that session has no parked question";
- must name only labels of the parked question's options, each at most once, else "every label must be one of the question options";
- must name exactly one label unless the question is multi-select, else "pick exactly one option"; a multi-select takes any subset, including none.

The answer's text is worded as a local gate's [6] answer is (`../turn-gate.ts`): `You paused to ask: "<title>". The user chose: <labels, comma-separated>. Continue with that decision.`, with "(none)" for an empty multi-select. When any picked option is marked as stopping the session, the text is instead `You paused to ask: "<title>". The user chose: <labels>. Stop here: the user is taking over and will come back with fresh instructions.` — a local agent is simply ended on such a pick [7], but nothing of The Framework's can end a session on claude.ai, so the session is told the user is taking over. Every queued answer gets its own id and the time it was queued, and it replaces whatever answer the session had, a failed one included.

### Withdrawal until collected

#### Context

**User story**: the user picked the wrong option and takes it back before the extension has typed it.

#### Business logic

A queued answer [3] is withdrawn on request, and the request says whether it succeeded. It is too late once a Driver tab [10] has collected the answer within the last 90 seconds, or once the extension reported delivering it or failing to: only an answer still queued and held by nobody can be withdrawn.

### One Driver tab served at a time

#### Context

**Problem**: two Driver tabs [10] can serve one daemon — the user's own Chrome and the daemon's bridge browser [13] — and an answer [3] handed to both would be typed twice.

#### Business logic

The queued answer [3] for a session is handed to the first Driver tab [10] asking, and marked collected at that moment. Another Driver tab asking within 90 seconds gets nothing. A collected answer nobody acknowledged — the Driver tab died mid-delivery — is presumed lost once those 90 seconds pass, and is offered to the next Driver tab asking. The dashboard sees a collected answer as still queued, and cannot withdraw what a Driver tab is typing.

### The delivery's outcome

#### Context

See `## Context`.

#### Business logic

The extension's report on a delivery counts only when it names the id of the answer [3] currently queued for that session: a stale acknowledgment from a tab that died mid-delivery cannot resolve a newer answer, and a report on an answer already resolved changes nothing. A successful delivery marks the answer sent, drops the parked question, and remembers that question so a re-report of it is ignored. A failed delivery marks the answer failed with the extension's note, and keeps the question parked so the user can pick again; a new pick replaces the failed attempt. The dashboard can read a session's answer in whatever state it is.

### Sessions with an answer waiting

#### Context

**Problem**: the page reports whichever session the user happens to be on, so a pick [7] can be for a session no agent [5] of this daemon carries or one outside the window the Driver tab [10] watches, and an answer [3] nothing serves would sit queued forever.

#### Business logic

Every session holding a queued answer [3] is listed for the Driver tab [10] to serve, whatever the session window says; the list of sessions to serve appends them by the rule in `bridge-sessions.ts`.

### Waiting on a human

#### Context

**Problem**: a hands-off [4] agent's [5] own record reads done from its hand-off on, whether its cloud session [2] is parked on its user or finished hours ago; and a question the session asks in prose carries no question block for the bridge [1] to hold, so claude.ai's session list is the only thing that says the session stopped for its user.

#### Business logic

A session is waiting on a human when the store holds its parked question, or when its last list status [12] is `awaiting` and was recorded no more than 12 hours ago — the cloud session window shared with the cloud state rule in `../cloud-run-state.ts`. Past that window the Driver tab [10] no longer reads the session, so its last word cannot stand forever. The Overview [9] and an agent's page read this to show a web agent as waiting.

### The transcript, by position

#### Context

**User story**: a hands-off [4] agent's [5] page shows what its cloud session [2] said, as the page is read.

**Problem**: the page is re-read on every change, so the same message arrives repeatedly, and a message still being streamed arrives longer each time.

#### Business logic

Each session's transcript is kept by the position the extension assigned each message: a later read of the same position replaces the earlier one, and a repeat costs nothing. At most 300 entries are kept per session, the oldest positions dropped first, so a long session cannot grow without bound in a daemon that never restarts. The transcript is read in position order.

### The extension's presence and diagnosis

#### Context

**Problem**: an extension that is misconfigured looks exactly like one that is not installed, because both leave no question behind; a refused request at least proves something is trying.

#### Business logic

- The last contact is recorded with its time, its route and the status it was answered, refusals included.
- An extension counts as around when the last contact was let in (a status below 400) within the last three minutes: the extension's worker polls every half minute while it lives, so a longer silence means there is nobody to create a queued session request [11].
- The last version claim is recorded with the version got, the version expected, whether it was refused, and when; accepted claims are recorded too, which is what clears a blocked banner the moment an updated extension gets through.
- The page script's last report about itself is kept as reported.
- Each session's newest list status [12] replaces the older one.

### One store, in memory, and forgetting a session

#### Context

See `## Context`.

#### Business logic

There is one store per daemon, shared by the bridge [1] routes, which write from the raw HTTP handler, and the dashboard, which reads through its RPC surface. A session can be forgotten whole — its question, transcript, answer [3], the memory of its delivered answer and its list status [12] — once it is answered or its agent [5] is gone. Everything lives in memory and a daemon restart forgets all of it.
