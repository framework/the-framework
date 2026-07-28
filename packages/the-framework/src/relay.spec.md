The hosted run relay (#230): an HTTP server that ingests a run's `FrameworkEvent` stream and re-serves the dashboard SPA to N remote browsers keyed by run id, so people on different machines watch one run live.

## TLDR

- `startRelay()`: serves the prerendered dashboard bundle + Telefunc exactly like the daemon, except runs come from in-memory `EventStream`s fed by publishers over HTTP, not files.
- Endpoints: `POST /r/:id/publish` (one event or a JSON array), `GET /?run=:id` (the SPA in read-only watch mode), `GET /r/:id` (302 → viewer URL), `POST /_telefunc` (only `onEvents` is live), `/assets/**`, `/healthz`.
- `relayPublisher()`: the client side — forwards a live run's events to a relay, serialized (chained promises) so the relay replays in run order, best-effort (`onError`, never interrupts the run).
- The dashboard opens in single-run watch mode: an `emptyProjectsProvider` neutralizes every file/registry-backed RPC on this public host, and no `startRun` is mounted so a start is never enabled.

## Problems

- Unauthenticated by design (anyone with a run URL can watch; accounts/RBAC layer on later), so any request to `/r/<id>/…` would create a run that never frees — memory exhaustion by anonymous callers. Bounded by an LRU: the insertion-ordered `Map` re-inserts on touch, and overflow (default 200) evicts the least-recently-used run, closing its stream to drain every viewer's Channel follower.
- A public server must never crash on a bad request (#938): unparseable URLs and malformed escapes in the id segment (`/r/%zz/`) answer 400 instead of throwing out of the handler.
- Body ingestion collects raw `Buffer` chunks and decodes once at the end: a per-chunk `String(chunk)` corrupts a multibyte UTF-8 codepoint split across chunks, and the cap (default 256 KiB) counts bytes, not UTF-16 code units. Over-cap answers 413 and destroys the request.
- A relay that accepts but never responds would wedge `flush()` (awaited on shutdown) and hang the CLI on exit — every publish POST carries a 10s `AbortSignal.timeout`.
- `fetch` only throws on transport failure, so a rejected event (413/400/not-a-relay) is turned into an explicit error for `onError` rather than staying silent.

## Decisions

- Create-on-access run streams, so a viewer can connect before the publisher starts.
- Default bind `0.0.0.0:4488` — the relay exists to be reached from other machines; tests bind `127.0.0.1`.
- The relay only projects the stream — it never runs an agent.
- Missing dashboard bundle degrades: SPA routes 404 while publish/telefunc/healthz still work.

## Flows

- publish: `POST /r/:id/publish` → byte-capped body → JSON parse → push each event into the run's `EventStream` → 202 `{ok, received}`.
- watch: `GET /r/:id` → 302 `/?run=:id` → SPA → Telefunc `onEvents(id)` → relay's in-memory stream.
- publish client: `relayPublisher(base, runId)` → `publish(event)` chains a timed POST → `flush()` awaits the chain on shutdown.
