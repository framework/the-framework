The showable end-to-end demo for `@gemstack/the-framework`: one prompt driven through the real `runFramework` with the built-in fake driver, ending at an app that is genuinely running locally plus a simulated Cloudflare deploy — offline and deterministic.

## TLDR

- Seeds a temp dir with a tiny but real Node "orders app" (`server.js` serving an Orders HTML table) and a `package.json`, on an ephemeral free port.
- Calls `runFramework` with `fakeDriver()`, the package's `FAKE_INTENT`/`FAKE_SIGNALS`/`FAKE_DEPLOY` fixtures, a serve gate (`node server.js`, `keepAlive: true`), and the real `cloudflareTarget` over a `simulatedCloudflare` session whose wrangler/deploy commands print a `workers.dev` URL.
- Two things are real, not narrated: the serve gate boots an actual HTTP server which the demo `fetch`es to prove it serves, and the deploy exercises the real `cloudflareTarget` adapter path.
- Narration: every framework event goes through `formatFrameworkEvent` to the `onLine` callback.
- Returns `DemoOutcome`: detected framework, production-grade + passes, deploy target/URL, preview URL, and the first bytes the app served.

## Decisions

- `freePort()` grabs an ephemeral port via a throwaway `net` server so the demo never collides with something already bound.
- `keepAlive: true` leaves the app running after the run so it can be fetched; cleanup (`preview.stop()` + `rm` of the temp dir) happens in `finally`, so no processes or files are left behind.
- Same code path as a live run — only the agent turns are scripted — which is the point: this is the artifact to show people (README / the-framework.ai / Discord).

## Facts

- The simulated deploy URL is `https://orders-app.gemstack.workers.dev`; `DEMO_INTENT` re-exports `FAKE_INTENT` from `@gemstack/the-framework`.

## Flows

- `runDemo: mkdtemp + write server.js/package.json → freePort() → runFramework({intent, fakeDriver, signals, serve, deploy, deployTarget, onEvent}) → fetch(preview.url) → DemoOutcome; finally preview.stop() + rm(dir)`
