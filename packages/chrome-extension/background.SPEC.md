The half of the Claude web bridge that talks to the daemon: it holds the daemon token, reports the question a cloud session is parked on to `POST /_bridge/question`, and runs the Driver tab — one pinned background tab it cycles through every cloud session the daemon lists, reading claude.ai's own session list, visiting the sessions that need it, typing the answers the dashboard queued, and creating the sessions the daemon asks for.

## User story

A `web`-target agent hands its task to a cloud session and ends; nothing streams back. When that session later parks on a question, the question is stranded on claude.ai. The user wants it to appear in their local dashboard, wants to answer it there, and wants that to keep working — for one session or fifty — while they are not looking at claude.ai at all.

## Glossary

- **service worker** — the extension's own background half, with no page attached. It is the only part that holds the daemon token and the only part allowed to call the daemon.
- **content script** — the extension's other half, injected into the claude.ai page. It reads the page and types into it, and it never sees the token.
- **Driver tab** — the one pinned, inactive claude.ai tab this half opens and drives; its content script does the reading and typing on this half's instructions.
- **cycle** — one round of the Driver: list the daemon's sessions, read their statuses off claude.ai's session list, visit the ones that need it, report back.

## Business logic — TL;DR

- **The token never enters the page** - every daemon call is made by the service worker; the content script only passes it what it scraped and receives back only what to do.
- **What comes back is text, not an option** - the daemon composes what is typed into the session out of the option the user picked; the worker relays it without composing or editing anything.
- **Every call states the extension's version** - each daemon request carries `x-tf-extension-version`, and a daemon expecting another version refuses it outright rather than half-working.
- **A repeat of the same question costs nothing** - a question identical to the last one accepted for that cloud session is dropped without a call; a failed report is never remembered, so the next page change retries.
- **One Driver tab, one cycle twice a minute** - the daemon's session list, claude.ai's status for each, the visits the planner picks — answers first, at most four a cycle — the answers typed, the session created — all through one pinned tab, whose page is reloaded at most once a minute so its list is fresh.
- **The list statuses are reported back** - what claude.ai's list said about each of the daemon's sessions goes to `POST /_bridge/statuses`, the read-back the daemon otherwise lacks.
- **The answer is typed before it is acknowledged** - it is handed to the Driver first and only reported as delivered afterwards, so the dashboard never shows a session as answered when nothing was typed; every answer handed over is accounted for, delivered or failed with the reason.
- **A Driver that cannot hear the worker is reloaded** - the tab is the extension's own, so an orphaned script is revived by a reload rather than reported; a tab that is gone, or a page torn down mid-drive, fails the cycle instead, with every answer handed over accounted for.
- **An acknowledgement is retried until it lands** - a lost acknowledgement would leave an answer sitting as queued in the dashboard after it was already typed.
- **Closing the Driver tab pauses the bridge** - until the options page reopens it or the browser restarts; closing its window does not. A tab someone moved off claude.ai is forgotten, never brought back, and after a restart a lone pinned claude.ai tab is taken to be the Driver Chrome restored rather than doubled.
- **Sessions are created in the Driver tab** - the worker claims the daemon's next session request each cycle — repository, branch, prompt, and the model when the run named one — and the Driver creates it first thing, before the visits, from claude.ai's new-session page the cycle starts on; the outcome is reported under the request's id, and a Driver that is off or paused reports the request failed at once rather than leaving it queued.
- **Every cycle records what it did** - the outcome of the last cycle is kept so the options page can state it, including every reason a cycle did nothing.
- **It reloads itself when its files change** - the worker fingerprints the extension's own files when it starts and again every beat; when any of them changed on disk it reloads the extension, never in the middle of a cycle, and records the reload as the last cycle's outcome.

## Business logic

### The token never enters the page

#### User story

The bridge is attached to a daemon that spawns processes on the user's machine. The secret that talks to it must not be readable by claude.ai, or by anything else sharing that tab.

#### Business logic

Every call to the daemon — reporting a question, sending transcript entries, saying hello, listing sessions, reporting list statuses, fetching an answer, acknowledging a delivery, claiming and reporting a session request — is made by the service worker, which reads the daemon URL and token from the extension's own storage and sends `Authorization: Bearer <daemon token>`. The content script is only ever handed what to read and what to type, and only ever passes back what it scraped from the page. Without a token stored, every path stops immediately and reports "no token set" rather than failing silently. The daemon URL defaults to `http://localhost:4200` when the user has not set one, and any trailing slashes on it are ignored.

#### Rationale

A request made from the page's own context would carry claude.ai's origin, and the daemon deliberately answers no cross-origin headers — granting them broadly would let any site the user visits post to their dashboard. The service worker's host permissions let the same request through without that concession, so the call has to live here, and keeping the token here follows for free.

### Every call states the extension's version

#### User story

See `## User story`.

#### Business logic

Every daemon request carries the extension's own version in the `x-tf-extension-version` header, taken from the extension's manifest. A daemon that expects a different version refuses the call outright and names both versions in its reply, which surfaces to the user as the failure text of whatever they were doing.

#### Rationale

A version-skewed bridge does not fail loudly, it half-works: missed messages and silently ignored fields, which read as dashboard bugs and cost a debugging session. Refusing everything, including the connection test, makes updating the extension the only way forward.

### Reporting the parked question

#### User story

The user wants the question their cloud session is parked on to show up in the dashboard within seconds of the session asking it, and to keep showing until it is answered.

#### Business logic

When the content script reports a question, the service worker posts it to `POST /_bridge/question`. A question is dropped without any call when its title, options and recommended option are identical to the last question successfully reported for that same cloud session — the page is re-read on every change and a parked question can sit unanswered for an hour. A report that the daemon refuses is not remembered, so the next page change tries again instead of going quiet, and the daemon's status and reply text are handed back as the reason.

The service worker also forwards, unchanged, two other things the content script produces: batches of transcript entries to `POST /_bridge/events`, and the content script's report about itself — its version, the session it is on, and what its last scrape found — to `POST /_bridge/hello`. The reply to that self-report tells the content script whether its tab is the Driver tab, so the Driver's overlay goes up the moment its page loads.

A third message from the content script, a line of the Driver's cycle log, is merely received: each line resets the idle clock that ends a worker thirty seconds after its last event. Chrome also ends a worker whose single call has run five minutes, which no message resets — which is why one cycle's drive is bounded (below).

### The Driver cycle

#### User story

The bridge only sees pages the extension is injected into, and the extension cannot know a cloud session started. Without help, it works only when somebody happens to be sitting on claude.ai — and with fifty sessions, one tab each is not an option.

#### Business logic

Twice a minute, once when the service worker starts, and on demand from the options page, the worker runs one cycle; a cycle already running makes the next beat do nothing. With no token set the cycle stops at once, saying so. Otherwise it first re-sends any delivery acknowledgements the daemon has not yet taken. When the Driver is switched off in the options, or paused because its tab was closed, the cycle then stops with that reason — after claiming the daemon's next session request, if any, and reporting it failed with the same reason: a request left queued would be created hours later, for a run long gone. Otherwise it asks `GET /_bridge/sessions` for the cloud sessions that are the daemon's, each flagged with whether an answer is queued for it. For every flagged session it fetches `GET /_bridge/answer`: the delivery id and the exact text to type, composed by the daemon. It then claims the daemon's next session request, if any. With no sessions and no request, the cycle ends there, saying so, and no tab is opened.

Otherwise the Driver tab is made sure of: the stored tab if it still exists and is still on claude.ai — one someone moved elsewhere is forgotten, never brought back — else a lone pinned claude.ai tab, taken to be the one Chrome restored after a restart (a restored tab carries no other mark, so the worker cannot tell it from one the user pinned), else a new pinned, inactive tab on claude.ai's session page. The tab id, like the pause, is kept only for the browser session, so a restart starts clean. Its page is reloaded before the list is read if the last load is a minute or more old. The Driver's content script is asked to read the list for the daemon's sessions and answers with each session's status: awaiting input, unread, idle, running, landed, missing from the list, or an unknown label carried verbatim — or that the page shows no session list at all. Those statuses go to `POST /_bridge/statuses`.

The visit planner (`driver-plan`) then picks which sessions are due this cycle from the statuses, the queued answers, and what earlier cycles saw and visited; the worker takes the ones carrying an answer first and at most four in all, the rest waiting for the next beat. The Driver is asked to create the claimed session, if any, and then make those visits; it answers with what the creation did, what each visit found and what each delivery did. A Driver that says it is still busy with an earlier cycle's drive — a worker that ended mid-cycle leaves the page driving — is left alone: nothing is claimed, acknowledged or reported, and the next beat tries again. Otherwise the worker remembers each session's status and, for the ones visited, the time — except a session it planned but did not reach, cut or failed, which keeps its earlier status so the change that made it due still counts; acknowledges every delivery the Driver attempted, as it reported it, while an answer the visit never got to — the session not on the list, the page not becoming it, a Driver that did not answer — stays queued on the daemon and is released here to be tried again next beat (the one exception is a page torn down mid-drive, whose answer may already be typed: that is acknowledged as failed with a note saying to check the session before picking again); reports the creation's outcome under the request's id; and records the cycle's summary — how many statuses of how many sessions, how many awaiting, unread and missing, how many visited of how many due, typed and created, and anything the Driver noted.

#### Rationale

One page load a minute rather than one per session, and the in-app visits the content script makes, are what let one tab serve fifty sessions. The list is reloaded rather than trusted because claude.ai's list refreshes only on a page load: after an in-app navigation it still shows what it showed before.

Claiming the session request before the tab is made sure of means a cycle that fails once it has the tab still owns the request and reports its failure; a cycle that cannot open or reload the tab at all, or finds the Driver busy, leaves the claim to expire on the daemon, which offers the request again.

### Delivering the answer back into the session

#### User story

The user answers the question in the dashboard. They expect the session to be continued with exactly that decision, once, and expect the dashboard to tell them truthfully whether it arrived.

#### Business logic

An answer travels with its visit, and the visit reports it delivered only once the session's page took the send. Only then does the worker post the outcome to `POST /_bridge/answered`, quoting the delivery id and whether it succeeded, plus the content script's note on failure. An answer without a delivery id or without text is ignored. An answer already handed to the Driver is not handed over again for as long as the service worker lives. A delivery the page attempted and reported failed releases that hold; the daemon marks the delivery failed, and only a new pick in the dashboard tries again. An answer the visit never reached is released and left queued, so the next cycle tries it again.

#### Rationale

Acknowledging before typing would mark an answer as sent that a dying page never actually sent, leaving the dashboard claiming a session was answered while it sits parked — the worse of the two races. The cost of typing first is a delivered answer whose acknowledgement is lost being delivered twice, which the claim set prevents while the worker lives; after a worker restart it can be typed a second time, which the bounded drive makes rare.

### A Driver that cannot hear the worker

#### User story

Reloading the extension leaves the already-injected content scripts orphaned; Chrome also discards idle background tabs. Either way the Driver tab stops answering, and nothing gets read or typed.

#### Business logic

When the Driver's page does not answer, the worker retries for a while, since the script may still be being injected; if it keeps not answering, the page is reloaded once — it is the extension's own tab — and the retries continue. A Driver that never answers makes the cycle fail with that reason, and a session request claimed for that cycle is reported as failed with it. A reload that fails because the tab is gone — closed under the cycle — fails the cycle the same way, so every answer handed over is still accounted for. A drive whose page was torn down after taking the message — a reload under it, a sign-in bounce — is not sent again, since the answer may already be typed; the cycle fails with a note saying so.

### An acknowledgement is retried until it lands

#### User story

The user watches the dashboard for confirmation that their answer reached the session. A confirmation that never arrives is indistinguishable from an answer that was never typed.

#### Business logic

An acknowledgement the daemon refuses for a transport reason is kept and re-sent at the start of every cycle, until the daemon either accepts it or rejects it as malformed — a rejection is treated as settled, because retrying it would never succeed.

### Closing the Driver tab pauses the bridge

#### User story

The user closes the Driver tab. Having it reappear half a minute later, forever, is user-hostile — but so is a bridge that silently stays off.

#### Business logic

When the Driver tab closes, the Driver is paused: every following cycle stops with that as its reason, naming the options page's button as the way to resume. That button lifts the pause; so does a browser restart, since the pause — like the tab id — is kept only for the browser session. Closing the window the tab sits in is not closing the tab: Chrome keeps running without a window, so the tab is merely forgotten and reopened in the next one. The Driver switch in the options is separate: switched off, no cycle drives at all. Off or paused, the cycle still pays what it owes the daemon — acknowledgements not yet taken, and a session request claimed and reported failed at once.

### Creating the session the daemon asked for

#### User story

A web run is waiting on the daemon for a cloud session that can push its work; the only thing that can create one is this extension, in the user's browser.

#### Business logic

Each cycle claims the daemon's next session request, if any, and hands it to the Driver along with the cycle's visits; the Driver creates it first, from claude.ai's new-session page the cycle starts on, before making the visits — a run is waiting on it. The outcome is reported to the daemon under the request's id: success with the session id, or failure with the note of what the page lacked — or, when the cycle never reached the Driver, with the cycle's own failure. The created session is one of the daemon's from the next cycle on.

#### Rationale

Creation navigates the page, and so do visits; running both inside one cycle, one after the other, keeps them from racing each other's controls. A report that fails to reach the daemon is not retried here: the daemon's claim expires on its own and the request is offered again.

### Reloading itself when its files change

#### User story

A developer edits the extension in its checkout — the content script, the worker, the manifest — and wants the running extension to pick the change up on its own. Chrome re-reads an unpacked extension's files only on a reload, which used to be a click on chrome://extensions after every edit.

#### Business logic

When the worker starts it takes the fingerprint of the extension's files — see `fingerprint.SPEC.md` for which files and what counts as a change. Every beat, before running the cycle, it takes the fingerprint again; when any file changed, it records "reloading the extension" naming the changed files as the last cycle's outcome and reloads the extension instead of running the cycle. The reload is never done while a cycle is running: a beat that lands on a running cycle does nothing at all, and the next beat checks again. While the files cannot be read, nothing is reloaded. The new worker takes a fresh fingerprint at its start, so one edit is one reload.

After the reload the Driver tab's content script is an orphan, as after a manual reload, and is replaced by the next cycle's page load (see `### A Driver that cannot hear the worker`).

#### Rationale

The worker can read its own files as they are on disk right now — measured on 2026-08-26: a fetch of the extension's own URL from the worker returns the current file, not a cached copy — so no other process has to watch the checkout. A reload mid-cycle would end a drive with answers handed over and unaccounted for; waiting a beat costs half a minute. With developer mode switched off on chrome://extensions, Chrome (137 and later) disables an unpacked extension on reload rather than reloading it; the mode is on for anyone who loaded the extension unpacked, and the extension's README says to leave it on.

### Waking up on a schedule rather than on a timer

#### User story

None directly — this is what makes every scheduled behavior above actually happen while the browser sits idle.

#### Business logic

The beat — the file check and then the cycle — runs off one browser alarm, twice a minute; the cycle also runs once when the service worker starts.

#### Rationale

The extension's service worker is shut down when idle, and any timer it holds dies with it. Alarms wake it back up. One beat serves everything because a person may be sitting at the dashboard watching an answer's spinner, and a run may be waiting for its session.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
