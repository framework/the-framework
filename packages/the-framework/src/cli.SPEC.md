The framework command: serves the dashboard in the foreground, and runs one agent from the spec the dashboard hands it.

## User Stories

- The user starts the whole product with one command: `the-framework` serves the dashboard in the foreground.
- The user chooses where the dashboard listens with `--host` and `--port`.

## Flows

- Four options and no verbs: `--host` and `--port`, plus `--help` and `--version`. Everything else is the dashboard, which is the product's user interface.
- One more, not for humans: `--agent <path>` runs the agent described by a JSON spec. That is how the dashboard spawns one.
- A live agent gets everything around the driver: settings resolved across config layers, persisted events, the steering channel, the browser, and live chat. It serves no dashboard of its own — the one that spawned it reads its event log off disk and steers it through the control file.
- Three shapes share that wiring: the full build flow, a verbatim prompt (research included), and transparent mode — the driver completely raw.
- Every agent settles identically: the quality follow-up if asked for and earned, then the handoff — commit what it left, push the branch, open a draft PR, merge only when authorized — then a project-log entry, written even for agents that stopped or crashed.
- Settings that cannot apply say so before the spending; a stopped agent never publishes.
- A build whose bookkeeping layout differs from the one the repo records is refused before it writes anything, with both layouts and the fix named.
- Once an agent starts it is never interrupted for quota. The gate is on starting, and it lives with the daemon that decides whether to start unattended work at all.
- Ctrl+C aborts the agent itself, the driver's process tree included; a second press force-quits.

## Rationales

- `--host` and `--port` are the whole human option surface because they are the two things a browser cannot be asked and a dashboard cannot serve about itself.
- The agent spec is a file rather than command-line flags because an agent's options are a machine-written start request — most of them nothing a human would ever type.
- A stopped agent never publishes because publishing what it happened to reach is the opposite of what stopping meant.
- The layout check fails before anything is written because the stale published build a cloud environment installs must fail in seconds with the cause, not hours later at the main branch's guard.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
