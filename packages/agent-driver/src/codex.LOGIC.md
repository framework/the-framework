Drives Codex as a driver [1]: each turn [2] is one non-interactive invocation of the `codex` command in the driver session's [3] directory, whose streamed JSON output is read for the coding agent's [4] messages, the kinds of work items it starts, its thread id and its token usage [5], and whose last message is the turn's answer. Codex has no system prompt flag, prices nothing and reports no quota [6]; a turn asked to continue the driver session's conversation resumes it by its thread id. Its implementation id is `codex`.

## Context

**User story**:
- The user picks Codex as the driver [1] and starts an agent [7]; the agent view shows what Codex says and which kinds of work it does, turn [2] by turn.
- The user picks a model for the agent; the dashboard shows what the agent spent in tokens, and no price.

**Business logic story**: Codex runs on the user's own ChatGPT login, a subscription in the normal case. The Framework holds no model key and passes none: Codex authenticates itself, keeps its own loop and its own tools, and The Framework only prompts it and reads what comes back. Running the process, deciding success on its exit code, stopping it and reaping its process tree are the rules of `cli-session.ts`, shared with the Claude Code driver. A turn has no time limit of its own.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] usage: what one turn spent, as the coding agent reports it: token counts, and a notional price in US dollars when the coding agent prices its turns.
[6] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[7] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[8] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[9] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[10] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.
[11] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[12] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.

## Business logic — TL;DR

- **The shared end of a turn, and the log** - the session attaches the log when the caller asked for one, so every event is recorded before the caller sees it; every turn ends the shared way (`inbox.ts`): the question reported, the inbox drained into further turns of the same session.
- **Starting and prompting Codex** - every turn [2] spawns `codex` in its non-interactive mode with streamed JSON output, pointed at the driver session's [3] directory, with the prompt over standard input.
- **Sandboxed to the directory** - Codex runs under its `workspace-write` sandbox unless the driver [1] was configured with `read-only` or `danger-full-access`; under `workspace-write` the directory's git repository data is writable too, so the coding agent [4] can commit; the flag that bypasses Codex's approvals and sandbox is never passed.
- **Framing rides ahead of the prompt** - Codex has no system prompt flag, so the driver session's framing [10] and the turn's extra framing are placed in front of the prompt, as their own block.
- **Model pass-through** - the model the caller names is passed to Codex as is; without one, Codex's own default runs.
- **Continuing the conversation** - a turn asked to continue resumes the driver session's [3] Codex conversation by its thread id: the one the driver session was started to continue, then the one the last turn reported; a turn not asked to, or with no conversation yet, starts fresh.
- **What is read off the streamed output** - the thread id as the session id, announced at once as a `session` progress event, each completed message as streamed text with the last one as the turn's answer, and each started work item as a tool use named by its kind, with everything else ignored.
- **Usage: tokens, never a price** - Codex's token counts are reported with the cached part split out of its inclusive input total, and no price, never zero.
- **No quota reading** - the driver reports no quota [6] at all rather than a made-up number.
- **Ending the driver session** - nothing is freed; each turn's process is already gone when the turn ends.

## Business logic

### Starting and prompting Codex

#### Context

See `## Context`.

#### Business logic

Every turn [2] spawns the `codex` command, found on `PATH` unless the driver [1] was configured with another command, as one non-interactive invocation with one JSON event per output line (`codex exec --json`). Codex is pointed at the driver session's [3] directory, the agent's [7] checkout [8], which is also the process's working directory, and it is told to skip its own git repository check, because Codex otherwise refuses to run in a directory that is not a git repository and a directory may legitimately not be one yet. The process runs with the environment of The Framework's own process unless the driver was configured with another; when the driver session keeps a log, that environment also carries `AGENT_DIARY`, the diary's path (the rule of `session-log.ts`). The prompt is fed over standard input, never as an argument, so a long prompt never hits the command-line length limit. Extra command-line arguments the driver was configured with are appended verbatim, last. Spawning, streaming, the exit code, the stop request [9] and the reaping of the process tree follow `cli-session.ts`: a non-zero exit fails the turn even when text streamed first.

### Sandboxed to the directory

#### Context

**Problem**: a turn [2] in non-interactive mode cannot answer an approval prompt, so what the coding agent [4] may do without asking is decided up front. Codex's sandbox policy governs the shell commands the model writes.

#### Business logic

Unless told otherwise, Codex runs with its `workspace-write` sandbox, so the coding agent [4] can edit the directory it was pointed at and nothing else on the machine; this is the counterpart of Claude Code's `acceptEdits` permission mode. The driver [1] can be configured with `read-only` or with `danger-full-access` instead. Codex's flag that bypasses both its approvals and its sandbox is never passed, whatever the configuration.

Under `workspace-write`, Codex keeps a `.git` directory at the root of the directory read-only. In a plain clone, as opposed to a git worktree such as an agent's checkout [8], that makes the coding agent's [4] first commit or branch rename fail. So on every turn [2] the driver asks git for the absolute path of the directory's git repository data (the common git directory, which for a worktree is the main checkout's `.git`) and tells Codex to make that path writable as well. The path is resolved per turn, not once, because the coding agent may turn the directory into a git repository during an earlier turn. When the directory is not in a git repository, or git is not installed, nothing is added and the turn runs as before. Nothing is added under `read-only` or `danger-full-access`. A writable git directory also lets the coding agent change the repository's hooks and configuration, which run later outside the sandbox; this is accepted, since committing is the coding agent's job and a worktree's git data was already writable. Extra command-line arguments the driver was configured with come after, so one that sets Codex's writable paths itself replaces this path rather than adding to it.

### Framing rides ahead of the prompt

#### Context

**Business logic story**: the product's standing instructions for an agent [7] reach every coding agent [4] as framing [10]. Claude Code takes them as an addition to its system prompt; Codex has no such flag.

#### Business logic

The driver session's [3] framing [10] and the turn's [2] extra framing are joined as separate paragraphs, blank-line separated, and placed in front of the prompt with a blank line between the framing and the prompt, so the same words reach Codex as one block ahead of the task. A turn with no framing at all sends the prompt alone. A turn that continues the conversation (see "Continuing the conversation") sends the prompt alone: the conversation already carries the framing, and sending it again would only repeat it.

### Model pass-through

#### Context

**User story**: the user picks a model for an agent [7] in the launcher.

#### Business logic

When the caller names a model, it is passed to Codex as is (`-m <id>`); the driver [1] neither validates nor substitutes it. Without one, Codex runs whatever model it defaults to.

### Continuing the conversation

#### Context

**User story**: the user answers a Codex agent's [7] question, or sends it a message (live chat [11]), and the agent goes on with everything it did before in mind, as a Claude Code agent does.

**Business logic story**: a caller asks a turn [2] to continue the previous one (the inbox does, for every waiting line, and so does a runner resuming an ended run), and may start a driver session [3] with an earlier session id to continue. Codex keeps its conversations itself and continues one by its thread id (`codex exec resume <thread id>`).

#### Business logic

The driver session [3] remembers one thread id: the earlier session id it was started with, if any, then the thread id each turn [2] reports, which Codex keeps the same across a continued conversation. A turn asked to continue, when a thread id is known, invokes Codex's resume of that thread instead of a fresh run: JSON output and the skipped git repository check as always, the prompt over standard input, the model passed when the caller named one, and the writable git repository data under `workspace-write`. Codex's resume takes neither the sandbox flag nor the directory flag, so the sandbox is passed as the configuration value that flag sets, and the directory is the process's working directory. A turn not asked to continue, and a turn asked to when no thread id is known yet, starts a fresh conversation. A resume Codex refuses fails the turn with Codex's own message; nothing is retried fresh.

### What is read off the streamed output

#### Context

**User story**: the agent view shows what Codex says and what kinds of work it does while the turn [2] runs, and the turn's final message when it settles.

#### Business logic

Codex streams one JSON object per line. A line that is not JSON, such as a banner, an empty line, or a JSON value that is not an object, is noise and is ignored. From each object:

- The line announcing the thread carries the thread id, which becomes the turn's [2] session id in the turn's answer. It is also reported at once as a `session` progress event [12], ahead of everything else the turn streams, as Claude Code's is: a turn that is stopped or fails before its result still leaves the id behind (on the log, when the caller asked for one), the handle a later resume of the conversation needs. The driver session [3] itself still takes the thread id to continue only from a turn that completed.
- Each completed message from the coding agent [4] yields one `text` progress event. Codex narrates in several messages, the last of which is its answer, so every message is streamed and the last one stands as the turn's final message. A turn in which Codex sent no message answers with an empty final message.
- Each work item Codex starts, of whatever kind, yields one `action` progress event carrying the item's kind only, such as `file_change`, never its arguments: the seam is the code and the outcome, not the tool calls.
- The line closing the turn carries the usage [5] (see "Usage: tokens, never a price").
- Everything else, including the line that opens the turn and the completion of a work item, is ignored.

The `result` progress event itself is reported by `cli-session.ts` once the process has exited successfully, not by the parser.

### Usage: tokens, never a price

#### Context

**User story**: the dashboard shows what an agent [7] cost in tokens; for a Codex agent, no price is shown.

**Problem**: Codex reports token counts but never a price. Reporting a price of zero would read as free, while an absent price reads as unknown, which is the truth.

#### Business logic

The usage [5] reported for a turn [2] carries token counts and no price. Codex's input count is its whole input, cached tokens included, so the uncached input is the input count minus the cached count, and the cached count is reported as tokens read from the prompt cache. The cached count is capped at the input count, so the uncached input can never go negative. The output count is reported as is: Codex's reasoning count is a part of it and is not added again. Tokens written to the prompt cache are reported as zero, since Codex bills no separate cache write. A count that is absent, negative or not a finite number reads as zero. When the closing line carries no usage object at all, or the turn never reaches its closing line, the turn reports no usage.

### No quota reading

#### Context

**Business logic story**: the driver [1] contract makes reading the account's quota [6] optional precisely so that a coding agent [4] that cannot report one simply does not.

#### Business logic

The Codex driver [1] offers no quota [6] reading at all. A caller that finds none does not gate Codex agents [7] on a quota.

### Ending the driver session

#### Context

See `## Context`.

#### Business logic

Ending a driver session [3] frees nothing: each turn's [2] process is spawned and reaped by that turn, so nothing durable is held. Ending twice is safe. While the driver session lives, the caller may read a file the coding agent [4] produced, by path relative to the driver session's directory (`session-support.ts`).
