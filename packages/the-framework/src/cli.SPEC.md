The framework command: serves the dashboard in the foreground, and runs one session from the spec the dashboard hands it.

## TLDR

- Four options and no verbs: `--host` and `--port`, because they are the two things a browser cannot be asked and a dashboard cannot serve about itself, plus `--help` and `--version`. Everything else is the dashboard, which is the product's user interface.
- One more, not for humans: `--session <path>` runs the session described by a JSON spec. That is how the dashboard spawns a session, and it replaced sixty-seven flags — twenty-seven of which had no human user at all, being `StartRunOptions` serialized onto a command line.
- A live session gets everything around the agent: settings resolved across config layers, prerequisite checks, persisted events, the steering channel, the browser, the spend gate, live chat, and the committed conversation.
- Three session shapes share that wiring: the full build flow, a verbatim prompt (research included), and transparent mode — the wrapped agent completely raw.
- Every session settles identically: the quality follow-up if asked for and earned, then the handoff — commit what the agent left, push the branch, open a draft PR, merge only when authorized — then a project-log entry, written even for sessions that stopped or crashed.
- Settings that cannot apply say so before the spending; a stopped session never publishes — publishing what it happened to reach is the opposite of what stopping meant.
- Ctrl+C aborts the session itself, the agent's process tree included; a second press force-quits.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
