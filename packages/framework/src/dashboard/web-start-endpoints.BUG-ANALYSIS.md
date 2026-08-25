# Bug analysis: packages/framework/src/dashboard/web-start-endpoints.ts

## Business logic (high-level)

The run-facing side of the Claude-web session start-queue (#1328), per `web-start-endpoints.SPEC.md`: a daemon-spawned `web` run cannot touch the daemon's in-process queue, so it POSTs `/_web-start` (queue a request) and GETs `/_web-start/<id>` (follow it), authenticated with the daemon token as a bearer. Wired in server.ts *before* the shared token guard, sharing `bridgeStarts()` with the extension's `/_bridge/start`+`/_bridge/started` faces.

- **Off with the bridge**: `handlers === undefined` → 404 for every route (server.ts only builds handlers when `bridgeToken` is set). Matches SPEC. (The 404 body says "bridge not enabled" — an unauthenticated caller learns the bridge is off; presence-only info, harmless.)
- **Token first**: `bearerAuthorized` (constant-time, length-checked, from bridge-endpoints.ts) runs before any body read, so an unauthenticated caller cannot make the daemon buffer.
- **409 with no extension**: `extensionAlive()` checked before the body read too — the SPEC's "answer at once" and also avoids buffering for a doomed request. Note the ordering means a malformed body with no extension around reports 409, not 400 — consistent with "refused on the spot with that reason".
- **Validation split**: route checks types (repo/branch/prompt strings, body an object, 512KB cap via `readJsonBody` which rejects past the cap); the queue's own `request()` enforces content rules (repo slug shape incl. dot-segment refusal, branch charset, non-empty prompt, 200k prompt cap) and returns a string reason → 400. Matches "validated as the queue validates it".
- **Polling**: id must match `/^[A-Za-z0-9-]{1,64}$/` (UUIDs fit; traversal shapes like `../x` fail → 404, pinned by tests); unknown id → 404; response carries `state` plus `sessionId`/`url`/`note` when present — exactly the SPEC's queued/claimed/created/failed vocabulary.

Concurrency/failure modes:

- The route is `void`-dispatched from server.ts, so a rejection would be an unhandled rejection. Verified no rejection path: the only await that can reject (`readJsonBody`) is try/caught; `handlers.extensionAlive/request/get` are synchronous store calls that do not throw (BridgeStarts methods are pure map/regex work; `request` returns error strings instead of throwing).
- Any bearer-authorized caller can poll any id — ids are random UUIDs and the caller already holds the daemon token, so there is no privilege gap.
- Two runs posting concurrently each get their own UUID; the claim side is serialized inside `claimNext` (bridge-starts), not here — correct separation.

## Functions (low-level)

- **`handleWebStartRequest(req, res, pathname, handlers)`** — 404 when off → 401 without bearer → exact-prefix POST route → `<id>` GET route → 404. `pathname.slice(WEB_START_PREFIX.length + 1)` before the `startsWith` check computes a junk id for non-matching paths, but the `startsWith && ID.test` guard makes that harmless (`/_web-start/` yields `''` which fails the regex → 404). Verdict: correct.
- **`handleRequest(req, res, handlers)`** — POST-only (405 + `allow`), 409 without extension, body read/validated, queue or 400 with the queue's reason, 202 + `{id}`. Verdict: correct.
- **`handleState(req, res, id, handlers)`** — GET-only, 404 unknown, JSON state with conditional fields (spread pattern drops absent/empty values; an empty-string `note` would be dropped — never produced, `resolve` only stores truthy notes). Verdict: correct.
- **`end(res, status, message, headers)`** — plain-text terminator with extra headers (used for `allow`). Verdict: correct.
- **Constants** — `MAX_BODY` 512KB (prompt cap is 200k chars, so a legit request fits with framing margin), `ID` regex, `WEB_START_PREFIX`, `DAEMON_URL_ENV` (consumed by the spawner/run). Correct.

## Bugs found

None found.
