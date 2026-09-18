One run [1]: a checkout [2] from the `branches` package, a session from `agent-driver`, the prompt once, and the agent's own loop to the end. No system prompt, no gates, no steering: the command's skill file is the whole instruction, and the agent publishes its own work through the skills in its checkout. The session keeps the run's live record [5] itself; this process adds its mark [6], the pid and the host, records the run over its marker [3] when the agent stops, and reclaims [4] the checkout. The run's process holds the run's lock [10] from before it touches the record until the checkout is let go, so a resume of the same run waits for it. What reaches the agent from outside comes through the session's inbox [8], and a line that reached it while the run was ending is still sent by this process, in the same session, before it lets the run go; a run whose last turn asked a question ends `waiting`, keeps its checkout, and the answer resumes it: the same run, the same record, continued. A signal to this process (SIGINT or SIGTERM: what a dashboard's Stop sends, the pid being on the live card) stops the run, recorded `stopped`; a later signal changes nothing; a run whose process dies is caught by the sweep on a later tick. One-shot: `agent-scheduler run <prompt>` needs no scheduler running, and the tick spawns the same thing with the marker already written and the id chosen.

## Context

**User story**: the user sees the run on the dashboard as it works, on its own branch; when the agent ends, the run's record on the `agent-data` branch says how it went, which branch and pull request hold the work and what it cost, with what the agent said; the checkout is gone unless something in it is not on the remote yet. When the agent stops to ask, the run reads `waiting` with the question, and the user's answer picks the same run up where it stopped.

**Business logic story**: the tick (`tick.ts`) writes the marker and spawns this as a detached process with the id and the command (`scheduler.ts`); a person runs it from a shell with any prompt, and then the run marks itself; a person resumes an ended run with `run --resume`. The checkout is made and reclaimed by the `branches` package's rules; the record is written by the `logs` package's; the coding agent is a driver [7] from `agent-driver`, Claude Code or Codex as `scheduler.ts` builds it: unrestricted, and the run's id in its environment as `AGENT_ID`, so a ticket it claims names the run; the live record, the inbox and the question are `agent-driver`'s contract.

## Glossary

[1] run: one agent this tool starts: a detached process of the tool's own, a checkout, one prompt to the coding agent, and a run record when it ends. Its id is its start time with `:` and `.` replaced by `-`, `2026-09-16T14-01-00-000Z`, the shape the dashboard sorts runs by.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.
[4] reclaim: removing a finished agent's checkout once its work is on the remote.
[5] live record: the card `<id>.json` and the diary `<id>.jsonl` under `.the-framework/` in a run's checkout, the same two files as the run record, written by the session as the agent works (`live-card.ts`).
[6] the tool's mark: `caller.scheduler` on a card: the command the run was started for, the machine that started it, and the run's process on that machine while it runs.
[7] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[8] inbox: `.the-framework/inbox.jsonl` in the checkout: the lines from outside the agent, messages and answers, the session sends into the conversation when a turn ends.
[9] question: the block an agent ends a turn with when it will not decide alone, with its options and a recommended one; `agent-driver`'s contract.
[10] the run's lock: `.agent-scheduler/runs/<id>.lock` at the repository root, holding the pid of the one process of the run at work on it; a pid that is not a live process holds nothing (`run-lock.ts`).

## Business logic — TL;DR

- **The id, the command and the mark** - the id is given by the tick or minted from the start time; the command is given by the tick or the prompt's first word without its slash; the mark names the command, this host and this process.
- **The run's lock** - taken for the run's id with this process's pid before the marker, waited for while another live process holds it (a tick's run finds it already handed to it), let go once the record is written and the checkout reclaimed or kept, whatever happened.
- **The marker** - a person's run writes its own marker; the tick's run was marked before it was spawned and does not mark itself again.
- **The checkout** - made through the `branches` package for the run's id, on the birth branch `agent-<id>`; without one there is no run: the record is written `failed` with `could not create a checkout: …` over the marker, and the outcome says `no checkout`.
- **The session and the prompt** - the driver started in the checkout on the run's model (on the coding agent's own default when the run has none) with the live record's directory and the card's starting fields (the prompt as the intent, the driver, the model, the birth branch, and under `caller` the mark, the pid, the host and the checkout as the workspace); prompted once with the prompt and the inbox path; the session writes the live record as it streams; a driver that throws makes the run `failed` with the error as the detail.
- **A stop** - SIGINT or SIGTERM to the run's process aborts the session, which ends the agent's whole process tree; the run is `stopped` with the detail `stopped by a signal to its process`, and the record and the reclaim run as for any other end; the handlers stay until the reclaim is done, so a second signal, or one that comes while the run records and reclaims, is ignored.
- **A question** - when the last turn ended on a question [9] and nothing waited in the inbox, the run ends `waiting`: recorded so, its checkout kept for the answer, the outcome's checkout reason `waiting`.
- **Lines that came as the run ended** - once the session's log is ended, the inbox is taken once more: lines there were written while the card still said running, so the same process reopens the card, sends them in order as further turns of the same session, and ends again, until the inbox is empty; a stopped run drops them.
- **The record** - the branch read back from the checkout (the agent renames it itself) and the pull request read back off that branch are patched onto the live card, the session's log ended with the status and the detail, and the two files copied onto the branch unchanged, over the marker, same id.
- **The reclaim** - the checkout reclaimed under the `branches` rule, pushing on the way; a dirty tree or a branch that could not be pushed keeps it, with the reason in the outcome, and the sweep tries again on a later tick.
- **A resume** - an ended run of this tool's continues as the same run: the run's lock is waited for first, so another process of the run, or an earlier resume, finishes before this one reads the record; a record still `running` after that wait is an error for the sweep to settle; its record is written `running` again with this process's mark, the kept checkout is reused or one is attached to the run's branch, the session starts by the session id the record carries, the diary goes on from where it stopped, and the prompt is the user's text or the continuation of the question the run ended on with the given answer; then the session, the record and the reclaim as above.

## Business logic

### The id, the command and the mark

#### Context

See `## Context`.

#### Business logic

The run starts at the clock's now. Its id is the one the tick handed over, or else the start time as an id. Its command is the one the tick handed over, or else the prompt's first word with a leading `/` removed (`/work-queue` → `work-queue`). Its mark [6] is that command, this machine's host name, and this process's pid.

### The run's lock

#### Context

**Problem**: a message to a run that just ended starts a resume while the run's own process may still be writing the record or reclaiming the checkout; two messages in quick succession start two resumes. Two processes of one run would work the same checkout and write over each other's record.

#### Business logic

Before anything else, the run's lock [10] is taken for the run's id with this process's pid (`run-lock.ts`): while another live process holds it, this one waits, looking again every 500 ms. The tick's run, and a run started with `run --detach`, find the lock already handed to their own pid by the process that spawned them, and go on at once. The lock is let go once the run has answered, whether the run ended, failed to get a checkout, or threw; a lock that could not be let go is ignored, since a dead pid holds nothing.

### The marker

#### Context

**Problem**: the tick counts markers against the cap before it spawns, so the tick's run must not add a second marker; a person's run from a shell has no tick and must count itself.

#### Business logic

When the run was not told it is already marked, it writes its marker [3]: a running card with the prompt as the intent, the driver's id, the model and the mark, an empty diary. A marker that could not even be committed is logged as `the run's record could not be written: …` and the run goes on. When the run was told it is marked, nothing is written until the end.

### The checkout

#### Context

See `## Context`.

#### Business logic

The checkout [2] is made by the `branches` package for the run's id: a worktree under `.branches/` on the birth branch `agent-<id>`, with everything an agent needs. When that fails, there is no run: the card is written `failed` with the end time, the diary one `ended` line whose detail is `could not create a checkout: <the error>`, and the outcome is `failed` with the same detail and a checkout that was not reclaimed for the reason `no checkout`. The live record's directory is hidden from git through the checkout's exclude file, since an untracked directory would keep the checkout dirty and a dirty checkout is never reclaimed.

### The session and the prompt

#### Context

See `## Context`.

#### Business logic

The driver [7] is started in the checkout on the run's model, or with no model named when the run has none so the coding agent starts on its own default, with a stop signal, the live record's [5] directory and the card's starting fields: the run's id and start time, the prompt as the intent, the driver's id, the model, the birth branch, and under `caller` the mark, the pid, the host, the kind `prompt` and the checkout's path as the workspace. It is prompted once with the prompt and the inbox [8] path; the session writes the live record as the agent streams, sends every line waiting in the inbox when a turn ends as a further turn, and resolves with the last turn. The agent's own loop runs to the end; nothing here steers it. The driver session is disposed afterwards whatever happened. A driver that throws, on start or on the prompt (`claude: not logged in`), makes the run's status `failed` with the error's message as the detail; otherwise the status is `done`, whether or not the agent committed anything.

### A stop

#### Context

**User story**: the user presses Stop on the dashboard, where the run shows like any other agent; the agent's processes end within seconds, the run reads `stopped` with what the agent had said until then, and its checkout is gone unless it holds work not on the remote.

**Problem**: a dashboard steers its own agents through a file of its own; this tool reads no such file. The pid on the live card is what a dashboard has of a run, and a signal is what a pid takes.

#### Business logic

SIGINT or SIGTERM to the run's process, from a dashboard's Stop or a person's shell, aborts the driver [7] session: the driver ends the agent's whole process tree. The run's status is then `stopped`, whatever the driver answered or threw, with the detail `stopped by a signal to its process`. This process's handlers for the two signals are in place from the moment the checkout exists until the record and the reclaim below are done, so no signal in that span ends the process halfway through a write. A second signal does nothing more. A first one that comes while the run records and reclaims does not change how the run ended. One that comes after the session's log was ended but before the inbox is taken again keeps the lines that came as the run ended from being sent (below); one that comes while those lines are being sent stops the run like any other. Nothing else stops or steers a run.

### A question

#### Context

**User story**: the agent has written a plan and wants it signed off; the run reads `waiting` on the dashboard with the question and its options; the user's answer, hours later, picks the run up where it stopped.

**Problem**: no process waits for an answer that may never come, and the checkout has to be there when it comes.

#### Business logic

When the run was not stopped and the last turn's final message ends on a question [9], the run's status is `waiting`. It is recorded so (below), and its checkout is kept on purpose: the outcome says the checkout was not reclaimed for the reason `waiting`. The question itself is the last `question` line of the diary; the answer resumes the run.

### Lines that came as the run ended

#### Context

**Problem**: a dashboard hands a line to a run by appending it to the inbox while the card says `running`, and hands it to the project's resume hook once the card says ended. The last turn takes the inbox when it ends, but the run goes on saying `running` while it reads the branch and the pull request back: a line written in that moment was told the run has it, and no resume will come for it.

#### Business logic

Once the session's log is ended (below), and unless the run was stopped or a signal came, the inbox is taken once more. When it holds lines, the same process reopens the log: the live card says `running` again, without its end time, and the diary keeps its `ended` line. The lines are sent in order as further turns of the same session, each continuing the conversation, a message as its text and an answer as the continuation prompt; only the last of them takes the inbox again when its turn ends, so a line written meanwhile comes after them. The status is then decided again as for the first end (a failure, a stop, a question), the branch and the pull request read back again, and the log ended again. This repeats until the inbox is empty when taken; a line written after that is the resume hook's, which waits for this process through the run's lock. A turn that throws ends that round `failed`, and the lines after it in the same round are not sent. A stopped run, or one that received a signal before the inbox was taken, drops the lines left there.

### The record

#### Context

**Problem**: the agent names its own branch (`agent-fix-it`) and opens its own pull request; the record must say where the work went, and only the branch and `gh` know.

#### Business logic

The branch is read back from the checkout, the birth branch when it cannot be read. The pull request is read back off that branch (`pr.ts`), or none. Both are patched onto the live card; the session's log is ended with the status and, when there is one, the detail, which appends the `ended` line and sets the card's status and end time. Once every write has landed, the lines that came as the run ended are sent (above), which ends the log again each time; the status the record and the reclaim go by is the last end's. Once the inbox is empty, the driver session is disposed, and the card and the diary are read back from the checkout and written onto the branch unchanged, over the marker, same id; a record that could not even be committed is logged as `the run's record could not be written: …`. When the session never opened (the driver threw on start), the card is the starting one with the status and the end time, and the diary one `ended` line.

### The reclaim

#### Context

See `## Context`.

#### Business logic

A `waiting` run keeps its checkout and answers at once. Otherwise the checkout is reclaimed [4] by the `branches` package with pushing allowed and the birth branch named, so a branch that held nothing goes with the checkout and a renamed branch reaches origin on the way. The outcome answers the id, the status, the branch, the pull request when there is one, the cost off the card, whether the checkout was reclaimed and, when it was not, the `branches` package's reason with its detail (`dirty`, `not-on-remote: …`), and the detail of a failure. A kept checkout is the sweep's to try again.

### A resume

#### Context

**User story**: the user answers the question a run stopped on, or types one more thing to an agent that ended; the same run continues, on the same branch, in the same conversation, and its record reads as one run from its first start to its last end.

**Problem**: the run's process is gone; what remains is the record, the branch, the session id the coding agent named, and, for a waiting run, its checkout.

#### Business logic

`resumeRun` takes the run's id and the user's text, or the answer to the question. First the run's lock [10] is taken with this process's pid, waiting while another live process holds it: the run's own process still recording and reclaiming, or a resume started just before this one; this one then reads the run as that one left it, and lets the lock go once it has answered. The record is read off the branch: no record is the error `no run <id>`; a record still `running` after the wait is one whose process died before it could end it, the error `run <id> is still recorded running`, the sweep's to close first; one without the tool's mark [6] is an error. The prompt is the text, or, for an answer, the continuation prompt `agent-driver` words from the last `question` line's title and the answer. The branch is the record's, or the birth branch when the record names none. The checkout is the run's own when it is still there, else a new one attached to that branch. The record is written `running` again, over the ended one, with this process's mark, pid, host and workspace, so every reader sees the run in flight; the record's diary is written into the checkout first, so the session's log continues it rather than starting empty. The session starts with the session id the record carries under `caller`, when there is one, and is prompted with the resume flag; from there the run is the same as a fresh one: the live record, a stop, a question, the lines that came as it ended, the record and the reclaim. The outcome's id is the run's id.
