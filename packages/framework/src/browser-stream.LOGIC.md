Streams the agent [1]'s browser to the user and carries the user's clicks, typing, scrolling and navigations back into it, so a human can deal with a login wall or a captcha in a browser that is headless and owned by the agent. The agent hosts a small server bound to this machine only: the latest screencast frame of the agent's current page as a motion-JPEG stream the dashboard shows in a plain image, and input taken as plain posts. It follows the agent when it switches tabs and announces the page the user would be looking at. It speaks to Chrome over Chrome's own debugger socket with nothing but Node's built-in WebSocket, so it adds no dependency.

## Context

**User story**: an agent parks on a gate [2] asking someone to deal with a login wall or a captcha. The user opens the browser pane in the dashboard, sees the very page the agent is on as it changes, clicks and types into it, and answers the gate once the wall is behind. A still page, such as a login form waiting for input, must paint in the pane and not sit blank.

**Problem**: Chrome refuses debugger connections that come from a web page unless it is launched with that opened up, and opening it up would let any page the user happens to visit drive the agent's browser. So the browser's debugging port stays unreachable from the web, and this stream, hosted by the agent and reached through the daemon, is the only way in. The stream's port is put on the agent's event stream [3] so the daemon can proxy the pane to the dashboard.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[3] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.

## Business logic — TL;DR

- **Which page is shown** - the agent's current page: the most recently used tab with a live debugger socket; no such page means no pane, and the agent carries on.
- **The screencast** - JPEG frames of at most 1280 by 720 go to every viewer as they arrive, a newly opened pane gets the latest frame at once, and the newest frame is repeated every second so a still page paints.
- **Following the agent's tab** - every 2 seconds the current page is re-read; a tab switch re-attaches the stream to the new tab, and a failed re-attach keeps the page already shown.
- **Announcing the page** - the first real web page and every change after it is announced once; blank and internal pages never are.
- **Input from the user** - a click, typed text, a scroll or a navigation to a web address is passed to the page; anything else is refused before it can reach Chrome.
- **Loopback only, nothing persisted** - the stream is reachable only from this machine, and no frame is ever written to disk or to the agent's event stream, since frames can show a password being typed.
- **Closing** - closing stops the screencast, ends every viewer and shuts the server, and is harmless twice.

## Business logic

### Which page is shown

#### Context

**Problem**: an agent that opens a new tab keeps working there while a pane fixed on the first tab goes blind.

#### Business logic

The page shown is the agent [1]'s current one: Chrome lists its pages most recently used first, so the first page that still has a live debugger socket is the one the agent is working in. A page without a socket, crashed or detached, is skipped rather than shown as something unusable. When Chrome has no page to stream, or its page list cannot be read, no stream starts and the agent carries on without a pane rather than failing.

### The screencast

#### Context

See `## Context`.

#### Business logic

- Chrome sends JPEG frames at quality 60, scaled to at most 1280 by 720. Each frame is acknowledged, kept as the latest, and written to every viewer at once.
- A pane that opens receives its response headers immediately, so a pane opened before any frame exists shows an empty stream rather than hanging, and it receives the latest frame right away, since Chrome only emits a frame when the page changes and a pane opened on a still page would otherwise sit blank.
- The newest frame is re-sent every second while at least one viewer is attached: the stream format paints a frame only once the next one's boundary arrives, so the most recent frame is always held back, and a still page, which is exactly what an agent parked on a login wall shows, never produces that next frame. Repeating the frame supplies the boundary.
- The stream is never cached by the browser.

### Following the agent's tab

#### Context

See "Which page is shown".

#### Business logic

Every 2 seconds the current page is re-read (the interval is configurable, and 0 switches following off). When the agent [1]'s current page is a different tab, the stream attaches to that tab first and only then stops and drops the old one; a re-attach that fails keeps streaming the page already held rather than dropping the pane. The same tab showing a new address stays attached, since the screencast keeps itself current.

### Announcing the page

#### Context

**User story**: the dashboard tells the user which page the agent is showing, so a pane need not be open to know that the agent reached, say, a sign-in page.

#### Business logic

The page the user would be looking at is announced for the first real web page (an `http` or `https` address) and on every change after it, whether a navigation in the same tab or a followed tab switch. A blank page or a browser-internal page is never announced, since the browser idling is not the agent [1] showing something, and the same address is never announced twice in a row.

### Input from the user

#### Context

**Problem**: the user's input arrives as untrusted posts from a browser; a malformed one must never reach Chrome.

#### Business logic

- A click is given in page pixels and delivered as a press and a release, since Chrome ignores a lone press; a click without finite coordinates is refused.
- Typed text is inserted as text rather than as key codes, which is what makes non-ASCII characters and password managers behave; empty text is refused.
- A scroll delivers a vertical wheel movement at a position; a scroll without a finite delta is refused.
- A navigation is accepted only for an `http` or `https` address.
- Anything else, including a body that is not valid JSON, maps to nothing: it is answered as a bad request and Chrome is never called. An accepted input is answered with no content. A body over 8 KB is cut off, since an input payload is tiny and anything larger is not input. Any other path is not found.

### Loopback only, nothing persisted

#### Context

**Problem**: the frames can contain whatever the user is typing, a password included.

#### Business logic

The stream's server is bound explicitly to this machine's loopback address, so it is not reachable from the network; the dashboard reaches it through the daemon. No frame is ever written to disk or into the agent [1]'s event stream [3].

### Closing

#### Context

See `## Context`.

#### Business logic

Closing stops following and repeating, ends every viewer's stream, stops Chrome's screencast, closes the connection to Chrome and shuts the server. Closing twice is harmless.
