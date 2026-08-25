# Bug analysis: packages/framework/src/browser-stream.test.ts

## Business logic (high-level)

Tests for the browser preview bridge, matching `browser-stream.test.SPEC.md` point for point:
page selection (MRU tab, skip non-pages and socketless tabs, empty browser → nothing), following
(re-attach on a new first tab + stop the old screencast, survive a browser that stops answering),
announcements (first real page, in-place navigation, tab switch, dedupe, silence on `about:blank`),
input mapping (press+release click, `insertText` typing, http(s)-only navigation, malformed → `[]`,
junk POST → 400 with nothing dispatched), painting (last frame delivered on connect, repeat
produces additional MJPEG parts, a departing viewer doesn't take the bridge down), and lifecycle
(loopback-only URL, idempotent close, port freed, `Page.stopScreencast` sent).

The harness is honest: `fakeCdp()` records `send` calls and lets a test push a frame through the
registered handler, so assertions are on observable CDP traffic and real HTTP responses against
the real server on an ephemeral port — not on internals. Timing-based tests (follow at 20ms, waits
of 80–120ms) leave generous margins; the #818 repeat test is explicitly bounded (5s deadline,
1s per-read race) and counts boundaries across chunks rather than pinning an exact number, with a
comment explaining why — good flake hygiene.

What the tests cannot catch (gaps that let the source bugs through, recorded here as coverage
notes, with the bugs themselves filed against `browser-stream.ts`):

- `fakeCdp().send` always resolves, so the dead-WebSocket case — where the real `connectCdp`'s
  `send` never settles and `close()` hangs forever — is unreachable by construction. A test whose
  fake session's `send` returns a never-settling promise after a simulated disconnect would pin
  the intended "close is always safe" behavior.
- No test drives a `close()` racing an in-flight follow re-attach, or an overlapping slow follow
  tick (the session-leak races).
- The malformed-input test covers click NaN, empty key text and a bogus type, but not scroll with
  non-finite `x`/`y` — exactly the case the source forwards to Chrome and answers 204.

## Functions (low-level)

- **`page(over)`**: target factory with sane defaults. Correct.
- **`fakeCdp()`**: records sent calls; keeps only the last registered frame handler (the real
  session registers exactly one — fine); `frame(data)` pushes a base64 frame. Correct for its use.
- **`rejection`-free style**: every async test awaits its fetches/reads and closes the stream in
  `finally`, so a failing assertion cannot leak a listening server into the next test. Correct.

Per test:

- **pickActivePage tests (L21-38)**: assert MRU pick, skipping of `service_worker` and a
  socketless page, and `undefined` on empty. Match the source contract. Correct.
- **click/key/malformed/navigate (L40-62)**: assert the CDP shapes (press+release order, insertText
  passthrough of non-ASCII, `[]` for NaN click / empty text / bogus type, http(s)-only navigation
  including the `javascript:`/`file:` refusals). All assert what they claim. Correct.
- **framePart (L64-70)**: header prefix, byte length, trailing CRLF via latin1 round-trip. Correct.
- **MJPEG serve (L89-113)**: asserts `Page.startScreencast` was sent, the content-type/boundary,
  and that a frame pushed *before* any viewer is delivered on connect (first read non-empty).
  Reader cancelled, stream closed. Correct.
- **input POST (L115-135)**: 204 + dispatch for a click; 400 + `sent.length` unchanged for junk.
  The unchanged-length assertion is the strong half (nothing reached Chrome). Correct.
- **loopback (L137-149)**: asserts the URL prefix `http://127.0.0.1:` — the bind address is what
  `server.listen(0, '127.0.0.1')` used; good enough as a pin. Correct.
- **no page / unlistable browser (L151-169)**: both resolve `undefined`, no throw. Correct.
- **onPage announcements (L171-202)**: initial announce, in-place navigation announce, dedupe on
  re-poll, tab-switch announce — each step separated by 120ms against a 20ms follow interval.
  Deep-equals on the accumulated list make ordering and dedupe real assertions. Correct.
- **about:blank silence (L204-218)**: stream exists, `pages` stays empty. Correct.
- **tab following (L220-247)**: second session attached, `startScreencast` on it, `stopScreencast`
  on the first. Correct.
- **survives unanswering browser (L249-271)**: flips `listTargets` to throwing, asserts `/stream`
  still 200. Correct.
- **repeat paints (L273-313)**: at least two `--frame` boundaries out of one pushed frame, bounded.
  Correct.
- **repeat stops when nobody watches (L315-338)**: the *name* claims the repeat stops, but the
  assertions only show the bridge still serves after a viewer cancels — i.e. it pins "a viewer
  leaving must not take the bridge down", which is the comment's real point and the test-SPEC's
  wording. The "no write into a closed response" half is unasserted (and, probed, would be silent
  anyway on Node 22). Slight name/assertion mismatch; not a test bug — it can fail if the server
  dies, which is what it guards.
- **close (L340-352)**: double close, `stopScreencast` sent, port refusal via
  `assert.rejects(fetch(...))` — awaited. Correct.

## Bugs found

None found. (Coverage gaps for the source's dead-socket hang, follow races, and scroll-NaN
forwarding are listed above; the corresponding defects are recorded against
`packages/framework/src/browser-stream.ts`.)
