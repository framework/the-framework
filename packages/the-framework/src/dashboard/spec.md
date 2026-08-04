The daemon-side dashboard host: the HTTP server (static bundle + Telefunc mount + raw routes), the projections of `.the-framework/` files the UI reads, and the outbound integrations (git/gh, Discord webhooks, device relay, browser bridge, browser proxy).

## TLDR

- Server & glue: `server.ts` (route order + the token guard), `telefunc-serve.ts` (the in-process Telefunc mount and the capability-set context — the daemon wires everything, a per-run foreground dashboard wires one project, the relay wires only an event source plus an **empty** projects provider), `static.ts`/`bundle.ts`/`content-type.ts` (serve the prerendered bundle with SPA fallback and traversal guard).
- Projections (all forgiving on read — a missing `gh`, no remote, or a non-repo project costs a page load nothing, never a throw): `overview.ts`, `dashboard.ts`, `queue.ts`, `tickets.ts`, `projects.ts`, `git-status.ts`, `file-diff.ts`/`file-read.ts`/`file-status.ts` (reads confined to the repo path), `open-questions.ts` (every parked gate with its full options, read from each run's log), `docs.ts`, `open-in-app.ts`.
- Integrations: `run-handoff.ts`, `gh.ts`, `cache.ts`, `remote-run.ts` + `relay-endpoints.ts`, `bridge-endpoints.ts` + `bridge-store.ts` (see specs), `browser-proxy.ts`, `activity.ts` + `interventions.ts` + `keyed-watcher.ts` + `keys.ts` (the two notification feeds), `discord-webhook.ts` (one clamped POST that never throws), `bridge-sessions.ts`.

## Decisions

- **Three auth mechanisms, deliberately not merged**: (1) loopback binds get a same-origin check on `/_telefunc` **plus** a `Host`-header check — DNS rebinding is the non-obvious hole: a page whose DNS answers 127.0.0.1 *is* same-origin to the browser, but its `Host` header still says the attacker's name; (2) non-loopback binds demand the shared token on every route; (3) the browser bridge has its own bearer token checked *before* the token guard, whose `?token=` 302 affordance is for a human clicking a link, meaningless to an extension.
- The token rides a **cookie**, not a bearer header, because it must reach RPCs, the events channel *and* the MJPEG `<img>` alike — a header cannot reach an `<img>`. `SameSite=Lax`, because the device hop is a cross-origin top-level navigation that Strict would break. Comparisons are constant-time.
- `browser-proxy.ts`: the dashboard cannot reach a run's browser bridge directly (different origin, and answering CORS would surrender the containment of keeping Chrome's debug port off the web). The daemon proxies instead, and **the client never names the port** — it comes from the run's own meta, and only for a running run. That is what stops the proxy being an open relay into anything else on loopback.
- Notification watchers share one engine: the first poll only seeds a baseline (a daemon start never flushes a backlog), and the cursor advances even while notifications are off — turning them on starts from now. Identity keys live in a leaf module shared with the browser notifier, because a drifted key silently double-notifies or never notifies.
- Read `gh` is capped at 8s and swallows; write `gh` waits longer and rejects with stderr — a user is waiting on the button.

## Facts

- Telefunc 0.2.x throws on a bare `GET /_telefunc` (a browser tab hits that on reconnect), so the serve call is wrapped — an unhandled rejection would kill the daemon.
- The same repo registered twice (monorepo root + subdirectory) is deduplicated by intervention key.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
