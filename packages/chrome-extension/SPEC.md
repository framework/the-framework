The extension half of the Claude web bridge: a Chrome extension that carries the question a cloud session is parked on into the user's local dashboard, and types the answer given there back into the session on claude.ai.

It exists because an agent with run target `web` is hands-off: the daemon hands the whole task to a cloud session on claude.ai and the agent ends at the hand-off. When that session later parks on a gate, nothing streams back — the question is stranded on a claude.ai page nobody may be looking at. The daemon cannot reach claude.ai itself, but the user's own browser is already signed in there, so the extension turns that browser into the bridge's far end, with the daemon's `/_bridge/*` endpoints as the near end.

The bridge being on is also what makes such a session ask at all: a hand-off is told to decide alone whenever the bridge is off, since a question it stopped on could reach nobody, and is told its gates work when the bridge is on. Which of the two it is is settled once, when the task is handed off.

Four parts: the content script (the page half — reads claude.ai, types answers), the service worker (the daemon half — holds the token, makes every daemon call, manages tabs), the options page (setup and connection proof), and an offline check harness that proves the reading and typing against synthetic pages without a browser.

## User story

- I started an agent on the `web` target and walked away. When its cloud session asks something, the question appears in my dashboard — I never have to keep claude.ai open, or even know the session exists.
- I answer it there in one click, exactly as I answer a local agent's question, and the session is continued with that decision. Until the extension collects my answer, I can withdraw it.
- Nothing on any web page — claude.ai included — can learn the secret that talks to my daemon, and the extension never speaks for me beyond the option I picked.

## Glossary

- **bridge token** — the shared secret the daemon demands on every bridge call; the user copies it from The Framework into the extension's options page, and it lives in extension storage.
- **composer** — claude.ai's message input box, the place a delivered answer is typed.
- **answer** — a pick on its way back: the daemon turns the picked options into the text to type — the same wording a local agent is re-prompted with, or a hand-over line when a picked option ends the session — and queues it under a delivery id for the extension to type into the composer.

## Business logic — TL;DR

- **A stranded question's round trip** - the content script extracts the parked question from the page, the service worker reports it to the daemon, the dashboard shows it as an ordinary gate; the answer is queued, collected, typed into the composer, submitted, and the outcome acknowledged.
- **The question crosses whole, so it is answered like a local one** - the block's own shape travels with it, which is what lets the dashboard offer the recommended option, several answers at once, and a pick that hands the session back.
- **Only what the session offered** - the daemon composes what is typed out of labels of the parked question's own options and nothing else, an answer stays withdrawable until the extension collects it, and the extension otherwise only observes.
- **Tabs nobody has to think about** - the daemon publishes which cloud sessions to watch; the extension keeps one pinned, inactive tab per session (opt-in), closes its own stale tabs, and never reopens one the user closed.
- **The trust boundary** - the bridge token and all daemon traffic live in the service worker; the content script, which shares its tab with claude.ai, holds no secret and calls no daemon.
- **Version lockstep** - every daemon call states the extension's version, and a daemon expecting another refuses it outright, naming both versions; the two halves must ship the same number.
- **Where it runs and why each permission exists** - a content script on every claude.ai page and frame; host access to the localhost origins for the worker's CORS-free daemon calls; storage, tabs and alarms for the token, the tab bookkeeping, and polls that survive the worker's idle termination.

## Business logic

### A stranded question's round trip

#### User story

See `## User story`, first and second items.

#### Business logic

On every claude.ai session page, the content script watches the DOM and extracts the choice the session rendered per the await protocol — a JSON block with a title, its options and their detail text, an optional recommended label, whether several may be picked at once, which start ticked, and which end the session — keyed by the cloud session id parsed from the page URL, which is what the daemon joins back to the agent's record. The service worker posts it to the daemon (`POST /_bridge/question`), deduplicating repeats. The dashboard shows the question as the gate it is, in the same panel a local agent's question gets, so answering it takes the single click a local gate takes. The daemon then composes the text that will be typed — the wording that continues the session with the picked options, or a hand-over line when a picked option ends it — and queues it as the answer. The worker polls `GET /_bridge/answer` on a fast beat, hands a queued answer to the content script in that session's tab, and the content script types that text into the composer and submits it; the worker reports the outcome (`POST /_bridge/answered`), and only a delivery the extension confirmed makes the daemon treat the question as resolved. Alongside questions, the content script mirrors the session's transcript to the daemon (`POST /_bridge/events`) and sends a self-report of what the injected script is and sees (`POST /_bridge/hello`), so the dashboard can show what the session did and diagnosis never needs a screenshot. A daemon with the bridge switched off answers no bridge route at all — turning it on is an explicit choice, since it is the one daemon surface meant to be reached from another origin.

### Only what the session offered

#### User story

See `## User story`, second and third items.

#### Business logic

Three properties bound the write path. The daemon refuses to queue an answer unless every label picked is one of the parked question's own options — exactly one of them unless the question allows several — and it composes the text to be typed itself, so the only thing the bridge can ever put in a composer is built from what the session offered, never free text from the browser. An answer stays withdrawable until the extension collects it, and that window is the only time withdrawing means anything. And the extension acts only on delivery: everything else it does is read-only, and its one manual write control — a "Fill composer (does not send)" button on its in-page panel — fills without submitting, proving the write path exists without the extension ever speaking for the user.

### Tabs nobody has to think about

#### User story

See `## User story`, first item.

#### Business logic

The extension only sees pages it is injected into, so it cannot know an agent started. The daemon publishes which cloud sessions are worth watching, and the extension keeps one pinned, inactive background tab open per watched session — content scripts run in background tabs, so the bridge works while Chrome merely runs. Opening tabs is opt-in from the options page. A session whose tab the user closed is dismissed and never reopened; tabs the extension opened are closed once the daemon stops watching their session; tabs the user opened themselves are never touched.

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

### Where it runs and why each permission exists

#### User story

See `## User story`, third item.

#### Business logic

The content script is injected into every `https://claude.ai/*` page, child frames included, once the page settles — frames are covered so a question rendered inside one is still found and reported up to the top frame. Host permissions cover `http://localhost/*` and `http://127.0.0.1/*`: the daemon origins the service worker must fetch without CORS. Three extension permissions carry the rest: storage (the dashboard URL, bridge token and tab-opening preference, plus the dismissed-session and opened-tab bookkeeping — extension storage no web page can read), tabs (finding, opening, pinning and closing session tabs, and messaging their content scripts), and alarms (the recurring sweeps; an idle service worker is terminated and plain timers die with it). The options page is the setup surface: dashboard URL (default `http://localhost:4200`), the bridge token, the tab-opening toggle, and a connection test. Declaring host permissions does not grant them — Chrome can leave site access off, particularly for an unpacked extension — so the options page checks the grants and names any missing one.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
