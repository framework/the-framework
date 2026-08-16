# The Framework dashboard

The Framework's localhost dashboard: **Vite + React + Tailwind v4 + shadcn/ui**, talking to the
daemon over plain HTTP.

This directory used to be a package of its own, `@gemstack/framework-dashboard`. It is a directory
now: the boundary bought a public export surface, a bundle-copying build step and a task graph to
sequence it, for a dependency that only ever pointed one way.

It is a **projection of the same files the daemon writes** — no daemon process, no
IPC:

- **Reads** — `POST /_rpc/<name>` (`rpc/reads.ts`, `rpc/projects.ts`, …) for run history, a run's
  replay, the surfaced PLAN/TODO docs, and the committed `LOGS.md`.
- **Live event stream** — Server-Sent Events at `GET /_rpc/events` (`rpc/events.ts`) tailing
  the selected session's `.the-framework/events.jsonl`; each new line becomes one SSE frame.

The `rpc/` modules are typed stubs: each is declared against the implementation's own signature in
`../src/dashboard-rpc/`, so a renamed or re-shaped RPC is a type error here rather than a 404 in
the browser. Nothing from those implementations reaches the bundle — the imports are type-only.

There used to be an RPC framework in this seam (Telefunc). It required a build-time transform over
every `.telefunc.ts` file, a registration table pinning each call to the client-baked path of the
shim it was re-exported from, a shim per module to keep those paths stable, and a dev-server plugin
to undo a URL its own client wrote. What it bought was type-safety across a package boundary, which
merging the package removed.

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
