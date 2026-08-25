# Bug analysis: packages/framework/src/dashboard/bridge-endpoints.ts

## Business logic (high-level)

The daemon half of the Claude web bridge (#1237): the `/_bridge/*` routes the Chrome extension
calls. Security posture per `bridge-endpoints.SPEC.md`: bearer token on every route (the one
surface meant to be reached cross-origin), refused *before* the body is read; deliberately no CORS
headers; a tiny fully-validated input surface (no path/command/free text inbound — the one free
text, a start request's prompt, travels *out*); an exact-match extension version gate (#1519)
behind the token; feature-off → 404 before any check; every contact recorded, refusals included.

Checked route by route:

- **Off switch**: `!handlers → 404` before token/version. ✓
- **Auth**: `bearerAuthorized` — prefix check, length check (avoids `timingSafeEqual`'s throw),
  constant-time compare. Runs before any body read on every route. Length-mismatch early return is
  the standard, documented trade. ✓
- **Version gate**: after the token (unauthenticated callers learn nothing), applies to *every*
  route including ping (no degraded mode); absent/array header → `'unknown'` (capped 32 chars);
  the claim and verdict reported via `extensionVersion`; 426 message names both versions and the
  fix. Manifest lockstep held (`0.11.0` on both sides, verified on disk). ✓
- **`/question`**: POST-only; body ≤ 64KB; `validate` checks every field with a reason —
  session-id shape, title 1..500, options 1..20 each with label 1..300 / detail ≤ 500 / boolean
  flags, distinct labels (labels double as pick ids), recommendation must name a present option
  (an empty-string recommendation passes the checks and is then dropped — consistent), false
  flags and unknown keys dropped; `receivedAt` stamped by the daemon, never the caller. ✓
- **`/events`**: 404 when no collector; batch ≤ 50, body ≤ 512KB (50 × 8000-char texts fit),
  integer seq 0..10000, role ∈ {agent,user}, non-blank text truncated to 8000; all-or-nothing per
  batch (a partial accept would forge sequence gaps). ✓
- **`/hello`**: deliberately lenient (diagnosis must work when things are broken); fields
  defaulted/truncated, session id validated or dropped. ✓
- **`/answer`**: GET, validated sessionId, always 200 `{answer: …|null}` (pollable blindly, null
  on an unwired daemon). ✓
- **`/answered`**: field-by-field validation (id ≤ 64, ok boolean, optional note truncated 300),
  handler optional. ✓
- **`/start`**: GET that claims — the callee dequeues in the same step, so two polling tabs
  cannot both receive one request (the duplicate that matters is a second cloud session); null on
  no queue. ✓ per the SPEC's explicit rationale.
- **`/started`**: id ≤ 64, ok boolean, optional session id (shape-checked), note ≤ 1500 (the
  failure note is the run's only diagnosis). ✓
- **`/sessions`**: GET; unwired or failing lister → `{sessions: []}` (an older daemon degrades to
  doing nothing, not a fault). ✓
- **Contact recording**: `seen` hooks `res` 'finish' before auth, so 401/404/426 are recorded too
  — the point (#1237 diagnosis). A connection torn down before 'finish' (e.g. the oversize
  destroy) records nothing; acceptable, the request never completed.
- **`readJsonBody`**: caps by accumulated size, rejects then `req.destroy()` (the settled promise
  ignores the later 'end'); the boundary chunk is not buffered; empty body → JSON parse error →
  400. The destroyed socket may kill the in-flight response — the test explicitly accepts either
  outcome. ✓
- Handler exceptions: the store-backed handlers wired by `server.ts` (`record`, `recordEvent`,
  `answered`…) are simple Map/field writes that cannot throw; `sessions` is the one async handler
  and it is caught. A hypothetical throwing handler would reject `handleBridgeRequest`, which
  `server.ts` invokes with `void` — an unhandled rejection — but no reachable handler throws;
  defensive-only, noted, not reported.

## Functions (low-level)

- `handleBridgeRequest` — router as analyzed; unknown `/_bridge/*` path → 404; exact-match paths
  (a trailing slash 404s — fine, the extension builds exact URLs). Correct.
- `bearerAuthorized` — correct.
- `handleQuestion` / `validate` — correct; `options` accumulation preserves order; conditional
  spreads keep false flags absent (matching the store's fingerprint stability).
- `handleHello` — correct.
- `handleEvents` / `validateEvents` — correct; duplicate seqs within one batch resolve
  last-wins downstream in the store (documented replace-on-reread semantics).
- `handleAnswer` — `new URL(req.url ?? '', 'http://bridge.invalid')` — safe parse. Correct.
- `handleAnswered` / `handleStart` / `handleStarted` / `handleAgents` — correct as analyzed.
- `readJsonBody` — correct.
- `end` — plain-text responder; a `content-type` on a 204 is harmless. Correct.
- `seen` — correct.

## Bugs found

None found.
