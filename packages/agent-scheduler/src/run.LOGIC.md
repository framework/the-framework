One run [1]: a checkout [2] from the `branches` package, a session from `agent-driver`, the prompt once, and the agent's own loop to the end. No system prompt, no gates, no steering: the command's skill file is the whole instruction, and the agent publishes its own work through the skills in its checkout. This process records the run over its marker [3] and reclaims [4] the checkout when the agent stops; a run whose process dies is caught by the sweep on a later tick. One-shot: `agent-scheduler run <prompt>` needs no scheduler running, and the tick spawns the same thing with the marker already written and the id chosen.

## Context

**User story**: the user sees the run on the dashboard as it works, on its own branch; when the agent ends, the run's record on the `agent-data` branch says how it went, which branch and pull request hold the work and what it cost, with what the agent said; the checkout is gone unless something in it is not on the remote yet.

**Business logic story**: the tick (`tick.ts`) writes the marker and spawns this as a detached process with the id and the command (`scheduler.ts`); a person runs it from a shell with any prompt, and then the run marks itself. The checkout is made and reclaimed by the `branches` package's rules; the record is written by the `logs` package's; the coding agent is a driver from `agent-driver`, Claude Code with permissions bypassed and the run's id in its environment as `AGENT_ID`, so a ticket it claims names the run.

## Glossary

[1] run: one agent this tool starts: a detached process of the tool's own, a checkout, one prompt to the coding agent, and a run record when it ends. Its id is its start time with `:` and `.` replaced by `-`, `2026-09-16T14-01-00-000Z`, the shape the dashboard sorts runs by.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.
[4] reclaim: removing a finished agent's checkout once its work is on the remote.
[5] live log: `agent.json` and `events.jsonl` under `.the-framework/` in a run's checkout, in the shape The Framework's dashboard reads.
[6] the tool's mark: `caller.scheduler` on a card: the command the run was started for, the machine that started it, and the run's process on that machine while it runs.
[7] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does.

## Business logic — TL;DR

- **The id, the command and the mark** - the id is given by the tick or minted from the start time; the command is given by the tick or the prompt's first word without its slash; the mark names the command, this host and this process.
- **The marker** - a person's run writes its own marker; the tick's run was marked before it was spawned and does not mark itself again.
- **The checkout** - made through the `branches` package for the run's id, on the birth branch `agent-<id>`; without one there is no run: the record is written `failed` with `could not create a checkout: …` over the marker, and the outcome says `no checkout`.
- **The live log and the prompt** - the live log opened in the checkout with a session, an intent and a branch event; the driver started in the checkout on the run's model, prompted once with the prompt, its events appended as they stream, usage summed across turns; a driver that throws makes the run `failed` with the error as the detail.
- **The record** - the branch read back from the checkout (the agent renames it itself), the pull request read back off that branch, the end appended, and the card and diary written over the marker.
- **The reclaim** - the checkout reclaimed under the `branches` rule, pushing on the way; a dirty tree or a branch that could not be pushed keeps it, with the reason in the outcome, and the sweep tries again on a later tick.

## Business logic

### The id, the command and the mark

#### Context

See `## Context`.

#### Business logic

The run starts at the clock's now. Its id is the one the tick handed over, or else the start time as an id. Its command is the one the tick handed over, or else the prompt's first word with a leading `/` removed (`/work-queue` → `work-queue`). Its mark [6] is that command, this machine's host name, and this process's pid.

### The marker

#### Context

**Problem**: the tick counts markers against the cap before it spawns, so the tick's run must not add a second marker; a person's run from a shell has no tick and must count itself.

#### Business logic

When the run was not told it is already marked, it writes its marker [3]: a running card with the prompt as the intent, the driver's id, the model and the mark, an empty diary. A marker that could not even be committed is logged as `the run's record could not be written: …` and the run goes on. When the run was told it is marked, nothing is written until the end.

### The checkout

#### Context

See `## Context`.

#### Business logic

The checkout [2] is made by the `branches` package for the run's id: a worktree under `.branches/` on the birth branch `agent-<id>`, with everything an agent needs. When that fails, there is no run: the card is written `failed` with the end time, the diary one `ended` line whose detail is `could not create a checkout: <the error>`, and the outcome is `failed` with the same detail and a checkout that was not reclaimed for the reason `no checkout`.

### The live log and the prompt

#### Context

See `## Context`.

#### Business logic

The live log [5] is opened in the checkout, `running` under this process's pid and host, with the prompt as the intent and the mark; three events follow at once: the session (the driver's id, the checkout as the workspace, whether the driver is the fake, the model), the intent, and the birth branch. The driver [7] is then started in the checkout on the run's model and prompted once with the prompt; every event it streams is appended as a driver event; a session event, or a result carrying a session id, appends the session id; a result carrying usage counts one turn, adds its tokens to the run's totals and appends a usage event with the price when the driver gives one. The agent's own loop runs to the end; nothing here stops or steers it. The driver session is disposed afterwards whatever happened. A driver that throws, on start or on the prompt (`claude: not logged in`), makes the run's status `failed` with the error's message as the detail; otherwise the status is `done`, whether or not the agent committed anything.

### The record

#### Context

**Problem**: the agent names its own branch (`agent-fix-it`) and opens its own pull request; the record must say where the work went, and only the branch and `gh` know.

#### Business logic

The branch is read back from the checkout, the birth branch when it cannot be read; when it differs from the one the live log has, a branch event is appended. The pull request is read back off that branch (`pr.ts`), or none. The end is appended: ok when the status is `done`, with the detail when there is one. The card is built from the live log's meta with the pull request, and written with the diary over the marker, same id; a record that could not even be committed is logged as `the run's record could not be written: …`.

### The reclaim

#### Context

See `## Context`.

#### Business logic

The checkout is reclaimed [4] by the `branches` package with pushing allowed and the birth branch named, so a branch that held nothing goes with the checkout and a renamed branch reaches origin on the way. The outcome answers the id, the status, the branch, the pull request when there is one, the cost when the driver priced the turns, whether the checkout was reclaimed and, when it was not, the `branches` package's reason with its detail (`dirty`, `not-on-remote: …`), and the detail of a failure. A kept checkout is the sweep's to try again.
