The product: the `framework` npm package. One CLI, `the-framework`, runs a foreground daemon that serves the dashboard, spawns agents, and does the background work; Ctrl-C closes the daemon and every agent it is running.

How the package's pieces relate:

- `src/` — everything that runs in Node: the CLI, the daemon, the agent lifecycle (checkouts through the `skill-branches` package, gates, handoff), the drivers (the agent-driver package's, plus the product's own hand-off to a Claude Code cloud session), the `agents-logs` branch its own records live on (the tickets and the queue are the `skill-tickets` package's), autonomy (Auto PM, sweeps, CI watch), and the server side of the dashboard.
- `dashboard/` — the browser app the daemon serves: a single-page app that is a pure projection of the files the daemon writes, reading over `POST /_rpc/<name>` and a live event stream, and steering agents back through the same daemon.
- `prompts/` — every prompt The Framework sends an agent, as markdown: the built-in system prompt, the protocols agents answer through, and the presets. The markdown is the only source of truth for agent-facing text.
- `scripts/` — the build steps that compile the prompts into importable strings and run the package's test suites.

The split that shapes everything: the dashboard is a projection, never a peer. An agent appends its events to a file, the daemon tails the file to the browser, and steering flows back through another file — there is no agent-to-daemon IPC, so any surface (dashboard, terminal, a replay of a finished agent) renders the same record.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
