The shared composer: the prompt editor plus its control row — presets, context, driver and model, options, send — used by the launcher (the project's start-an-agent screen) and by an agent's chat to message it.

## Flows

- A loaded preset prefills the editor and runs verbatim as its own run kind; emptying the box falls back to a normal build run, and a preset can insist on opening a new agent.
- Driver, model, options, and target are shared preferences: every composer, including the compact navbar row, shows and writes the same state instead of silently using stored values.
- On an agent, controls that can no longer change anything disappear: the driver select goes (the driver is bound at start), and the options gear hides while the agent is live, returning after the end offering only what a Resume actually re-arms.
- A draft carried from another device or from a navigating click lands in the launcher's editor, taken once.
- Start is blocked with a reason while the chosen target device is offline, and fast double-submits fire once.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
