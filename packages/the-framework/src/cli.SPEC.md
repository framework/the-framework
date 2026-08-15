The framework command: parses what was typed, dispatches the subcommands (dashboard in fore- or background, health check, stop, replay, relay, maintenance sweep, worktree cleanup), and wires a live run end to end.

## TLDR

- A live run gets everything around the agent: settings resolved across config layers, prerequisite checks, its dashboard, persisted events, the steering channel, the browser, the spend gate, live chat, and the committed conversation.
- Three run shapes share that wiring: the full build flow, a verbatim prompt (research included), and transparent mode — the wrapped agent completely raw.
- Every run settles identically: the quality follow-up if asked for and earned, then the handoff — commit what the agent left, push the branch, open a draft PR, merge only when authorized — then a project-log entry, written even for runs that stopped or crashed.
- Flags that cannot apply say so before the spending; a stopped run never publishes — publishing what it happened to reach is the opposite of what stopping meant.
- Ctrl+C aborts the run itself, the agent's process tree included; a second press force-quits.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
