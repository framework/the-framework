The extension half of the Claude web bridge: a Chrome extension that carries the question a cloud session is parked on into the user's local dashboard, and types the answer given there back into the session on claude.ai.

It exists because an agent with run target `web` is hands-off: the daemon hands the whole task to a cloud session on claude.ai and the agent ends at the hand-off. When that session later parks on a gate, nothing streams back — the question is stranded on a claude.ai page nobody may be looking at. The daemon cannot reach claude.ai itself, but the user's own browser is already signed in there, so the extension turns that browser into the bridge's far end, with the daemon's `/_bridge/*` endpoints as the near end.

A cloud session asks the same way a local agent does — its gates are never framed away. The bridge is what carries the question home; with the bridge off, the question simply waits in the session on claude.ai until the user finds it there.

Six parts: the content script (the page half — reads claude.ai's session list and session pages, types answers, draws the Driver overlay), the service worker (the daemon half — holds the token, makes every daemon call, runs the Driver cycle, reloads the extension when its files change), the visit planner and the file fingerprint the worker and the harness share, the options page (setup and connection proof), and an offline check harness that proves the reading, driving, typing and the fingerprint against synthetic pages without a browser.

## User story

- I started an agent on the `web` target and walked away. When its cloud session asks something, the question appears in my dashboard — I never have to keep claude.ai open, or even know the session exists.
- I answer it there in one click, exactly as I answer a local agent's question, and the session is continued with that decision. Until the extension collects my answer, I can withdraw it.
- Nothing on any web page — claude.ai included — can learn the secret that talks to my daemon, and the extension never speaks for me beyond the option I picked.

## Glossary

- **bridge token** — the shared secret the daemon demands on every bridge call; the user copies it from The Framework into the extension's options page, and it lives in extension storage.
- **composer** — claude.ai's message input box, the place a delivered answer is typed.
- **answer** — a pick on its way back: the daemon turns the picked options into the text to type — the same wording a local agent is re-prompted with, or a hand-over line when a picked option ends the session — and queues it under a delivery id for the extension to type into the composer.
- **Driver tab** — the one pinned, inactive claude.ai tab the extension opens and drives through every cloud session the daemon lists; covered by a full-page overlay saying what it is.
- **session list** — claude.ai's own list of the user's cloud sessions, each row a link to its session with a status label beside it: "Awaiting input", "Unread response", "Idle", "Running", or the session's pull request and its state.

## Business logic — TL;DR

- **A stranded question's round trip** - the content script extracts the parked question from the page, the service worker reports it to the daemon, the dashboard shows it as an ordinary gate; the answer is queued, collected, typed into the composer, submitted, and the outcome acknowledged.
- **The question crosses whole, so it is answered like a local one** - the block's own shape travels with it, which is what lets the dashboard offer the recommended option, several answers at once, and a pick that hands the session back.
- **Only what the session offered** - the daemon composes what is typed out of labels of the parked question's own options and nothing else, an answer stays withdrawable until the extension collects it, and the extension otherwise only observes.
- **It creates the sessions the daemon asks for** - a web run's cloud session is created here, in the Driver tab on claude.ai's own new-session page with the repository and branch the run named, so it is bound to the repository and can push and open its pull request, and on the model the run named when it named one; the branch and the model are verified before anything is sent.
- **One Driver tab for every session** - the daemon publishes which cloud sessions are its; the extension keeps one pinned, inactive tab (opt-in) that reads claude.ai's session list, visits only the sessions waiting on their user or holding a queued answer — navigating inside the app, with one page load a minute to refresh the list — reports each session's list status to the daemon, and covers itself with a full-page overlay saying what it is, with collapsible debug logs. Closing the tab pauses the bridge until the options page reopens it or the browser restarts.
- **The trust boundary** - the bridge token and all daemon traffic live in the service worker; the content script, which shares its tab with claude.ai, holds no secret and calls no daemon.
- **Version lockstep** - every daemon call states the extension's version, and a daemon expecting another refuses it outright, naming both versions; the two halves must ship the same number.
- **It reloads itself when its files change** - the extension is unpacked and edited in place; the service worker fingerprints its own files every beat and reloads the extension when any changed on disk, never mid-cycle, so an edit in the checkout is running within half a minute without a visit to chrome://extensions.
- **Where it runs and why each permission exists** - a content script on every claude.ai page and frame; host access to the localhost origins for the worker's CORS-free daemon calls; storage, tabs and alarms for the token, the Driver tab's bookkeeping, and a cycle that survives the worker's idle termination.

## Business logic

### A stranded question's round trip

#### User story

See `## User story`, first and second items.

#### Business logic

On every claude.ai session page — the Driver tab's visits included — the content script watches the DOM and extracts the choice the session rendered per the await protocol — a JSON block with a title, its options and their detail text, an optional recommended label, whether several may be picked at once, which start ticked, and which end the session — keyed by the cloud session id parsed from the page URL, which is what the daemon joins back to the agent's record. The service worker posts it to the daemon (`POST /_bridge/question`), deduplicating repeats. The dashboard shows the question as the gate it is, in the same panel a local agent's question gets, so answering it takes the single click a local gate takes. The daemon then composes the text that will be typed — the wording that continues the session with the picked options, or a hand-over line when a picked option ends it — and queues it as the answer. Each cycle the worker learns from `GET /_bridge/sessions` which sessions hold a queued answer, fetches each from `GET /_bridge/answer`, and has the Driver visit that session and type the text into its composer and submit it — counted as sent only once the page took the send; the worker reports the outcome (`POST /_bridge/answered`), and only a delivery the extension confirmed makes the daemon treat the question as resolved. Alongside questions, the content script mirrors the session's transcript to the daemon turn by turn, as it is written (`POST /_bridge/events`) and sends a self-report of what the injected script is and sees (`POST /_bridge/hello`), so the dashboard can show what the session did and diagnosis never needs a screenshot. A daemon with the bridge switched off answers no bridge route at all — turning it on is an explicit choice, since it is the one daemon surface meant to be reached from another origin.

### Only what the session offered

#### User story

See `## User story`, second and third items.

#### Business logic

Three properties bound the write path. The daemon refuses to queue an answer unless every label picked is one of the parked question's own options — exactly one of them unless the question allows several — and it composes the text to be typed itself, so the only thing the bridge can ever put in a composer is built from what the session offered, never free text from the browser. An answer stays withdrawable until the extension collects it, and that window is the only time withdrawing means anything. And the extension acts only on delivery: everything else it does is read-only, and its one manual write control — a "Fill composer (does not send)" button on its in-page panel — fills without submitting, proving the write path exists without the extension ever speaking for the user.

### It creates the sessions the daemon asks for

#### User story

A web run wants a cloud session that can push its work and open a pull request. Such a session is created through claude.ai's repository picker, in the user's own signed-in browser — which is exactly where this extension runs.

#### Business logic

Each cycle the service worker claims the daemon's next session request, if any. The Driver returns to claude.ai's new-session page at the end of the cycle's visits and is handed the request — repository, branch, prompt, and the model when the run named one — and its content script chooses the repository, makes sure the branch chip reads the requested branch, picks the model in the page's model menu when one was named (a menu that does not offer it fails the creation rather than sending on the page's default), types the prompt and sends. The session id is read from the page's address once it becomes a session, and reported back to the daemon along with a note of what was clicked; a failure reports what the page lacked instead. One creation runs per cycle. The created session is one of the daemon's from the next cycle on.

#### Rationale

The session is created through the same controls a person would use, in their own browser, on their own account. Every selector is a guess about a page that is not ours, so the page half reports what it saw rather than insisting — the first failure is meant to be diagnosable from the run's log.

### One Driver tab for every session

#### User story

See `## User story`, first item — and it has to hold for fifty sessions as it does for one.

#### Business logic

The extension only sees pages it is injected into, so it cannot know an agent started. The daemon publishes which cloud sessions are its — every web run's session of the last twelve hours, each flagged with whether an answer is queued — and the extension keeps one pinned, inactive background tab, the Driver, open on claude.ai: content scripts run in background tabs, so the bridge works while Chrome merely runs. Twice a minute the Driver reads the session list — each of the daemon's sessions with the status claude.ai shows beside it — reports those statuses to the daemon, and visits only the sessions the planner picks — a handful a cycle, answers first: the ones whose status changed to a stopped one (awaiting input, unread or idle), the awaiting ones not looked at for five minutes, and any holding a queued answer. A visit is an in-app navigation, clicking the session's row and later the list's "New" link back, never a page load; the list itself is refreshed by one page load a minute, since claude.ai's list refreshes only on a load. A visited session is read and mirrored as any page is, and typed into when an answer travelled with the visit. Running the Driver is opt-in from the options page. Closing the Driver tab pauses the bridge until the options page reopens it or the browser restarts; the user's own claude.ai tabs are never navigated or typed into — with one exception the extension cannot avoid: after a browser restart, a lone pinned claude.ai sessions tab is taken to be the Driver Chrome restored, since a restored tab carries no other mark.

The Driver tab shows a full-page overlay in place of claude.ai's interface: a heading naming it "The Framework Driver", a line saying what the tab is for and that closing it pauses the bridge, and a collapsed "Show debug logs" holding the cycle log — what was read, visited, typed and created, and what the daemon answered.

#### Rationale

One tab per session, capped at three, was the previous design; it stopped at three sessions. claude.ai's list carries a text status per session, so one tab can tell which of fifty sessions need a visit and skip the rest. The overlay exists because a pinned tab being driven by an extension looks broken to a person who stumbles on it, and because that person must not type into it.

### The trust boundary

#### User story

See `## User story`, third item.

#### Business logic

The daemon deliberately answers no CORS headers on the bridge — a wildcard would let any site the user visits post to their dashboard — so a fetch carrying a page's origin is refused, and only the extension's service worker, exempt from CORS through its host permissions, can reach the daemon. That forces the healthy shape: the bridge token lives in extension storage, is read only by the worker and the options page, and never enters a content script; the content script, which shares its tab with claude.ai, talks only to the worker. Nothing the extension stores is readable by any web page. What the extension can post is small and fixed — questions, transcript text, self-reports, delivery acknowledgements — never a path, command, or prompt.

### Version lockstep

#### User story

See `## User story`, first item — a bridge that half-works is worse than one that says it is broken.

#### Business logic

Every daemon call states the extension's version in the `x-tf-extension-version` header. A daemon expecting a different version refuses the call outright with an error naming both versions and the way out, because a version-skewed extension does not fail loudly — it half-works, which reads as dashboard bugs. The options page shows that refusal verbatim. The extension and the daemon must therefore ship the same version number.

### It reloads itself when its files change

#### User story

The extension is dogfood-only and unpacked: it runs straight from the checkout. A developer who edits it wants the change running without the click on chrome://extensions that Chrome otherwise requires before it re-reads an unpacked extension's files.

#### Business logic

The service worker takes a fingerprint of the extension's own files when it starts — every file Chrome loads for the extension — and again every beat; when any of them changed on disk, it reloads the extension instead of running that beat's cycle, and never while a cycle is running. The reload is recorded as the last cycle's outcome, naming the changed files. Content scripts already injected — the Driver tab's included — are orphaned by the reload, as by a manual one; the Driver's is replaced by the next cycle's page load, and the user's own claude.ai tabs get the new script on their next load. The fingerprint's rules are in `fingerprint.SPEC.md`, the worker's in `background.SPEC.md`.

#### Rationale

Chrome offers no way for anything but a click to reload an unpacked extension — chrome:// pages are off-limits to extensions and the daemon has no handle on the browser — but an extension may reload itself, and its worker can read its own files as they are on disk. The trigger the click used to supply is the worker noticing the change.

### Where it runs and why each permission exists

#### User story

See `## User story`, third item.

#### Business logic

The content script is injected into every `https://claude.ai/*` page, child frames included, once the page settles — frames are covered so a question rendered inside one is still found and reported up to the top frame. Host permissions cover `http://localhost/*` and `http://127.0.0.1/*`: the daemon origins the service worker must fetch without CORS. Three extension permissions carry the rest: storage (the dashboard URL, bridge token, Driver switch and the last cycle's outcome, plus — kept only for the browser session — the Driver tab's id and whether it was paused; extension storage no web page can read), tabs (opening, pinning, reloading and messaging the Driver tab), and alarms (the recurring cycle; an idle service worker is terminated and plain timers die with it). The options page is the setup surface: dashboard URL (default `http://localhost:4200`), the bridge token, the Driver switch, and a connection test. Declaring host permissions does not grant them — Chrome can leave site access off, particularly for an unpacked extension — so the options page checks the grants and names any missing one.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
