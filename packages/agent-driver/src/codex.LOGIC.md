Drives Codex as a driver [1]: each turn [2] is one non-interactive invocation of the `codex` command in the driver session's [3] directory, whose streamed JSON output is read for the coding agent's [4] messages, the kinds of work items it starts, its thread id and its token usage [5], and whose last message is the turn's answer. Codex has no system prompt flag, prices nothing, is never resumed by this driver and reports no quota [6]. Its implementation id is `codex`.

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
[7] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[8] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[9] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[10] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.
[11] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[12] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.

## Business logic — TL;DR

- **Starting and prompting Codex** - every turn [2] spawns `codex` in its non-interactive mode with streamed JSON output, pointed at the driver session's [3] directory, with the prompt over standard input.
- **Sandboxed to the directory** - Codex runs under its `workspace-write` sandbox unless the driver [1] was configured with `read-only` or `danger-full-access`; the flag that bypasses Codex's approvals and sandbox is never passed.
- **Framing rides ahead of the prompt** - Codex has no system prompt flag, so the driver session's framing [10] and the turn's extra framing are placed in front of the prompt, as their own block.
- **Model pass-through** - the model the caller names is passed to Codex as is; without one, Codex's own default runs.
- **Every turn starts fresh** - the driver never resumes a Codex conversation: a request to continue the previous turn, and an earlier session id to continue, are ignored and the turn runs fresh.
- **What is read off the streamed output** - the thread id as the session id, each completed message as streamed text with the last one as the turn's answer, and each started work item as a tool use named by its kind, with everything else ignored.
- **Usage: tokens, never a price** - Codex's token counts are reported with the cached part split out of its inclusive input total, and no price, never zero.
- **No quota reading** - the driver reports no quota [6] at all rather than a made-up number.
- **Ending the driver session** - nothing is freed; each turn's process is already gone when the turn ends.

## Business logic

### Starting and prompting Codex

#### Context

See `## Context`.

#### Business logic

Every turn [2] spawns the `codex` command, found on `PATH` unless the driver [1] was configured with another command, as one non-interactive invocation with one JSON event per output line (`codex exec --json`). Codex is pointed at the driver session's [3] directory, the agent's [7] checkout [8], which is also the process's working directory, and it is told to skip its own git repository check, because Codex otherwise refuses to run in a directory that is not a git repository and a directory may legitimately not be one yet. The process runs with the environment of The Framework's own process unless the driver was configured with another. The prompt is fed over standard input, never as an argument, so a long prompt never hits the command-line length limit. Extra command-line arguments the driver was configured with are appended verbatim, last. Spawning, streaming, the exit code, the stop request [9] and the reaping of the process tree follow `cli-session.ts`: a non-zero exit fails the turn even when text streamed first.

### Sandboxed to the directory

#### Context

**Problem**: a turn [2] in non-interactive mode cannot answer an approval prompt, so what the coding agent [4] may do without asking is decided up front. Codex's sandbox policy governs the shell commands the model writes.

#### Business logic

Unless told otherwise, Codex runs with its `workspace-write` sandbox, so the coding agent [4] can edit the directory it was pointed at and nothing else on the machine; this is the counterpart of Claude Code's `acceptEdits` permission mode. The driver [1] can be configured with `read-only` or with `danger-full-access` instead. Codex's flag that bypasses both its approvals and its sandbox is never passed, whatever the configuration.

### Framing rides ahead of the prompt

#### Context

**Business logic story**: the product's standing instructions for an agent [7] reach every coding agent [4] as framing [10]. Claude Code takes them as an addition to its system prompt; Codex has no such flag.

#### Business logic

The driver session's [3] framing [10] and the turn's [2] extra framing are joined as separate paragraphs, blank-line separated, and placed in front of the prompt with a blank line between the framing and the prompt, so the same words reach Codex as one block ahead of the task. A turn with no framing at all sends the prompt alone. Because every turn starts fresh (see "Every turn starts fresh"), the framing is sent on every turn.

### Model pass-through

#### Context

**User story**: the user picks a model for an agent [7] in the launcher.

#### Business logic

When the caller names a model, it is passed to Codex as is (`-m <id>`); the driver [1] neither validates nor substitutes it. Without one, Codex runs whatever model it defaults to.

### Every turn starts fresh

#### Context

**Business logic story**: the driver [1] contract makes continuing a conversation best effort: a driver that cannot resume runs a fresh turn [2] instead. A live chat [11] message to a Codex agent [7] therefore reaches Codex without the earlier turns' context.

#### Business logic

Each turn [2] is a fresh invocation of Codex. The caller's request to continue the previous turn is ignored, and so is an earlier session id the driver session [3] was started with; neither is passed to Codex. The thread id Codex announces is still reported as the turn's session id, so the caller can record it, but this driver [1] never uses it to resume.

### What is read off the streamed output

#### Context

**User story**: the agent view shows what Codex says and what kinds of work it does while the turn [2] runs, and the turn's final message when it settles.

#### Business logic

Codex streams one JSON object per line. A line that is not JSON, such as a banner, an empty line, or a JSON value that is not an object, is noise and is ignored. From each object:

- The line announcing the thread carries the thread id, which becomes the turn's [2] session id in the turn's answer. It is not reported as a `session` progress event [12] while the turn runs: the id only surfaces with the result, so a turn that never settles leaves no id behind.
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
