`@gemstack/framework-dashboard` — the localhost dashboard UI: a fully prerendered Vike + React + Tailwind + shadcn (Base UI) + Telefunc single-page app, served by the product's daemon as static files.

## TLDR

- **The dashboard is a projection**: every read is a Telefunc RPC over the same `.the-framework/` files the daemon writes; every write is a Telefunc call into the daemon's own closures. It holds no authoritative state — the only truly client-owned state is device connection profiles (localStorage, a per-browser secret) and the in-memory remote-run target.
- Private and never published: the build emits one static shell + assets, which a product-side script copies into `@gemstack/the-framework`'s published `dist` (Turborepo resolves the apparent dependency cycle: the package depends on the framework as a module, the framework depends on the package's *build output*).
- **Live vs polled is a deliberate split**: exactly one streaming subscription exists (the run-events channel, bound to that run's own journal); everything else polls at rates from 2s (runs) to 30s (quota).
- **Routing is the selection**: `/`, `/{projectId}`, `/{projectId}/{sessionId}` — replacing three pieces of reconciled React state that repeatedly disagreed about which run was in play. A route cannot disagree with itself, and a session becomes a link you can paste, reload, and open twice side by side.
- Map: `components/spec.md` (view layer), `lib/spec.md` (the real client logic), `server/spec.md` (the RPC shims). `pages/` is four tiny load-bearing files (the always-true route function that makes every path resolve to the one page; the prerender hook without which the build emits **no** index.html; the 400-line shell that owns polls, live events, optimistic starting rows, and run adoption).

## Problems

- **Prerender ⇄ SPA seam**: one `/` shell is prerendered, so build-time route params are frozen — everything reads the live pathname instead, and every module-level store has a server-snapshot branch (storage access try/caught, frozen empties, media queries only in effects).
- **The daemon-down story** needs three independent signals, because each alone is ambiguous: a page-wide health probe (polls keep their last value and channels retry silently, so a dead daemon otherwise looks like a quiet agent), a feed-level `lost` banner from an errored channel close, and a clean `done` close (relay ended / unknown run) that is final and neither retries nor alarms.

## Decisions

- Anything shared between dashboard and daemon is imported from the framework's browser-safe `/client` entry (agent vocabulary, preset lists, routine catalog, option mappings, event projections, notification identity) — a second copy is how the two drift.
- The word "session" in URLs is the **run id**; the agent's own conversation id (used for resume) is a different thing with the same name — a naming trap the code lives with deliberately.
- Slow daemon reads surface as `pending` (via the framework's read-through cache), and the handoff panel drops its poll from 15s to 1s while a PR lookup is in flight.
- Standalone development: plain `pnpm dev` is a UI harness with no daemon (reads work in-process, starts are disabled); an opt-in env flag brings up the *real* daemon and proxies `/_telefunc` to it — kept out of the default so a dev server never spawns a hidden detached process. A static two-theme design gallery (`design/`) renders real components where possible and labels hand-copies as replicas, because silent copies are exactly the drift it exists to catch.

## Facts

- The Vite config carries real dev-only logic: the daemon proxy plugin, and a URL rewrite fixing Telefunc's dev middleware declining its own `?_telefunc=` requests (Vike's catch-all then answered RPCs with the HTML shell).
- Tests use a separate Vitest config without the Vike/Telefunc plugins; Testing Library's async timeout is raised because Base UI portals its menus; tooltip tests re-fire hover events on every retry.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
