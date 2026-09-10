Runs one turn [1] of a coding agent [2] as one operating-system process, whichever coding agent it is: the process is spawned in the driver session's [3] directory as the leader of its own process group, the prompt is fed to it over standard input, its output is streamed line by line through the driver's [4] own parser into progress events [5], and the turn succeeds or fails on the process's exit code. The Claude Code and Codex drivers supply only the command line and the parser; everything about the process lives here.

## Context

**User story**: the user starts an agent [6] and follows it in the agent view as it works; when the user stops it, or closes The Framework with Ctrl-C, nothing of the coding agent [2] keeps running on the machine.

**Problem**: a coding agent spawns a deep subtree of its own: worker processes, search tools, the shell commands it runs, MCP servers. Signaling only the top process orphans that subtree, which keeps burning CPU after the agent is gone, so a stop must reach the whole tree at once. And a coding agent that crashes mid-build has usually streamed text first, so streamed text alone must never count as a completed turn [1].

## Glossary

[1] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[4] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[5] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[7] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[8] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **One turn is one process** - the coding agent [2] is spawned as its own process-group leader in the driver session's [3] directory, the prompt goes in over standard input, and a `start` progress event [5] announces the turn [1].
- **Output streams through the driver's parser** - each output line is handed to the driver's [4] parser, and whatever progress events it yields are forwarded as they come.
- **The exit code decides the turn** - exit code zero resolves the turn with the parser's final result and a `result` progress event; any other exit fails the turn with an `error` progress event, even when text streamed first.
- **A stop request kills the whole process tree** - a stop request [7] sends the whole process group a termination signal, then a forced kill 5 seconds later, and fails the turn as stopped; a stop request already raised before the turn starts fails it without spawning anything.
- **Nothing is reported twice** - once a turn has been settled by a stop request or a spawn failure, the process's later exit produces no further progress event.
- **A process that cannot start fails the turn** - a coding agent that cannot be started at all, because it is not installed, fails the turn with that error.
- **A closed input pipe never crashes The Framework** - a coding agent that exits before reading its prompt breaks the input pipe; that error is swallowed, because the exit code already reports the failed turn.
- **Every live process group is registered** - the group is registered with the registry in `child-registry.ts` while it runs, so a hard exit of The Framework still reaps it, and removed once it is gone.

## Business logic

### One turn is one process

#### Context

See `## Context`.

#### Business logic

A turn [1] spawns the coding agent [2] with the command line the driver [4] built, in the driver session's [3] directory (the agent's [6] checkout [8]) and with the environment the driver chose, as the leader of its own process group so that the whole subtree can be signaled at once. A `start` progress event [5] carrying the prompt announces the turn first. The prompt is written to the process's standard input, which is then closed, so a long prompt never hits the operating system's command-line length limit.

### Output streams through the driver's parser

#### Context

**User story**: the user sees what the coding agent [2] says and which tools it uses while the turn [1] runs, not only when it ends.

#### Business logic

The process's standard output is read one line at a time and each line is handed to the driver's [4] parser, which knows the coding agent's [2] own output format. Whatever progress events [5] the parser yields for a line are forwarded immediately. Standard error is collected and kept aside as the failure detail.

### The exit code decides the turn

#### Context

**Problem**: the caller gates on the outcome, so a crash mid-build must not pass as a result merely because the coding agent [2] said something before it died.

#### Business logic

When the process exits with code zero, the turn [1] resolves with the parser's result (the final message, the session id and the usage when known), and a `result` progress event [5] carries the same. When the process exits with any other code, or dies from a signal, the turn fails even if text was streamed first: an `error` progress event is reported with the failure detail, and the turn fails with "<driver id> exited (<exit code>): <detail>". The detail is, in order of preference, what the coding agent [2] wrote to standard error, else the text it streamed so far, else "exit code <code>" (with `null` for a death by signal).

### A stop request kills the whole process tree

#### Context

**User story**: the user presses Stop, or closes The Framework with Ctrl-C, and every process the coding agent [2] started is gone.

#### Business logic

A stop request [7], whether the driver session's [3] or the turn's [1] own, sends the whole process group a termination signal so the coding agent [2] can flush, and schedules a forced kill of the whole group 5 seconds later in case the coding agent ignores the termination, for instance mid tool call. The turn fails as stopped ("<driver id> prompt aborted"). A stop request that is already raised when the turn is asked for fails it immediately, before anything is spawned and without a `start` progress event [5]. The pending forced kill is dropped once the process is gone.

### Nothing is reported twice

#### Context

**Problem**: a killed process still exits afterwards, and a spawn that failed may still close; a second report for a turn [1] that already failed would show a second failed row in the agent view.

#### Business logic

A turn [1] settles exactly once. Once a stop request [7] or a spawn failure has settled it, the process's later exit is ignored: no `error` and no `result` progress event [5] follows, and the outcome does not change.

### A process that cannot start fails the turn

#### Context

**User story**: the user picked a driver [4] whose coding agent [2] is not installed on this machine; the agent [6] fails saying so rather than hanging.

#### Business logic

When the operating system cannot start the process at all, because the command is missing from `PATH` or cannot be executed, the turn [1] fails with the operating system's error. No `error` progress event [5] is reported for it; the failure itself carries the reason.

### A closed input pipe never crashes The Framework

#### Context

**Problem**: a coding agent [2] that exits before reading its prompt, on a bad flag or an instant crash, breaks the pipe the prompt is being written to. Left unhandled, that broken pipe is an uncaught error in The Framework's own process, which would take the daemon and every running agent [6] down with it.

#### Business logic

An error on the process's standard input is swallowed. It carries nothing the caller needs: the process's exit, which is non-zero in that case, already fails the turn [1] with the coding agent's [2] own error output.

### Every live process group is registered

#### Context

See `## Context`.

#### Business logic

As soon as the process has an id, its process group is registered with the registry in `child-registry.ts`, and it is removed from the registry once the process has exited, failed to start, or been killed. Between the two, a hard exit of The Framework's process force-kills the group on the way out.
