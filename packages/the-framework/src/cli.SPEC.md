The framework command: serves the dashboard in the foreground, and runs one agent from the spec the dashboard hands it.

## TLDR

- Four options and no verbs: `--host` and `--port`, because they are the two things a browser cannot be asked and a dashboard cannot serve about itself, plus `--help` and `--version`. Everything else is the dashboard, which is the product's user interface.
- One more, not for humans: `--agent <path>` runs the agent described by a JSON spec. That is how the dashboard spawns one, and it replaced sixty-seven flags — twenty-seven of which had no human user at all, being `StartAgentOptions` serialized onto a command line.
- A live agent gets everything around the driver: settings resolved across config layers, persisted events, the steering channel, the browser, and live chat. It serves no dashboard of its own — the one that spawned it reads its event log off disk and steers it through the control file.
- Three shapes share that wiring: the full build flow, a verbatim prompt (research included), and transparent mode — the driver completely raw.
- Every agent settles identically: the quality follow-up if asked for and earned, then the handoff — commit what it left, push the branch, open a draft PR, merge only when authorized — then a project-log entry, written even for agents that stopped or crashed.
- Settings that cannot apply say so before the spending; a stopped agent never publishes — publishing what it happened to reach is the opposite of what stopping meant.
- Once an agent starts it is never interrupted for quota. The gate is on starting, and it lives with the daemon that decides whether to start unattended work at all.
- Ctrl+C aborts the agent itself, the driver's process tree included; a second press force-quits.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
