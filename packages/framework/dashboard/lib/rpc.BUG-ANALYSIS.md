# Bug analysis: packages/framework/dashboard/lib/rpc.ts

## Business logic (high-level)

The dashboard's whole transport (F3): `rpc<F>(name)` builds a typed stub POSTing JSON args to `/_rpc/<name>`, and `openEvents` reads the SSE live feed with the clean-close-vs-dropped distinction the SPEC centres on. Same-origin by construction (cookies ride automatically).

`rpc` invariants: a non-JSON body (proxy page, HTML error) is reported as "`<name>` got a non-JSON reply (status)" rather than a JSON.parse stack from a component; a non-ok status throws the daemon's own `error` when present, else a status-labelled message; an empty body parses as `{}` (so a 204-ish reply resolves `undefined`). A 200 carrying `{error}` is ignored in favour of `ret` — the mount never does that, accepted coupling.

`openEvents` invariants, checked against the SPEC:

- **Subscribe failure rejects** (non-ok or bodyless response) → caller retries. Holds.
- **Clean vs dropped** — server-ended stream (`done`) → `finish()` with no error; reader throw → `finish(err)`; our own `close()` aborts and `finish()`s *synchronously first*, so the subsequent AbortError in the reader loop hits the `closed` guard (and would in any case be mapped to a clean close via `controller.signal.aborted`). Both paths idempotent through the `closed` flag. Holds.
- **A damaged event does not kill the feed** — per-frame `JSON.parse` in try/catch. Holds.
- **SSE framing** — frames split on `\n\n` (the daemon writes LF; CRLF framing would silently never split, an accepted coupling to our own server), `data:` lines extracted, `.slice(5).trim()` tolerating the optional space, multiple data lines joined with `''` rather than the spec's `\n` — fine for the single-line JSON the daemon emits, would corrupt a multi-line event (never produced). Heartbeat/comment frames yield empty `data` and are skipped. Partial frames buffer across reads (`decoder.decode(value, {stream:true})` keeps split multi-byte chars intact).

Edge worth recording (not reported): `onClose(cb)` invokes `cb()` with *no error* when registered after the channel already closed — if the stream died with an error in the microtask gap between `openEvents` resolving and the caller registering, the drop would masquerade as a clean end. Callers register synchronously after the await, and the reader's first `read()` cannot settle before that continuation runs, so the window is unreachable in practice.

Resource lifecycle: `close()` aborts the fetch, which rejects the pending `read()` and ends the IIFE — no dangling reader. Replacing `listen`/`onClose` callbacks swaps rather than accumulates. No unhandled rejection: the IIFE catches everything; `finish` never throws.

## Functions (low-level)

- `rpc(name)` — generic bound to the implementation's signature (`Parameters<F>` / `Awaited<ReturnType<F>>`), so a renamed RPC is a compile error. Body `JSON.stringify(args)` (array), content-type set. Verdict: correct.
- `openEvents(projectId, agentId?)` — `URLSearchParams` handles encoding; `agentId` omitted when falsy. Reader loop as analysed. Returns the channel object; `listen`/`onClose`/`close` as documented. Verdict: correct.
- `finish(err?)` — once-only latch + callback dispatch. Verdict: correct.

## Bugs found

None found.
