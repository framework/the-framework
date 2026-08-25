# Bug analysis: packages/framework/src/browser-stream.ts

## Business logic (high-level)

The browser preview bridge (#802/#609): serves the agent's headless Chrome as an MJPEG stream on a
loopback-only HTTP server and relays a human's clicks/keys/scroll/navigation back over CDP. Invariants
per `browser-stream.SPEC.md`:

- **Show the agent's current page**: pick the most-recently-used `page` target with a live debugger
  socket; re-check on an interval and re-attach on tab switch; keep the old page on a failed re-attach.
- **Announce page changes** (#1455 item 6b): first real (http/https) page and every change after,
  never `about:blank`/`chrome://`, never the same URL twice in a row.
- **A still page still paints** (#818): re-send the newest frame on an interval while a viewer is
  attached, and immediately on connect.
- **Privacy**: bind to 127.0.0.1 only; never write a frame to disk or the event log. Malformed input
  must never reach Chrome and is rejected (400).
- **No pane beats no agent**: no page / unlistable browser → return `undefined`, caller carries on.

Lifecycle: `startBrowserStream` attaches a screencast session, starts the repeat + follow intervals,
starts the HTTP server; `close()` (idempotent) clears the intervals, ends viewers, stops the
screencast, closes the CDP session and the server. Caller (`cli.ts` `settleAgent` finally block)
`await`s `browserStream.close()` **before** `sharedBrowser.close()` (which kills Chrome), so the
close path assumes Chrome is still answering — the assumption that breaks in bug 1.

Concurrency surface: the follow interval's async callback races `close()` and its own next firing
(neither is guarded); CDP replies race pending `send` promises; viewers' sockets race the repeat
interval's writes. The last one was probed and is safe: `res.write` on a response whose client
vanished returns `false` silently on Node 22 (no unhandled `'error'`), and the `req.on('close')`
handler then prunes the viewer.

## Functions (low-level)

- **`pickActivePage(targets)`**: first target with `type === 'page'` and a truthy
  `webSocketDebuggerUrl`. Relies on Chrome's MRU ordering of `/json/list`. Empty list → `undefined`.
  Correct (matches tests; skips service workers and socketless tabs).

- **`inputToCdp(input)`**: maps the four input kinds to CDP calls, `[]` for anything else.
  - `click`: rejects non-finite x/y; press+release pair. Correct.
  - `key`: rejects non-string/empty; `Input.insertText`. Correct (non-ASCII safe).
  - `scroll`: rejects only non-finite `deltaY`; `x`/`y` go through `?? 0`, which catches
    `undefined`/`null` but **not** `NaN`/`Infinity` — a malformed scroll is forwarded to Chrome
    (JSON-serializes to `null`) and answered 204. Bug (minor) — see Bugs #3.
  - `navigate`: `^https?:\/\//i` allowlist blocks `javascript:`/`file:`. Correct.
  - `input?.type` optional-chain guards `null`/`undefined` bodies. Correct.

- **`framePart(boundary, jpeg)`**: `--boundary`, `Content-Type`, byte-accurate `Content-Length`,
  trailing CRLF. Correct.

- **`startBrowserStream(opts)`**:
  - Startup: list targets (errors → `[]`), pick page, else `undefined`. Correct per spec.
  - `announce(url)`: http(s)-only + last-announced dedupe. Correct ("twice in a row" only).
  - `attach(target)`: connect, install frame handler (updates `latest`, fans out to viewers, acks
    with fire-and-forget), start screencast (jpeg q60, 1280x720). A rejection from the initial
    `attach` propagates out of `startBrowserStream`; the sole caller (`cli.ts:1209`) catches it.
    The intervals are created after this line, so nothing leaks on that path. Correct.
  - Repeat interval: skips when no frame or no viewers; unref'd. Correct (#818).
  - Follow interval: on same-id, re-announce; on new id, attach-then-stop-old, keep old on failure.
    Two flaws: (a) not cancelled logically by `close()` — `clearInterval` doesn't stop an
    in-flight callback, which can complete `attach` **after** close and leave a live, never-stopped
    session; (b) no re-entrancy guard — a `listTargets`+`connect` slower than `followIntervalMs`
    lets two callbacks attach concurrently and leak one session (both captured the same
    `previous`). See Bugs #2.
  - HTTP server: `/stream` flushes headers, sends `latest` immediately, tracks viewer, prunes on
    request `close`. `/input` caps body at 8KB via `req.destroy()` (the client sees a reset rather
    than the spec's "reported back as rejected" — accepted as deliberate, noted only), parses JSON
    (parse failure → 400), fires calls with swallowed rejections, 204/400. Correct apart from the
    scroll-NaN case above.
  - `close()`: idempotent flag; clears intervals; ends viewers; `await
    session.send('Page.stopScreencast').catch(...)`; closes session and server. **Hangs forever
    when the session's WebSocket is no longer open** — see Bugs #1. Also subject to the follow
    race in Bugs #2.

- **`connectCdp(url)`**: opens Node's global WebSocket, promise-per-`send` keyed by id, frame
  handler fan-out. Open failure rejects. Unparseable/unknown messages ignored. CDP error replies
  reject with the message. `ws.send` wrapped in try/catch — but per the WHATWG spec (probed on
  Node 22), `send()` on a CLOSING/CLOSED socket **does not throw**; it silently discards. There is
  no `'close'`/`'error'` listener after open, so nothing ever rejects the `pending` map: every
  `send` made after the socket died returns a promise that never settles. Bug (major) — Bugs #1.
  (The unhandled post-open `'error'` event is safe: EventTarget-style errors don't crash.)

- **`defaultListTargets(browserUrl)`**: fetch `/json/list`, non-ok → `[]`, non-array → `[]`. A
  `res.json()` parse throw propagates, but both call sites `.catch(() => [])`. Correct.

## Bugs found

1. **L322 (`connectCdp` `send`, biting at L280 `close()`)** — critical path hang: once the CDP
   WebSocket has closed (Chrome crashed / was OOM-killed / exited after the agent closed its last
   tab; or the streamed tab was destroyed before the follow loop re-attached), any `session.send`
   registers a `pending` entry that never settles — probe confirmed Node 22's `WebSocket.send` on a
   CLOSED socket silently discards without throwing, and `connectCdp` installs no post-open
   `close`/`error` handler to reject pending promises. `close()` does `await
   session.send('Page.stopScreencast').catch(...)`, so it never resolves; the bridge's HTTP server
   (closed only after that await) keeps the event loop alive, so the whole `framework` run hangs
   forever in `settleAgent`'s `finally` (cli.ts:470) — after the agent's work is done — and
   `sharedBrowser.close()` (cli.ts:471) never runs, so a Chrome that is alive-but-detached is never
   killed either. Contradicts the lifecycle intent ("Stop streaming and close the server. Safe to
   call twice.") and `browser.SPEC.md`'s "the agent is never failed over" the browser. Severity:
   **major**. Fix sketch: in `connectCdp`, add `ws.addEventListener('close'/'error', ...)` that
   rejects and clears every `pending` entry, and reject `send` immediately when
   `ws.readyState !== WebSocket.OPEN`. (The follow loop's `await previous.send('Page.stopScreencast')`
   at L218 hangs the same way on a dead `previous`; the same fix cures it.)

2. **L202-224 (follow loop)** — race/leak: the async callback is neither cancelled by `close()` nor
   guarded against overlap. (a) `close()` runs while a callback awaits `listTargets`/`connect`; the
   callback then completes `session = await attach(next)` and starts a screencast on a session that
   nothing will ever stop — `close()` already ran. (b) If one callback's `listTargets`+`connect`
   outlasts `followIntervalMs`, two callbacks both capture `previous = session` (the same S0),
   both attach, both close S0, and the first new session leaks, double-writing every frame to
   viewers. Today the damage is bounded because `settleAgent` kills Chrome right after, but the
   leaked socket/screencast is real while it lasts. Severity: **minor**. Fix sketch: keep a
   `closed` flag checked after each `await` (stop+close the fresh session if set) and a
   `following` in-flight flag that makes an overlapping tick return early.

3. **L89 (`inputToCdp` scroll)** — spec mismatch: `x: input.x ?? 0, y: input.y ?? 0` lets `NaN`/
   `Infinity` through (only `deltaY` is checked), so `{"type":"scroll","x":null…}`-style junk (e.g.
   `x: NaN` serializes to `null`) is dispatched to Chrome and the POST is answered **204**, while
   the sibling click validator rejects the same malformation with 400. `browser-stream.SPEC.md`:
   "Anything unrecognized, malformed… is delivered as nothing at all and reported back as
   rejected, so nothing but real input ever reaches the agent's browser"; the function's own
   contract says "a malformed POST must never reach Chrome". Harm is limited (Chrome rejects the
   call; the error is swallowed), but the reply lies and the call does reach Chrome. Severity:
   **minor**. Fix sketch: `if (!Number.isFinite(input.x ?? 0) || !Number.isFinite(input.y ?? 0)) return []`.
