Runs the extension's worker [1], the half of the Claude web bridge [2] that holds the bridge token [3] and talks to the daemon: twice a minute it runs a cycle [4] that asks the daemon which cloud sessions [5] to serve and collects the answers [6] queued for them, claims the daemon's next session request [7], keeps one Driver tab [8] and has it read claude.ai's session list and visit what is due, then accounts to the daemon for every visit, delivery and creation. It also forwards what the content script [9] finds on any claude.ai page, pauses the bridge when the user closes the Driver tab, and reloads the extension when its own files change on disk.

## Context

**User story**:
- A hands-off [10] agent [11] runs in a cloud session [5]. When the session stops to ask, the user sees the question in the dashboard within about a minute, answers it there, and the answer [6] is typed into the session without the user opening claude.ai.
- The user starts a hands-off agent, and within about a minute its cloud session exists on claude.ai and the dashboard shows the session link.
- The user opens the extension's options page and reads what the last cycle [4] did, or why the bridge is doing nothing.

**Problem**:
- The extension cannot know an agent started: it only sees pages it is injected into. So the daemon publishes which cloud sessions are its, and the worker [1] keeps one pinned tab open that serves them all: one tab for fifty sessions, not a tab each.
- A content script [9] shares its tab with claude.ai, and a request sent from a page carries the page's origin; the daemon answers no CORS headers on purpose, because a wildcard would let any site the user visits post to their dashboard. The worker holds the host permissions for the daemon's address and is not subject to CORS, so the token and every call to the daemon live here and only here, and nothing on a claude.ai page can read the secret.
- Chrome ends the worker whenever it is idle and its timers die with it; only an alarm wakes it again. A drive in the page can run for minutes, and Chrome also ends a worker whose single call has run five minutes.

## Glossary

[1] worker: the extension's background service worker: the half of the extension that holds the bridge token and talks to the daemon; Chrome runs it without any page and ends it when idle.
[2] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[3] bridge token: the secret the extension presents.
[4] cycle: one pass of the worker's loop, twice a minute: list the sessions to serve, read their list statuses, visit what is due, account for every answer and session request.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] answer: the text the daemon composes from a pick for the extension to type into the cloud session; it is queued in the dashboard until a Driver tab collects it, then marked sent or failed as the extension reports.
[7] session request: the daemon's request that the extension create a cloud session on claude.ai for a hands-off agent: a repository, a branch, a prompt and optionally a model; queued on the daemon, claimed by the worker that reads it, and reported back as created or failed.
[8] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[9] content script: the script the extension injects into every claude.ai page; it shares the page with claude.ai and holds nothing secret.
[10] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[11] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[12] question block: the JSON object with a `title` and `options` that an agent writes into its final message when it stops at a gate; claude.ai renders it as a code block in the session's transcript.
[13] transcript mirror: the copy of a cloud session's transcript the content script sends to the daemon, one entry per conversation turn keyed by the turn's position.
[14] overlay: the full-page cover the content script draws over the Driver tab, titled "The Framework Driver".
[15] bridge browser: the Chrome for Testing the daemon runs for it.
[16] list status: what claude.ai's own session list says a session is doing, as the Driver tab reads it off the status icon beside the session's row: `awaiting`, `unread`, `idle`, `running`, `landed`, `missing` or `unknown`.
[17] survey: one read of a claude.ai page by the content script: it looks for the question block, mirrors the transcript and redraws what it shows.

## Business logic — TL;DR

- **The token and every daemon call live in the worker** - the bridge token and the dashboard address come from extension storage (address default `http://localhost:4200`); every call carries the token and the extension's version, and a daemon expecting another version refuses every call; without a token nothing is called.
- **A parked question is reported once** - the worker posts the question the content script found, answers a repeat of the same question for the same session as sent without calling, and forgets a failure so the next page change retries.
- **The transcript and the page's hello are forwarded** - transcript entries and the page's self-report go to the daemon as received, and the hello's reply tells a page whether it is the Driver tab.
- **One clock, one cycle at a time** - an alarm wakes the worker every half minute; each wake reloads the extension if its files changed, else runs a cycle; a wake landing on a running cycle does nothing; the options page can run a cycle on demand; every cycle's outcome is recorded for the options page.
- **Debts first, then the Driver's switch** - a cycle first retries the acknowledgments that never reached the daemon; with the Driver tab switched off or paused, it fails any session request at once with that reason and stops there.
- **Listing the sessions, collecting answers, claiming a session request** - the daemon names the sessions to serve; the worker collects the answer queued for each flagged session and claims the next session request by reading it; with nothing to serve, no tab is opened.
- **One Driver tab, found or opened, never stolen** - a remembered tab still on claude.ai is reused; a lone pinned claude.ai session-list tab is adopted; otherwise a new pinned, inactive tab is opened; a tab someone moved elsewhere is left to them.
- **Reading the session list** - the page is reloaded before a read once a minute has passed since its last load; the read is retried for a while, with one reload to revive a script orphaned by an extension reload; what the list said is posted to the daemon.
- **Planning and capping the visits** - the visit planner decides what is due; answers go first; at most four visits per cycle; a session not reached this cycle keeps its earlier status so the change stays due.
- **Every answer handed over is accounted for** - a delivery is acknowledged as the page reported it; one the page never got to is released and retried next cycle; a page torn down mid-drive is acknowledged as failed with a warning to check the session; an acknowledgment the daemon did not take is kept and retried.
- **The session request's outcome is reported** - created with its session id, or failed with a note saying what went wrong; a Driver tab still busy with an earlier drive leaves the claim to expire on the daemon.
- **Closing the Driver tab pauses the bridge** - until the options page reopens it or the browser restarts; closing the whole window only forgets the tab.
- **Reloading itself when its files change** - the worker fingerprints its files at start and on every wake, reloads the extension on a difference, never mid-cycle, and records why.

## Business logic

### The token and every daemon call live in the worker

#### Context

See `## Context`.

#### Business logic

The bridge token [3] and the dashboard address are read from extension storage for every call; the address defaults to `http://localhost:4200`, and trailing slashes are dropped. Every request to the daemon carries the token as a bearer credential and a header stating the extension's version, the manifest's `0.12.0`. A daemon that expects another version refuses every call, with a message naming both versions and the way out; the worker [1] passes the daemon's text through, so a cycle [4] then records "daemon answered 426 listing sessions" and the options page's test shows the message itself. With no token stored, nothing is called: a question report is answered "no token set: open the extension options", a transcript batch the same, and a cycle records "no token set". The worker never reads or changes a claude.ai page itself; everything that happens on a page is asked of the content script [9] by message.

### A parked question is reported once

#### Context

**Problem**: the content script [9] re-surveys on every change to the page, and a parked question can sit there for an hour; posting it on every change would spend a call per change for no news.

#### Business logic

A report must name the cloud session [5]; without an id it is refused ("no session id"). The worker [1] remembers, per session, the last question the daemon accepted, as its title, options and recommendation; a report identical to it is answered as sent and skipped ("unchanged") without a call. A different question is posted. When the daemon refuses it, the refusal ("daemon answered <status>: <the first 200 characters of its text>") is returned to the page and nothing is remembered, so the next page change retries rather than going quiet. The memory lives only in the running worker: once Chrome has restarted the worker, the next survey [17] posts the question again, and the daemon decides whether it is news (`bridge-store.ts`).

### The transcript and the page's hello are forwarded

#### Context

**Business logic story**: the content script [9] decides what of the transcript mirror [13] changed and what to say about itself (`content.js`); the worker [1] only carries it, since it alone holds the token.

#### Business logic

A transcript batch, the session id and its entries, is posted to the daemon as received, under the same token rule as a question and with the same error text on refusal. A hello, the page's version, session id and a note about what it last saw, is posted to the daemon too, and the reply tells the page whether its tab is the Driver tab [8]: the worker compares the sender's tab with the tab it remembers as the Driver, so the Driver tab draws its overlay [14] the moment it loads rather than when the first cycle [4] reaches it. A cycle log line from the Driver tab is merely received and acknowledged: each one resets the idle clock that would otherwise end the worker while a drive runs for minutes in the page.

### One clock, one cycle at a time

#### Context

**Problem**: Chrome ends an idle worker [1] and a timer dies with it; only an alarm wakes it back up. One beat serves everything, because a person may be sitting at the dashboard watching an answer's spinner while an agent [11] waits for its session.

#### Business logic

An alarm fires every half minute, the floor Chrome allows, and each firing is one wake. A cycle [4] also runs when the worker starts, and when the options page's "Open the Driver tab now" asks for one; that request first lifts a pause. Only one cycle runs at a time: a wake that lands on a running cycle does nothing, and the next wake checks again; an on-demand request during a cycle is answered "a cycle is already running". Every cycle's outcome, ok or failed with a reason, is recorded with its time in extension storage, so the options page can say why the bridge did nothing without anyone opening a worker console. A completed cycle's reason reads "read N of M (A awaiting, U unread, X missing), visited V", followed by " of P due" when the cap cut visits, ", typed T", and, when a session request [7] was claimed, ", created <session id>" or ", created nothing: <why>", then "; <the Driver tab's note>" when the page had one. A cycle that fails unexpectedly records the error as its reason.

### Debts first, then the Driver's switch

#### Context

**Problem**: driving a tab on someone's behalf should be asked for, not assumed; and a session request [7] left queued while nothing can serve it would be created hours later, for an agent [11] long gone.

#### Business logic

Before anything else, every acknowledgment that failed to reach the daemon in an earlier cycle [4] is sent again. Then the Driver's switch is read. With "Run the Driver tab" unchecked on the options page, the cycle stops with "the Driver tab is switched off"; with the Driver tab [8] closed by the user, it stops with "the Driver tab was closed; "Open the Driver tab" on the options page resumes it". In either case the cycle still claims the daemon's next session request and reports it failed with that reason, so the agent waiting on it is told at once, and does nothing more.

### Listing the sessions, collecting answers, claiming a session request

#### Context

See `## Context`.

#### Business logic

The worker [1] asks the daemon which cloud sessions [5] to serve: the sessions of hands-off [10] agents [11] started within the daemon's session window, newest first, plus every session with an answer [6] queued whatever its age (`bridge-sessions.ts`). A daemon that cannot be reached ends the cycle [4] with "could not reach <address>: <error>", a refusal with "daemon answered <status> listing sessions"; entries without a session id are ignored. For every listed session flagged as having an answer queued, the worker asks the daemon for that answer, an id and the text to type. The daemon hands an answer to one asker at a time and offers it again only when nobody has acknowledged it for a while (`bridge-store.ts`), so two Driver tabs [8] serving one daemon, the user's own Chrome and the bridge browser [15], never type the same answer; an answer whose id this worker already handed to its Driver tab is not collected again. Then the next session request [7] is claimed by the very read that fetches it, so two Driver tabs never both create it; from then on the request is the worker's to report on, success or failure. A request is taken only when it carries an id, a repository, a branch and a prompt. With no session to serve and no request, the cycle ends with "nothing to drive: no recent cloud sessions, no session to create", and no Driver tab is opened.

### One Driver tab, found or opened, never stolen

#### Context

**Problem**: a tab id from an earlier browser session names whatever tab happens to carry that number now, which is not a tab to drive; and a tab a person moved away from claude.ai is theirs.

#### Business logic

The Driver tab's [8] id and the pause flag are kept in Chrome's session-scoped extension storage: it survives the worker [1] restarting and is emptied when the browser restarts. To find the tab, the remembered id is tried first: a tab that still exists and is on `https://claude.ai/` is reused, otherwise it is forgotten. Next, if exactly one pinned tab is on claude.ai's session list page (`https://claude.ai/code`), it is adopted: Chrome restores pinned tabs after a restart under new ids, and the bridge browser [15] opens its Driver tab the same way; a restored tab carries no other mark, so it cannot be told from one the user pinned themselves. Otherwise a new tab is opened at `https://claude.ai/code`, pinned and not active, and given up to 30 seconds to load. A tab is never navigated to make it the Driver tab: whoever moved it keeps it. The Driver tab does not need to be visible; it only needs Chrome running.

### Reading the session list

#### Context

**Problem**: claude.ai's session list refreshes only on a page load; after an in-app navigation it still shows what it showed before. And a content script [9] orphaned by an extension reload cannot hear the worker [1] at all.

#### Business logic

When there are sessions to read and the Driver tab's [8] page was last loaded a minute or more ago, the page is reloaded first and given up to 30 seconds to load; a tab the worker just opened counts as freshly loaded, and a restarted worker reloads once. The read is asked of the content script; while the script is still being injected the ask is retried up to ten times, two seconds apart, and after the third failure the tab is reloaded once to revive an orphaned script before the retries continue. A tab that cannot be reloaded ends the cycle [4] with "the Driver tab is gone: <error>", one that never answers with "the Driver tab never answered: <error>". A read the page refused ends the cycle with the page's note (for instance "no session rows on /login" when the browser is signed out); a claimed session request [7] is then reported failed with that note, except when the page is still busy with an earlier cycle's drive, in which case the claim is left to expire on the daemon and the request is offered again once the page is free. What the list said, a list status [16] per session with the list's own label for an `unknown` one, is posted to the daemon: this is the read-back a hands-off [10] agent's [11] own record cannot give, since the agent ended at its handoff, and it is how the dashboard learns that a session is waiting on the user even when it asked in prose.

### Planning and capping the visits

#### Context

**Problem**: one drive is one message the worker [1] waits on, and Chrome ends a worker whose single call has run five minutes; the cycle log lines reset only the separate idle clock. Four visits and a creation keep well under that even on a slow page.

#### Business logic

The visit planner (`driver-plan.js`) picks, from the list statuses [16] just read, the answers [6] collected and what the worker remembers of earlier cycles [4], the sessions to visit. Visits carrying an answer go first, then the rest in the list's order, and at most four are handed to the Driver tab [8] per cycle; the rest wait for the next one. A session planned but not reached, cut by the cap or failed on the way, keeps its earlier remembered list status, so the change that made it due is still a change next time; a session reached is remembered with its status and the time of the visit; a session read but not planned is remembered with its new status. The memory lives only in the running worker: a restarted worker has seen nothing, and visits every `awaiting`, `unread` and `idle` session once.

### Every answer handed over is accounted for

#### Context

**Problem**: a delivery is not idempotent, and an answer [6] handed to the page must be answered for exactly once: an unacknowledged delivered answer would sit as queued in the dashboard after being typed into the page, and a re-sent one would be typed twice.

#### Business logic

The ids of the answers handed over are marked delivered before the drive starts, so a slow acknowledgment cannot double-submit. The Driver tab [8] is then asked to drive: the session request [7] first, then the visits. If the page answers that it is still busy with an earlier cycle's [4] drive (a worker [1] that ended mid-cycle leaves the page driving), nothing was handed over: the marks are removed, nothing is acknowledged or reported, the cycle ends with "the Driver is still busy with an earlier cycle", and the next one tries again. Otherwise every answer handed over is settled. One the page reported an outcome for is acknowledged as it stands: sent, or failed with the page's note cut to 300 characters. One the visit never got to (the session not on the list, the page not becoming it, the Driver tab not answering) is released, so the next cycle collects it again and retries; the daemon keeps it queued. One handed to a page that was torn down mid-drive (a reload under it, a sign-in bounce) may already be typed, so it is acknowledged as failed with "the Driver page was torn down mid-drive; an answer handed over may or may not have been typed — check the session before picking again". A failed delivery releases the id as well. An acknowledgment the daemon did not take, because it was unreachable or refused for any reason but a malformed acknowledgment, is kept and sent again at the start of every later cycle, never dropped.

### The session request's outcome is reported

#### Context

**Business logic story**: an agent [11] polls the daemon for the session it asked for; the daemon's claim on the request expires by itself if nobody reports on it (`bridge-starts.ts`).

#### Business logic

The session request [7] travels to the Driver tab [8] as repository, branch, prompt and, when the daemon named one, model. A claimed request is reported as created only together with the session id the page read off the address; otherwise as failed with a note of up to 1500 characters: the page's note, or "the Driver did not create the session" when the drive gave none, or the reason the Driver tab could not read the list, or that the Driver tab is switched off or was closed. A report that cannot reach the daemon is not retried: the claim expires and the request is offered again.

### Closing the Driver tab pauses the bridge

#### Context

**User story**: the user closes the pinned "The Framework Driver" tab to make it stop, and it does not reappear half a minute later; "Open the Driver tab now" on the options page brings it back.

#### Business logic

When the Driver tab [8] is closed, it is forgotten. Closing the tab itself is the user saying stop: the bridge pauses, and every cycle [4] ends with "the Driver tab was closed; "Open the Driver tab" on the options page resumes it" until the options page resumes it or the browser restarts, which clears the pause with the rest of the session-scoped memory. Closing the whole window the tab sits in is not that, since Chrome keeps running without a window: the tab is merely forgotten and opened again in the next cycle.

### Reloading itself when its files change

#### Context

**Problem**: the extension is unpacked and edited in place, and Chrome re-reads an unpacked extension's files only when the extension reloads; without this, every edit would need a click on `chrome://extensions`.

#### Business logic

When the worker [1] starts it takes a fingerprint of the extension's seven files as they are on disk (`fingerprint.js`), and it takes another on every wake. When any file differs, the outcome "reloading the extension: <files> changed on disk" is recorded as the last cycle's [4], and the extension reloads itself. Never mid-cycle: a reload would kill a drive with answers [6] handed over and unaccounted for, so a wake that lands on a running cycle does nothing and the next one checks again. While the files cannot be read, nothing counts as changed. The reload orphans the content script [9] in the Driver tab [8], which the next cycle's page load replaces; the user's own claude.ai tabs keep the old script until they are reloaded by hand. Developer mode must stay on in `chrome://extensions`: with it off, Chrome 137 and later disables an unpacked extension on reload instead of reloading it, and only a click there brings it back.
