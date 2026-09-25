The person's line for a run's [1] end: the `ended:` line [2] of the project's `.agent-runner/config.yml`, on this machine only, a shell line of the person's that this tool runs when a run ends waiting on a question, or ends done with a pull request its branch did not have when this process took it up; on no other end. The tool names no service the line posts to: the line is the person's, `npx discord send "$MESSAGE"` for a Discord channel. It runs in the project's root with the run's facts in its environment, once the run's record is written, while the run's lock is still held and before the checkout is reclaimed, and nothing it does, nor anything that goes wrong around it, changes how the run ended.

## Context

**User story**: the user is away from the dashboard and wants to hear when an agent needs them. They write `ended: npx discord send "$MESSAGE"` into `.agent-runner/config.yml` in their project; when a run stops on a question, the team's channel shows `shop: "/work-queue" is waiting for you: Ship it?`, and when a run opens a pull request, `shop: "/work-queue" opened a pull request: https://github.com/…/pull/12`.

**Problem**: a person must hear about the ends that need them, and only those: a failed or stopped run is left to whoever looks at the runs, and a run continued with one more message, still on the pull request it already had, has nothing new to say.

## Glossary

[1] run: one agent this tool starts: a process of the tool's own (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends. Its id is its start time, `2026-09-16T14-01-00-000Z`.
[2] the `ended:` line: the value of the `ended` key in `.agent-runner/config.yml` at the project's root, a YAML map; a shell command of the person's, one string, run whole by `sh`. The tool's directory `.agent-runner/` is hidden from git by the tool the first time it takes a run's lock, so the file stays on this machine, for this project.
[3] news: a run's end the `ended:` line runs for: ended `waiting`, or ended `done` with a pull request other than the one the run's branch already had when this process took the run up (none for a fresh run; the first run's for a follow-up's run; the record's for a resume).

## Business logic — TL;DR

- **Which ends are news** [3] - ended `waiting`, always, carrying the question and, when there is one new to this process, the pull request; ended `done` only with a pull request new to this process; `failed` and `stopped` never.
- **The message** - one line for a person: `<project>: "<the prompt's first line>" is waiting for you: <the question>`, with ` (pull request: <url>)` when a new one came with it, or `<project>: "<the prompt's first line>" opened a pull request: <url>`; the project is the name of the project's root directory, a first line over 80 characters is cut to 79 and `…`, and the question's line breaks and runs of white space become single spaces.
- **Reading the line** - from `.agent-runner/config.yml` at the project's root; no file, or an empty one, is no line, silently; a file that is not YAML, one whose top is not a YAML map, or an `ended` that is not a string, is no line and one line on the log; a blank string is no line.
- **Running the line** - with `sh -c` in the project's root, in a process group of its own, the process's environment plus `MESSAGE`, `RUN_ID`, `STATUS`, `QUESTION` and `PR_URL`; its output discarded; waited for until the shell exits, and when the shell is still running at 60 seconds, its whole process group killed; what the shell left running in the background after it exited is not limited; a line that cannot run or start, exits non-zero, is ended by a signal, or takes too long is one line on the log, never an error, and the run goes on as it ended.
- **While the run's lock is held** - the line runs before the lock is let go and before the reclaim, so a resume of the same run started meanwhile waits for it, up to the limit.

## Business logic

### Which ends are news

#### Context

See `## Context`.

#### Business logic

The run's process gives the end's status, the question's title when the run ended on one, the pull request read back off the run's branch when there is one, and the pull request the branch already had when this process took the run up, when it had one (`run.ts`). A pull request is new when there is one and its URL differs from that earlier one.

- Ended `waiting`: news, with the question (the words `a question` when none was given) and the pull request when it is new.
- Ended `done` with a new pull request: news, with the pull request.
- Ended `done` with no pull request, or with the same one as before; ended `failed`; ended `stopped`: not news, and nothing runs.

### The message

#### Context

**Problem**: the line posts wherever the person pointed it, where the reader does not know which project or which run is speaking.

#### Business logic

`MESSAGE` names the project (the last part of the project root's path), then the run's prompt as its record's intent holds it (a resume's text is not it), quoted: the first line of the trimmed prompt, and, when that line is over 80 characters, its first 79 followed by `…`. A waiting run's message then says `is waiting for you: <the question's title>`, its line breaks and runs of white space made single spaces so the message stays one line, followed by ` (pull request: <url>)` when a new pull request came with it; a done run's says `opened a pull request: <url>`.

### Reading the line

#### Context

**Problem**: a config file the person broke must not break a run, but the person should learn why nothing was posted.

#### Business logic

The line is read from `.agent-runner/config.yml` at the project's root each time an end is news, so a change to the file counts from the next end on. No file, or one that cannot be read, is no line and nothing is said; so is an empty file. A file that YAML cannot parse is no line, and the log gets `[agent-runner] <the file>: <the parser's first line>`. A file whose top is not a YAML map (a list, a string, a number) is no line, and the log gets `[agent-runner] <the file>: the file is not a YAML map`. An `ended` key whose value is not a string (a list, a number, a map) is no line, and the log gets `[agent-runner] <the file>: \`ended\` is not a string`. An `ended` key that is missing, empty, or only white space is no line, silently. Otherwise the line is the value, trimmed. Other keys in the file are ignored.

### Running the line

#### Context

**Problem**: a run's process that exited while the line still posted would cut the post short; a line that hangs, or leaves a child running (`npx` and the node it starts), must not keep the run's process waiting past the limit.

#### Business logic

The line runs as `sh -c <the line>` with the project's root as its working directory. Its environment is the run's process's own, plus:

- `MESSAGE`: the message above.
- `RUN_ID`: the run's id.
- `STATUS`: `waiting` or `done`.
- `QUESTION`: the question's title for a waiting run, as the agent wrote it (line breaks kept), empty for a done one.
- `PR_URL`: the new pull request's URL, empty when there is none.

It runs in a process group of its own. Its standard input is closed and its standard output discarded; of its standard error only the last 4,096 characters are kept, to say why it failed. The run's process waits for the shell to exit, not for a child the line left running, and then stops reading its standard error. When the shell is still running 60 seconds after it started, the whole process group, the shell and everything it started, is killed with SIGKILL. Once the shell has exited within the limit, the limit is over: what it left running in the background goes on, unlimited, on its own.

Nothing about the line throws into the run: a line that could not even be run (its environment could not be passed, a question carrying a NUL character among the causes) logs `[agent-runner] the ended line could not run: <the error>`; a line whose shell cannot start logs `[agent-runner] the ended line could not start: <the error>`; one that reached the limit logs `[agent-runner] the ended line took longer than <the limit>s and was ended`, the limit in whole seconds, or in milliseconds (`300ms`) when under one second; one ended by a signal it did not get from this tool logs `[agent-runner] the ended line was ended by <signal>`; one that exits with a code other than 0 logs `[agent-runner] the ended line exited <code>`, followed by `: ` and the last line of its standard error when it wrote any. In every case the run goes on exactly as it ended.

### While the run's lock is held

#### Context

**Problem**: an answer to a waiting run can come while the line is still posting that the run waits.

#### Business logic

The run's process runs the line after writing the record and before reclaiming the checkout and letting the run's lock go (`run.ts`). A resume of the same run started meanwhile waits for the lock, so it waits for the line too, up to the limit.
