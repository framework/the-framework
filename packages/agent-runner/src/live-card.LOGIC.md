A run's [1] live record [2]: the card and the diary `agent-driver`'s session keeps under `.the-framework/` in the run's checkout [3], in the run record's shape, while the agent works; and the inbox [4] beside them. The dashboard reads the two files there; the run's process copies them onto the `agent-data` branch unchanged when it ends; the sweep [5] reads them to find a run whose process died, and closes them from outside.

## Context

**User story**: the user opens the dashboard while a run works, started from the dashboard or by a scheduler, and sees it like any other agent: running, on which branch, what it said so far, what it cost; when the run ends, the same lines are its record on the `agent-data` branch.

**Business logic story**: the run's process (`run.ts`) hands the session the directory and the card's starting fields, and the session writes the two files as events arrive (`agent-driver`'s `session-log.ts`); the sweep (`sweep.ts`) reads the card of every checkout on this machine and, for a dead run, appends the end itself.

## Glossary

[1] run: one agent this tool starts: a process of the tool's own (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[2] live record: the card `<id>.json` and the diary `<id>.jsonl` under `.the-framework/` in a run's checkout, the same two files as the run record, written by the session as the agent works.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] inbox: `.the-framework/inbox.jsonl` in a run's checkout: the lines from outside the agent, messages and answers, the session sends into the conversation when a turn ends.
[5] sweep: the pass that records and reclaims the runs of this machine whose process died; the scheduler runs it on every tick.
[6] the tool's mark: `caller.runner` on a card: the machine that started the run, the run's process on that machine while it runs, and the follow-up's prompt when the run names one.

## Business logic — TL;DR

- **Where the files are** - `.the-framework/` in the checkout, the dashboard's directory; the card is `<id>.json`, the diary `<id>.jsonl`, the inbox `inbox.jsonl`.
- **Hidden in the checkout alone** - a `.gitignore` of `*` in that directory keeps the checkout clean for the reclaim, unless one is already there, which is kept (a project's own must ignore the live files, as the dashboard's does); never a rule in the repository's shared exclude file, which would hide the project's own directory too.
- **Reading a card as this tool's** - a card is read only when it parses and carries the tool's mark [6]; a checkout without one is not this tool's and is left alone. The diary is read line by line, every line that parses.
- **Closing from outside** - a dead run's end is appended to the diary as an `ended` line with the status, a detail and the end time as the line's time, and the card rewritten with that status and the end time, both best-effort.
