Status: open
Priority: 9
GitHub: [#1204](https://github.com/gemstack-land/the-framework/issues/1204)

# Setting to set number of concurrent agents

## TLDR

New routine setting: number of concurrent agents (default 2) that the routine spins up. Needed for the demo video, to show off 10 CC web sessions working in parallel. Thread opens: the setting should also drive concurrency from the routine-task side — e.g. clicking "Run now" on quick-wins should lead to the max number of concurrent agents — and it's unclear which routine tasks actually trigger on auto-run. Status: landed on `main` via #1252, but unverified ("Done, but not sure it works").

## Why it matters

Marked highest-prio 🌟: parallel agents are the demo's money shot and the core throughput lever. The remaining work is verifying it actually works, plus answering how the setting applies to routine-triggered runs.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1204](https://github.com/gemstack-land/the-framework/issues/1204), created 2026-07-25, label: `highest-prio 🌟`, 4 comments.

### Original description

New setting for routine: number of concurrent agents (default 2).

The setting drives the number of concurrent agents that are spinned by the routine.

Needed for the demo video, so we can show off 10 CC web sessions working in parallel.

### Notes from the GitHub thread

- The setting should drive concurrency from the routine-task perspective too: "Run now" on e.g. quick-wins should use the max number of concurrent agents. Related open question: which routine tasks are triggered when the routine is auto-run?
- OP was updated; the implementation landed on `main` via #1252 (per #1243's closing note), but the maintainer isn't sure it works — verification is the remaining step.
