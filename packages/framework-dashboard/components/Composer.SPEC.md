The shared run composer: the prompt editor plus its control row — presets, context, agent and model, options, send — used by the launcher to start sessions and by the session chat to message them.

## TLDR

- A loaded preset prefills the editor and runs verbatim as its own kind of run; emptying the box falls back to a normal build run, and a preset can insist on opening a new session.
- Agent, model, options, and target are shared preferences: every composer, including the compact navbar row, shows and writes the same state instead of silently using stored values.
- In a session, controls that can no longer change anything disappear — the agent is bound at start, and the options gear hides during a live run, returning after the end offering only what a Resume actually re-arms.
- A draft carried from another device or a navigating click lands in the launcher's editor, taken once; Start is blocked with a reason while the chosen device is offline, and fast double-submits fire once.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
