# @gemstack/framework-dashboard (prototype)

De-risking prototype for the dashboard rebuild (#405 / #406). Rebuilds The Framework's
localhost dashboard on **Vike (SPA) + React + Tailwind v4 + shadcn/ui + Telefunc**,
side-by-side with the current `page.ts` MVP page (which is untouched).

It is a **projection of the same files the daemon writes** — no daemon process, no
IPC:

- **Projects sidebar** — a Telefunc RPC (`server/projects.telefunc.ts`) over the
  global registry (`@gemstack/the-framework`'s `listProjects`).
- **Read model** — Telefunc RPCs (`server/reads.telefunc.ts`) for run history, a
  run's replay, the surfaced PLAN/TODO docs, and the committed `LOGS.md`.
- **Live event stream** — a Telefunc Channel (`server/events.telefunc.ts`) tailing
  the selected project's `.the-framework/events.jsonl`; each new line becomes one
  `channel.send(event)`, and the client `.listen()`s. Serialization, type
  validation, and reconnect come from Telefunc.

## Run it

```bash
pnpm --filter @gemstack/the-framework build   # the dashboard reads its registry + types
pnpm --filter @gemstack/framework-dashboard dev
# open http://localhost:4300
```

Populate a project to watch: run `pnpm dev:daemon` instead of `pnpm dev`, which brings a real
daemon up in the dev server's own process, and start a session from the UI. The dashboard is the
only way to start one — the CLI keeps four options and no verbs, and a session's whole
configuration travels to it as a JSON spec (`--session <path>`), never as flags.

## Scope

Thin slice only — no feature parity with the MVP page. The point is to judge the
component model + shadcn + Telefunc wiring. Full port + per-project live streaming
(#393) + production serving (daemon serves the built bundle) are later phases of #405.
