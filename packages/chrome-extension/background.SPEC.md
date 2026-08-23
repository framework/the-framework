The half of the Claude web bridge that talks to the daemon: it holds the daemon token, reports the question a cloud session is parked on to `POST /_bridge/question`, collects the pick the dashboard queued in reply and hands it to the claude.ai tab, and keeps a pinned background tab open for every cloud session the daemon says is worth watching.

## User story

A `web`-target agent hands its task to a cloud session and ends; nothing streams back. When that session later parks on a question, the question is stranded on claude.ai. The user wants it to appear in their local dashboard, wants to answer it there, and wants that to keep working while they are not looking at claude.ai at all.

## Glossary

- **service worker** — the extension's own background half, with no page attached. It is the only part that holds the daemon token and the only part allowed to call the daemon.
- **content script** — the extension's other half, injected into the claude.ai page. It reads the page and types into it, and it never sees the token.

## Business logic — TL;DR

- **The token never enters the page** - every daemon call is made by the service worker; the content script only passes it what it scraped and receives back only text to type.
- **Every call states the extension's version** - each daemon request carries `x-tf-extension-version`, and a daemon expecting another version refuses it outright rather than half-working.
- **A repeat of the same question costs nothing** - a question identical to the last one accepted for that cloud session is dropped without a call; a failed report is never remembered, so the next page change retries.
- **The pick is typed before it is acknowledged** - the pick is handed to the tab first and only reported as delivered afterwards, so the dashboard never shows a session as answered when nothing was typed.
- **A tab that cannot hear the worker is reloaded only if the extension opened it** - the user's own claude.ai tab may hold text they typed, so it is left alone and the failure is reported instead.
- **An acknowledgement is retried until it lands** - a lost acknowledgement would leave a pick sitting as queued in the dashboard after it was already typed.
- **Tabs open themselves for watched sessions** - one pinned, inactive tab per cloud session the daemon lists, so the bridge does not depend on the user happening to be on claude.ai.
- **A tab the user closed is not reopened** - closing the tab for a session dismisses that one session, and only that one.
- **Tabs the extension opened are also closed by it** - once the daemon stops watching a session, its tab goes, so the browser does not accumulate pinned tabs forever.
- **Every attempt records why it did nothing** - the outcome of the last tab sweep is kept so the options page can state the reason instead of leaving the user guessing.

## Business logic

### The token never enters the page

#### User story

The bridge is attached to a daemon that spawns processes on the user's machine. The secret that talks to it must not be readable by claude.ai, or by anything else sharing that tab.

#### Business logic

Every call to the daemon — reporting a question, sending transcript entries, saying hello, fetching a pick, acknowledging a delivery, listing watched sessions — is made by the service worker, which reads the daemon URL and token from the extension's own storage and sends `Authorization: Bearer <daemon token>`. The content script is only ever handed the text of a pick to type, and only ever passes back what it scraped from the page. Without a token stored, every path stops immediately and reports "no token set: open the extension options" rather than failing silently. The daemon URL defaults to `http://localhost:4200` when the user has not set one, and any trailing slashes on it are ignored.

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

Immediately after a question is accepted, that session is checked for a queued pick: the moment the page changed is also the moment a parked session is most likely to have just been dealt with.

The service worker also forwards, unchanged, two other things the content script produces: batches of transcript entries to `POST /_bridge/events`, and the content script's report about itself — its version, the session it is on, and what its last scrape found — to `POST /_bridge/hello`.

### Delivering the pick back into the session

#### User story

The user picks an option in the dashboard and confirms it. They expect the session to receive exactly that option, once, and expect the dashboard to tell them truthfully whether it arrived.

#### Business logic

Twice a minute, and again right after any question is reported, the service worker asks the daemon which cloud sessions it is watching and fetches `GET /_bridge/answer` for each. When a pick comes back, the worker finds the open tab whose URL carries that session's id, hands the pick's label to that tab's content script to type and submit, and only then posts the outcome to `POST /_bridge/answered`, quoting the pick's id and whether it succeeded, plus the content script's note on failure.

If no tab is showing that session, nothing happens and the pick stays queued for when one exists. A pick already handed to a tab is not handed to another one for as long as the service worker lives; a delivery that came back a failure releases that claim, so a page that recovers can be tried again.

#### Rationale

Acknowledging before typing would mark a pick as sent that a dying tab never actually sent, leaving the dashboard claiming a session was answered while it sits parked — the worse of the two races. The cost of typing first is a delivered pick whose acknowledgement is lost being delivered twice, which the claim set prevents while the worker lives, and which the daemon's own pick id makes harmless afterwards.

### A tab that cannot hear the worker

#### User story

Reloading the extension leaves the already-injected content scripts orphaned; Chrome also discards idle background tabs. Either way the tab showing the session stops answering, and the user's pick has nowhere to go.

#### Business logic

When a tab does not answer, what happens next depends on whose tab it is. A tab this extension opened is reloaded, given five seconds, and tried once more; if it still does not answer, the delivery is reported as failed with the reason. A tab the user opened themselves is never reloaded — the delivery is reported as failed with a note telling them to reload it.

#### Rationale

The user's own claude.ai tab may hold composer text they typed and have not sent. Discarding that to rescue a delivery is not a trade the extension is entitled to make.

### An acknowledgement is retried until it lands

#### User story

The user watches the dashboard for confirmation that their pick reached the session. A confirmation that never arrives is indistinguishable from a pick that was never typed.

#### Business logic

An acknowledgement the daemon refuses for a transport reason is kept and re-sent at the start of every pick poll, until the daemon either accepts it or rejects it as malformed — a rejection is treated as settled, because retrying it would never succeed.

### Opening tabs for watched sessions

#### User story

The bridge only sees pages the extension is injected into, and the extension cannot know a cloud session started. Without help, it works only when somebody happens to be sitting on claude.ai.

#### Business logic

Once a minute, and once when the service worker starts, the extension asks `GET /_bridge/sessions` for the cloud sessions worth watching and opens one tab per session that has none. Tabs are opened pinned and inactive, because the point is that nobody has to look at them. Matching an already-open tab to a session goes by the session id inside the URL rather than the whole URL, since claude.ai rewrites the query string once the page loads.

Tab opening is a switch the user can turn off, and turning it off stops the sweep with that as its stated reason. The options page can also trigger the sweep on demand, so its effect can be seen without waiting for the next minute.

Every early exit is recorded as the last sweep's outcome — no token, switched off, the daemon's status when it refused to list sessions, an unreachable daemon and the underlying error, no recent cloud sessions, or a browser that refused to create the tab — along with how many tabs were opened, how many sessions were listed, how many were closed, and why any session was skipped ("already open" or "you closed it").

#### Rationale

Every one of those exits used to be silent, which made "tabs are not opening" unanswerable without reading a service worker console.

### A tab the user closed is not reopened

#### User story

The user closes the pinned tab for a session they do not care about. Having it reappear a minute later, forever, is user-hostile.

#### Business logic

The extension remembers which session each tab it opened is showing, because a close event names only the tab and by then the URL is gone. When such a tab closes, exactly that one session is added to a dismissed list — capped at the most recent fifty — and the next sweep skips it. Sessions whose tabs were closed by the extension itself are excluded from this: their record is dropped before the tab is removed, so a housekeeping close is not mistaken for the user dismissing the session.

#### Rationale

The first version of this asked the daemon what it was watching and dismissed every session that had no tab open, so the moment any single claude.ai tab closed, every session was blacklisted at once and no tab ever opened again. The dismissed list is therefore stored under a new key and the old one is discarded rather than migrated, since every entry in it is suspect.

### Tabs the extension opened are also closed by it

#### User story

A user who leaves the browser running for days should not end up with a pinned tab for every cloud session that ever ran.

#### Business logic

At the end of every sweep, tabs this extension opened for sessions the daemon no longer lists are closed. Only tabs the extension opened: a claude.ai session the user opened themselves is theirs to keep.

### Waking up on a schedule rather than on a timer

#### User story

None directly — this is what makes every scheduled behavior above actually happen while the browser sits idle.

#### Business logic

Both recurring jobs run off browser alarms rather than in-process timers, and both also run once when the service worker starts. Sessions are swept once a minute; picks are polled twice a minute, on their own faster beat because a person is watching a spinner at the other end of one.

#### Rationale

The extension's service worker is shut down when idle, and any timer it holds dies with it. Alarms wake it back up.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
