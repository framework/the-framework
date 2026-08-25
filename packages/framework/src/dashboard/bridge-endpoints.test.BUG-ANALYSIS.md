# Bug analysis: packages/framework/src/dashboard/bridge-endpoints.test.ts

## Business logic (high-level)

Exercises the bridge over a real HTTP server wired the way `startDashboard` wires it (the `serve`
helper), so the pinned behavior includes the transport: token auth before body read, the off
switch, field-by-field validation with reasons, the oversize cap, method gating, no CORS, the
answer round trip, the version gate (#1519) including its manifest lockstep, and the start-queue
claim-on-read (#1328). Coverage tracks `bridge-endpoints.SPEC.md` section by section.

Verification quality, test by test:

- **Stamping**: posts a caller-supplied `receivedAt` and asserts the daemon's injected `now` wins.
  Exactly the "daemon's to stamp" rule. ✓
- **#1554 flags**: asserts the *entire* recorded object via `deepEqual` — multi/default/stop
  travel, false flags and unknown keys dropped. The strongest possible form. ✓
- **Off switch**: undefined handlers → 404, nothing recorded. ✓
- **Auth**: the `post` helper's `null`-vs-default-token design (documented in a comment) avoids
  the classic silently-authenticated-401-test bug; wrong token, missing token, and *wrong-length*
  token (the `timingSafeEqual` throw hazard) all asserted 401 with nothing recorded. ✓
- **Validation table**: 12 bad payloads, each asserting status 400 *and* a reason regex naming
  the offending field — including the two rationale cases (recommendation matching nothing,
  duplicate labels). ✓
- **Oversize**: accepts either a 400 or a torn socket (the daemon destroys past the cap) but
  insists nothing was recorded — the invariant that matters. ✓
- **Methods + ping**: GET on `/question` → 405; ping 200 with the load-bearing literal `ok` body
  (told apart from the SPA fallback); unauthenticated ping → 401. ✓
- **No CORS**: asserts the header's absence on a live response. ✓
- **Answer round trip**: queued answer served with exact id/text, unknown session → null, bad id
  → 400, ack lands with all fields, bad ack → 400; separate tests pin 401s on both answer routes
  and the null degrade with no wired source. ✓
- **Version gate**: no header → 426 naming `unknown`, the expected version and the
  chrome://extensions remedy; wrong version blocked on ping too (no degraded mode); matching
  version passes; all three claims recorded in order (what clears a blocked banner). A second
  test proves unauthenticated callers never reach the gate (no claims recorded). ✓
- **Lockstep**: reads the real `chrome-extension/manifest.json` relative to the compiled test and
  compares to `EXPECTED_EXTENSION_VERSION` — fails on a one-sided bump. Path arithmetic checked:
  `dist-test/dashboard/ → ../../../ → packages/chrome-extension/manifest.json` exists and holds
  `0.11.0`. ✓
- **Start queue**: claim-on-read pinned by two sequential polls (first gets the request, second
  gets null), the started report's fields echoed, the no-queue degrade (start null, ack accepted
  and dropped), the report's field-by-field validation, 401s on both routes, and POST on `/start`
  → 405. ✓

Test hygiene: every server closed in `finally` with `closeAllConnections` (no hangs); fixtures use
a valid-looking session id; `serve` always overrides `record` to capture into `got` — tests that
pass their own `record: () => {}` are aware it is replaced (only `got` is asserted). Sound.

## Functions (low-level)

- `serve(handlers)` — real `createServer` + `handleBridgeRequest`, port 0, returns url/got/close.
  Correct.
- `post(url, body, token)` — JSON POST to `/question`, string bodies passed raw (the not-JSON
  case). Correct.
- 16 `test()` blocks — all awaited, all falsifiable.

## Bugs found

None found.
