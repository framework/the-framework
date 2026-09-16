The names the tool hangs off, and its defaults. The schedule [1] is `agent-schedule.md` at the repository root. The tool's own directory is `.agent-scheduler` at the repository root, hidden from git by the tool itself; in it, the state [2] is `state.json`, a `runs/` directory holds one stderr file per run the tick spawned, and `scheduler.log` is the scheduler's process's own log. A command [3] is looked for under `.claude/skills`. The defaults: a run starts on `opus` when the state names no model; the spend cushion is 100/14 percentage points, half a day of the week's allowance, the cushion The Framework's daemon used; a command whose schedule line names no cap [4] runs 1 at a time; a started scheduler ticks every 60 seconds; a command's check may run 60 seconds before it counts as failed.

## Glossary

[1] the schedule: `agent-schedule.md` at the repository root, tracked, written by a person: one list line per command.
[2] the state: `.agent-scheduler/state.json` at the repository root, per user, hidden from git through the repository's exclude file.
[3] command: a `.claude/skills/<name>` folder tracked in the project, which the coding agent's harness expands from the slash command `/<name>`.
[4] cap: how many runs of one command may be in flight at once, across every machine that shares the repository.
