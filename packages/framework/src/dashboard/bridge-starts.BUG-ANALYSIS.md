# Bug analysis: packages/framework/src/dashboard/bridge-starts.ts

## Business logic (high-level)

The in-memory session start-queue of the Claude web bridge (#1328). A web-target run asks the daemon to have the browser extension create a repo-bound cloud session on claude.ai; the extension polls, claims the oldest request, drives the page, and reports the session it became. Invariants per SPEC:

- A request validates repo (`owner/name`, no dot-only segments), branch (plausible git name), prompt (non-empty, ≤ 200k).
- Claiming removes a request from the offerable set in the same step that serves it (single-threaded JS makes claim-then-mark atomic — no await between filter and `byId.set`), so two polling tabs are never handed the same request.
- A claim nobody reports on for `START_CLAIM_TTL_MS` (90s) is offered again (state stays `claimed` but a stale `claimedAt` counts as unheld in `claimNext`'s filter).
- Success without a session id is recorded as failure; a report on a request nobody holds is ignored.
- Nothing survives a daemon restart (deliberate, per SPEC); the run's own timeout is the backstop.

Concurrency: all mutation is synchronous on a `Map`; callers (server.ts HTTP handlers) invoke methods without interleaving awaits inside them, so there are no intra-store races. The one identity gap is the resolve/claim binding (see Bugs).

Lifecycle concerns: settled requests (`created`/`failed`) stay in `byId` forever — `clear()` exists but nothing in the codebase calls it (grep: no callers). Unbounded in principle, but requests are one per web-run start attempt and the CLI is foreground-only (MEMORY.md), so growth is negligible; noted, not reported as a bug. `clear()` is effectively dead code.

## Functions (low-level)

- `request(input, now)` — trims fields, validates via `REPO` / `DOTS_ONLY` / `BRANCH` regexes and prompt bounds, returns the queued `BridgeStartRequest` or a reason string. Edge cases: `owner/.github` passes (leading dot legal), `..` segments refused. The `BRANCH` regex `^[A-Za-z0-9._\-/]{1,255}$` admits strings that are not valid git branch names (`..`, `.`, leading `-`, trailing `/`); the branch travels only to the extension (typed into the claude.ai page), never a shell or a path, so nothing can act on it as syntax — reliance noted, not a bug. Two requests queued in the same millisecond tie on `queuedAt`; `Array.prototype.sort` is stable so insertion order breaks the tie deterministically. Verdict: correct.
- `claimNext(now)` — filters `queued` plus expired `claimed` (`Date.parse(claimedAt) <= now - TTL`), sorts by `queuedAt` ascending, marks the head claimed with a fresh `claimedAt`. `Date.parse('')` is `NaN`, and `NaN <= stale` is false, so a hypothetical claimed entry without `claimedAt` would be held forever — cannot occur since claiming always stamps it. Boundary: expiry is inclusive at exactly TTL. Verdict: correct.
- `resolve(id, ok, sessionId?, note?)` — accepts only when the request exists and is currently `claimed`; `ok` without `sessionId` becomes `failed` with a default note; otherwise settles to `created`/`failed`, deriving `url` from the session id. Edge: `ok=false` with a `sessionId` still records the sessionId/url on a failed entry (harmless; the extension never sends that shape). See Bugs for the claim-identity gap. Verdict: suspicious-but-unproven (see bug 1).
- `get(id)` — plain lookup. Correct.
- `list()` — all requests newest-first by `queuedAt`. Correct.
- `clear(id)` — deletes one entry. Correct in itself; never called anywhere (dead export).
- `bridgeStarts()` / `resetBridgeStarts()` — lazy module singleton + test reset, mirroring `bridge-store.ts`. The singleton is required because the raw HTTP bridge endpoint and the RPC surface reach the store by different routes. Correct.

## Bugs found

1. `L85`: a late report from a superseded claim is accepted. `resolve` only checks `state !== 'claimed'`, but the state is `claimed` again after the retry tab re-claims the same request (an expired claim is re-offered with the same id, refreshed `claimedAt`). Scenario: tab A claims, stalls past the 90s TTL; tab B re-claims; tab A wakes, finishes creating its session and reports first — its report is accepted and settles the request, and tab B's later report (for the session B actually created for it) is then ignored. The doc comment and SPEC promise the opposite: "a tab that died after its claim expired must not overwrite the retry that replaced it" / "A report on a request nobody holds is ignored" — after re-claim somebody does hold it, just not the reporter. Functional harm is limited (both tabs were already told to create a session; whichever reports first wins, and the recorded session is real — the other is orphaned on the user's account either way), which is why this is minor. Severity: minor. Confidence: low that it is contrary to intended behavior rather than an accepted first-report-wins tie-break. Fix sketch: stamp each claim with a token (`claimToken: randomUUID()` set in `claimNext`, returned to the claimer) and require `resolve` to present the current token; a report with a stale token is dropped.
