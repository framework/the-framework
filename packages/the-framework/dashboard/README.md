# The Framework dashboard

The Framework's localhost dashboard: **Vike (SPA) + React + Tailwind v4 + shadcn/ui + Telefunc**,
side-by-side with the current `page.ts` MVP page (which is untouched).

This directory used to be a package of its own, `@gemstack/framework-dashboard`. It is a directory
now: the boundary bought a public export surface, a bundle-copying build step and a task graph to
sequence it, for a dependency that only ever pointed one way.

It is a **projection of the same files the daemon writes** — no daemon process, no
IPC:

- **Projects sidebar** — a Telefunc RPC (`server/projects.telefunc.ts`) over the
  global registry (`../src`'s `listProjects`).
- **Read model** — Telefunc RPCs (`server/reads.telefunc.ts`) for run history, a
  run's replay, the surfaced PLAN/TODO docs, and the committed `LOGS.md`.
- **Live event stream** — a Telefunc Channel (`server/events.telefunc.ts`) tailing
  the selected project's `.the-framework/events.jsonl`; each new line becomes one
  `channel.send(event)`, and the client `.listen()`s. Serialization, type
  validation, and reconnect come from Telefunc.

The `server/*.telefunc.ts` files are re-export shims: the telefunctions themselves live in
`../src/dashboard-rpc/`, so the daemon can serve them without importing anything browser-shaped.
The shims stay because Telefunc bakes each RPC's key from its file path, and those keys are the
wire protocol.

## Run it

```bash
pnpm --filter @gemstack/the-framework dev:dashboard
# open http://localhost:4300
```

Populate a project to watch: run `dev:daemon` instead of `dev:dashboard`, which brings a real
daemon up in the dev server's own process, and start a session from the UI. The dashboard is the
only way to start one — the CLI keeps four options and no verbs, and a session's whole
configuration travels to it as a JSON spec (`--session <path>`), never as flags.

## Tests

`vitest` with a jsdom environment, which is why the package runs two test runners: `node --test`
over the compiled `src/`, then `vitest` over this directory. `pnpm --filter @gemstack/the-framework test`
runs both.
