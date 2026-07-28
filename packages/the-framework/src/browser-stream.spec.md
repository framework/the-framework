Loopback HTTP bridge that streams the run's headless Chrome to a human as MJPEG and relays clicks/keys/scroll/navigate back over CDP (#802, part of #609) — so an `await-browser` gate (#796) has something to click.

## TLDR

- `startBrowserStream()` — screencasts the agent's current tab, serves `GET /stream` (multipart/x-mixed-replace) and `POST /input`; returns `{url, port, close}` or `undefined` when Chrome has no page.
- `pickActivePage()` — first `page` target with a debugger socket; Chrome lists most-recently-used first, so that is the agent's current tab.
- `inputToCdp()` — validates and maps a posted `BrowserInput` to CDP calls; anything malformed maps to `[]` and never reaches Chrome.
- `connectCdp` — minimal CDP-over-WebSocket client on Node's global WebSocket (dependency-free); id-matched request/response plus `Page.screencastFrame` fan-out.
- A follow interval re-attaches when the agent switches tabs; a repeat interval re-sends the newest frame so a still page paints (#818).

## Problems

- Chrome refuses DevTools socket connections carrying an `Origin` header unless launched with `--remote-allow-origins`, and opening that would let any page the user visits drive the agent's browser — so the run hosts this bridge and the debug port stays unreachable from the web.
- Browsers do not paint the last `multipart/x-mixed-replace` part until the next boundary arrives, so a still page (exactly the parked-on-a-login-wall case) held a good JPEG unpainted; the repeat interval supplies the boundary (#818).
- The agent opening a tab left the pane streaming the old one (the failure the #609 spike hit): the follow interval polls `/json/list`, re-attaches on change, stops the old screencast, and keeps the current page on a re-attach failure rather than dropping the pane.
- Node holds response headers back until the first write, so `/stream` flushes headers immediately and sends the last known frame — a pane opened on a still page must not hang or sit blank.

## Decisions

- MJPEG + plain POST rather than a WebSocket: an `<img>` renders `multipart/x-mixed-replace` natively, so the dashboard needs no client library and the framework no new dependency.
- Bound to `127.0.0.1` explicitly, and frames are never written to disk or the run's event log — they can show a password being typed.
- Keys go through `Input.insertText` (types the character, not a key code) so non-ASCII and password managers behave; a click is press+release (Chrome ignores a lone `mousePressed`); `navigate` accepts only http(s), rejecting `javascript:`/`file:`.
- `/input` bodies over 8192 bytes destroy the request — an input payload is tiny; anything else is not input.
- No page / unlistable browser ⇒ `undefined`; the run carries on without a pane rather than failing.

## Facts

- Screencast params: JPEG quality 60, max 1280×720; each frame is acked (`Page.screencastFrameAck`) or Chrome stops sending.
- The port is published on the run's log as an event so the daemon can proxy the pane (#813); repeat/follow intervals are `unref`ed and only write while a viewer is attached.
