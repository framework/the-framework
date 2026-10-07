Drives Codex as a driver [1]: each turn [2] is one `codex app-server` process in the driver session's [3] directory, asked for one turn over its JSON-RPC protocol and read for the coding agent's [4] messages, as they are written and whole, what each tool call did, what a command printed and what a file change did to each file, its thoughts, its thread id, the model it runs and its token usage [5]; the last message is the turn's answer. Codex takes the framing as its developer instructions, prices nothing and reports no quota [6], and lists the models it offers through its own model catalog; a turn asked to continue the driver session's conversation resumes it by its thread id. Its implementation id is `codex`.

## Context

**User story**:
- The user picks Codex as the driver [1] and starts an agent [7]; the agent view shows what Codex says, word by word as it writes, and what work it does, turn [2] by turn.
- The user picks a model for the agent; the dashboard shows what the agent spent in tokens, and no price.

**Business logic story**: Codex runs on the user's own ChatGPT login, a subscription in the normal case. OpenAgent holds no model key and passes none: Codex authenticates itself, keeps its own loop and its own tools, and OpenAgent only prompts it and reads what comes back. Running the process, deciding success on its exit code and on what its output said, stopping it and reaping its process tree are the rules of `agent-driver`'s `cli-session.ts`, shared with the Claude Code driver. A turn has no time limit of its own.

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
[10] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them apart from the prompt when the coding agent takes such instructions (Claude Code's system prompt, Codex's developer instructions), or ahead of the prompt when it does not.
[11] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[12] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice, a question.
[13] personal setup: the three parts of the person's own setup a coding agent loads when started by hand, by the names every adapter takes: `memory` (what the coding agent remembers across sessions on its own), `connectors` (the apps and accounts linked to the person's login), `skills` (the person's own instructions, skills and settings files).
[14] Codex home: the folder Codex reads the person's login, instructions, skills, configuration and memories from, and saves its conversations in: `~/.codex` unless `CODEX_HOME` names another.

## Business logic — TL;DR

- **The shared end of a turn, and the log** - the session attaches the log when the caller asked for one, so every event is recorded before the caller sees it; every turn ends the shared way (`agent-driver`'s `inbox.ts`): the question reported, the inbox drained into further turns of the same session.
- **Starting and prompting Codex** - every turn [2] spawns `codex app-server` in the driver session's [3] directory and holds one exchange with it over standard input and output: a conversation started or resumed, one turn asked for, standard input closed once the turn has ended.
- **Sandboxed to the directory** - Codex runs under its `workspace-write` sandbox unless the driver [1] was configured with `read-only` or `danger-full-access`; under `workspace-write` the directory's git repository data is writable too, so the coding agent [4] can commit; Codex is told never to ask for an approval, and a request of its own is refused; nothing bypasses the sandbox.
- **Framing as developer instructions** - the driver session's framing [10] and the turn's extra framing start a fresh conversation as Codex's developer instructions, apart from the prompt.
- **Model pass-through** - the model the caller names is passed to Codex as is; without one, Codex's own default runs. Either way, the model the conversation runs on, by Codex's own id, is reported as a `model` progress event.
- **Continuing the conversation** - a turn asked to continue resumes the driver session's [3] Codex conversation by its thread id: the one the driver session was started to continue, then the one the last turn reported; a turn not asked to, or with no conversation yet, starts fresh.
- **What is read off the app server's messages** - the thread id as the session id, announced at once as a `session` progress event, and the model; each message as it is written, piece by piece, then whole as streamed text with the last one as the turn's answer; each reasoning summary as a thought; each started work item as a tool use named by its kind with what it did; how the turn ended and why a failed turn failed; everything else ignored.
- **Usage: tokens, never a price** - Codex's token counts for the turn, summed over its model calls, are reported with the cached part split out of its inclusive input total, and no price, never zero.
- **No quota reading** - the driver reports no quota [6] at all rather than a made-up number.
- **Listing the models** - `codex debug models`, asked with the person's own Codex home, answers Codex's model catalog; the models it lists (visibility `list`) are kept, in Codex's own order (its priority), each by its slug and its display name; a failed or unreadable answer fails with the reason.
- **The person's own setup** - each part of the personal setup [13] the caller turns off becomes Codex's own switch: `memory` off is `features.memories=false`, `connectors` off is `features.apps=false` and `features.plugins=false`, `skills` off runs Codex from a Codex home [14] of its own, kept on this machine and starting with only a link to the person's login; given none, Codex loads everything.
- **Can a session start here** - `codex` asked `--version`, then `login status`, read as a sentence; with `skills` off, skills in `~/.agents/skills` are a warning, since Codex has no switch for that folder.
- **Ending the driver session** - nothing is freed; each turn's process is already gone when the turn ends.

## Business logic

### Starting and prompting Codex

#### Context

See `## Context`.

#### Business logic

Every turn [2] spawns the `codex` command, found on `PATH` unless the driver [1] was configured with another command, as its app server (`codex app-server`): a process that speaks JSON-RPC, one JSON message per line, over its standard input and output. The process's working directory is the driver session's [3] directory, the agent's [7] checkout [8]. It runs with the environment of OpenAgent's own process unless the driver was configured with another; when the driver session keeps a log, that environment also carries `AGENT_DIARY`, the diary's path (the rule of `agent-driver`'s `session-log.ts`). Extra command-line arguments the driver was configured with are appended verbatim, last.

The exchange, all of it written by the driver as the app server answers:

1. `initialize`, naming the client `agent-driver`, then the `initialized` notice once it is answered.
2. A conversation: `thread/start` for a fresh one, or `thread/resume` with the thread id for one that continues (see "Continuing the conversation"). Either names the directory, the sandbox (see "Sandboxed to the directory"), the approval policy `never`, and the model when the caller named one; a fresh one also carries the framing [10] (see "Framing as developer instructions").
3. Once the conversation is answered: `turn/start` on its thread id, with the prompt, and after an empty line the sentence the caller added after it when there is one, as the one text input. The prompt never appears on the command line, so a long prompt never hits the command-line length limit.
4. Once the app server says the turn completed, however it ended, standard input is closed, and the app server exits.

Closing standard input ends the app server at once, turn or no turn (seen with codex-cli 0.144.4), so it stays open until the turn has completed, or until a request of the driver's is refused. A request the app server makes of its own, such as an approval or a question for the user, is answered with a refusal: nobody is there to answer it, and the turn goes on without. Spawning, streaming, the exit code, the stop request [9] and the reaping of the process tree follow `agent-driver`'s `cli-session.ts`: a non-zero exit fails the turn even when text streamed first, and so does a clean exit before the turn completed, or after a turn that failed.

### Sandboxed to the directory

#### Context

**Problem**: nobody is there to answer an approval request during a turn [2], so what the coding agent [4] may do without asking is decided up front. Codex's sandbox policy governs the shell commands the model writes.

#### Business logic

Unless told otherwise, Codex runs with its `workspace-write` sandbox, so the coding agent [4] can edit the directory it was pointed at and nothing else on the machine; this is the counterpart of Claude Code's `acceptEdits` permission mode. The driver [1] can be configured with `read-only` or with `danger-full-access` instead. The sandbox is asked for with the conversation, fresh or resumed, together with the approval policy `never`: Codex never stops to ask, and what it may not do fails inside the sandbox instead. Nothing that bypasses the sandbox is ever asked for, whatever the configuration.

Under `workspace-write`, Codex keeps a `.git` directory at the root of the directory read-only. In a plain clone, as opposed to a git worktree such as an agent's checkout [8], that makes the coding agent's [4] first commit or branch rename fail. So on every turn [2] the driver asks git for the absolute path of the directory's git repository data (the common git directory, which for a worktree is the main checkout's `.git`) and tells Codex to make that path writable as well, on the app server's command line (`-c sandbox_workspace_write.writable_roots=[…]`). The path is resolved per turn, not once, because the coding agent may turn the directory into a git repository during an earlier turn. When the directory is not in a git repository, or git is not installed, nothing is added and the turn runs as before. Nothing is added under `read-only` or `danger-full-access`. A writable git directory also lets the coding agent change the repository's hooks and configuration, which run later outside the sandbox; this is accepted, since committing is the coding agent's job and a worktree's git data was already writable. Extra command-line arguments the driver was configured with come after, so one that sets Codex's writable paths itself replaces this path rather than adding to it.

### Framing as developer instructions

#### Context

**Business logic story**: the product's standing instructions for an agent [7] reach every coding agent [4] as framing [10]. Claude Code takes them as an addition to its system prompt; Codex takes them as its developer instructions, which a conversation keeps for all its turns.

#### Business logic

The driver session's [3] framing [10] and the turn's [2] extra framing are joined as separate paragraphs, blank-line separated, and given to a fresh conversation as Codex's developer instructions; the prompt is sent alone, as the turn's input. A turn with no framing at all gives no developer instructions. A turn that continues the conversation (see "Continuing the conversation") gives none either: the conversation keeps the ones it was started with (seen with codex-cli 0.144.4), and the turn's own extra framing is not sent.

### Model pass-through

#### Context

**User story**: the user picks a model for an agent [7] in the launcher.

#### Business logic

When the caller names a model, it is passed to Codex as is, with the conversation, fresh or resumed; the driver [1] neither validates nor substitutes it. Without one, Codex runs whatever model it defaults to. Codex answers the conversation with the model it runs on, by its own id (such as `gpt-5.6-terra`), and that is reported as a `model` progress event [12], so a run started without a model still says which one ran.

### Continuing the conversation

#### Context

**User story**: the user answers a Codex agent's [7] question, or sends it a message (live chat [11]), and the agent goes on with everything it did before in mind, as a Claude Code agent does.

**Business logic story**: a caller asks a turn [2] to continue the previous one (the inbox does, for every waiting line, and so does a runner resuming an ended run), and may start a driver session [3] with an earlier session id to continue. Codex keeps its conversations itself and continues one by its thread id (`thread/resume`).

#### Business logic

The driver session [3] remembers one thread id: the earlier session id it was started with, if any, then the thread id each turn [2] reports, which Codex keeps the same across a continued conversation. A turn asked to continue, when a thread id is known, resumes that thread instead of starting one: the same directory, sandbox, approval policy and model as a fresh one, and no framing. A turn not asked to continue, and a turn asked to when no thread id is known yet, starts a fresh conversation. A resume Codex refuses fails the turn with Codex's own message; nothing is retried fresh.

### What is read off the app server's messages

#### Context

**User story**: the agent view shows what Codex says, word by word as it writes, and what work it does while the turn [2] runs, and the turn's final message when it settles.

#### Business logic

The app server sends one JSON message per line: answers to the driver's requests, requests of its own (see "Starting and prompting Codex"), and notices. A line that is not JSON, such as a banner, an empty line, or a JSON value that is not an object, is noise and is ignored. From what it sends:

- The answer to the conversation carries the thread id, which becomes the turn's [2] session id in the turn's answer. It is also reported at once as a `session` progress event [12], ahead of everything else the turn streams, as Claude Code's is: a turn that is stopped or fails before its result still leaves the id behind (on the log, when the caller asked for one), the handle a later resume of the conversation needs. The driver session [3] itself still takes the thread id to continue only from a turn that completed. The same answer names the model, reported right after (see "Model pass-through").
- Each piece of a message the coding agent [4] is writing yields one `partial` progress event carrying the message so far, not the piece alone; a new message starts from nothing. The pieces are for showing only: the log keeps them apart from the diary and drops them once the message is whole (`agent-driver`'s `session-log.ts`).
- Each completed message yields one `text` progress event. Codex narrates in several messages, the last of which is its answer, so every message is streamed and the last one stands as the turn's final message. A turn in which Codex sent no message answers with an empty final message.
- Each completed reasoning item with a summary yields one `thought` progress event carrying the summary, Codex's headline of what it is thinking, its lines joined by line breaks.
- Each other work item Codex starts yields one `action` progress event carrying the item's kind, such as `commandExecution` or `fileChange`, and its detail when it has one, flattened to one line and cut to 200 characters: a command without the shell wrapper Codex puts around it (`/bin/zsh -lc '…'`), the paths a file change touches, joined by commas, an MCP tool as `<server>.<tool>`, or a web search's query. When that line is not all of it, the event also carries it whole, lines kept (`agent-driver`'s `session-support.ts`). The event carries the item's id. The prompt echoed back as the user's message is not a work item.
- Each command that finished yields one `output` progress event: the id of its item, everything the command printed, cut to the size limit of an output, its exit code, and that it failed when the exit code is not 0. A command that printed nothing and did not fail yields nothing.
- Each file change that finished yields one `output` progress event: the id of its item, no text, and each file it changed: its path, the lines added and the lines removed. Codex gives each file a kind (`add`, `delete` or `update`, as a word or as an object naming it) and a diff. A changed file's diff is a patch, whose added and removed lines are counted (`agent-driver`'s `session-support.ts`). An added file is said to be created, and a deleted file only has lines removed: when the diff is a patch (its first line is a hunk header, a line that starts with `@@`, or a diff's file header), the patch's lines are counted; when it is not, it is the file's content, and every line of it is added, or removed. A file with no diff is said with no line added or removed. A file with no path is not said. A file change that failed or was declined changed no file and yields nothing, as does one whose files all have no path.
- Codex reports no output for its other work items.
- Each token reading of the turn adds to its usage [5] (see "Usage: tokens, never a price").
- The notice that the turn completed ends the exchange. A turn that completed is the turn's answer; one that failed, was interrupted or ended otherwise fails the turn [2] with Codex's reason, such as a model the person's account cannot use. When the reason is the API's own error body (JSON with an inner error message), the inner message is the reason; otherwise the text is; a turn that ended without one fails with "Codex's turn ended <how>". An error answer to one of the driver's own requests fails the turn the same way, with its message.
- Everything else, including the opening of the turn and the completion of a work item that is neither a command nor a file change, is ignored.

The `result` progress event itself is reported by `agent-driver`'s `cli-session.ts` once the process has exited after a completed turn, not by this reading.

### Usage: tokens, never a price

#### Context

**User story**: the dashboard shows what an agent [7] cost in tokens; for a Codex agent, no price is shown.

**Problem**: Codex reports token counts but never a price. Reporting a price of zero would read as free, while an absent price reads as unknown, which is the truth.

#### Business logic

The usage [5] reported for a turn [2] carries token counts and no price. Codex reports a reading after each model call of the turn; the turn's usage is the sum of them. A resumed conversation first repeats the reading of its previous turn, which belongs to that turn and is not counted. Codex's input count is its whole input, cached tokens included, so the uncached input is the input count minus the cached count, and the cached count is reported as tokens read from the prompt cache. The cached count is capped at the input count, so the uncached input can never go negative. The output count is reported as is: Codex's reasoning count is a part of it and is not added again. Tokens written to the prompt cache are reported as zero, since Codex bills no separate cache write. A count that is absent, negative or not a finite number reads as zero. When no reading of the turn arrives, the turn reports no usage.

### No quota reading

#### Context

**Business logic story**: the driver [1] contract makes reading the account's quota [6] optional precisely so that a coding agent [4] that cannot report one simply does not.

#### Business logic

The Codex driver [1] offers no quota [6] reading at all. A caller that finds none does not gate Codex agents [7] on a quota.

### Listing the models

#### Context

**User story**: the user picks the model for the next agent [7] from the models their own Codex offers, by the names Codex shows.

**Problem**: the models a ChatGPT login may use change with Codex's releases and the person's plan, so no list written into OpenAgent stays right.

#### Business logic

On request, the driver [1] runs `codex debug models`, with the environment it was configured with and so the person's own Codex home, where their login is. Codex answers its whole model catalog as JSON. The models whose visibility is `list`, the ones Codex's own picker offers, are kept; hidden ones are left out. They are ordered by Codex's priority, lowest first, a model without one last. Each is its slug, the id a driver session takes, and its display name, or the slug when it has none. The catalog is Codex's word, not a guarantee: a listed model can still be refused when a turn [2] runs on it. A `codex` that cannot be started, a non-zero exit (with what Codex said on standard error), an answer that is not JSON, an answer without a model list, no answer within 30 seconds and the caller's stop request each fail the listing with the reason in words; the process is stopped either way.

### The person's own setup

#### Context

**User story**: the user's scheduled runs on Codex do the same job on every machine: they do not follow the user's own `AGENTS.md`, reach for a skill only they have, or use the Slack or Notion app of their ChatGPT account, unless this machine turns that part on. The user sets nothing up for it beyond logging in to Codex once.

**Business logic story**: the caller (the runner, `packages/agent-runner`) says which parts of the personal setup [13] to load; this driver alone knows how Codex turns each off. Each switch was checked with real runs of codex-cli 0.144.4.

#### Business logic

A driver given a personal setup turns each part that is off into Codex's own switches, and gives none for a part that is on:

- `memory` off: `-c features.memories=false` on the command line, so no memories. The feature is off by default; the switch keeps it off where a person turned it on.
- `connectors` off: `-c features.apps=false -c features.plugins=false`, so none of the apps and plugins of the ChatGPT account (Slack, Notion, Figma and the like), which Codex otherwise loads whatever its home.
- `skills` off: Codex runs with `CODEX_HOME` naming a Codex home [14] of the driver's own instead of the person's, so the `AGENTS.md`, skills, `config.toml` (with any model provider, login or MCP server set there) and memories in the person's Codex home stay out. With `skills` off, `memory` on therefore brings nothing back, and the readiness check says so.

The driver's own Codex home:

- **Where**: `$XDG_STATE_HOME/agent-driver/codex-home`, or `$HOME/.local/state/agent-driver/codex-home` when that variable is unset or empty, unless the driver was given another; one per machine, shared by every project. The variables are read from the environment the driver was given (this process's when none was given); a relative path is taken from this process's working directory, and Codex is handed the absolute path.
- **Made when a driver session starts**, and a failure there fails the start. It is created when missing and starts with only a link named `auth.json` to the person's login: `auth.json` in the person's Codex home (`CODEX_HOME`, else `$HOME/.codex`), linked even when that file does not exist yet. When the two homes are the same folder, by any path (Codex started from inside a run that already uses the kept home), nothing is linked.
- **The link kept right**: a link that is missing, or whose target is not exactly the person's `auth.json` by its absolute path, is put back. A plain file in its place is a login Codex saved over the link: it is moved aside, copied onto the person's file (a failed copy puts it back where it was and fails the start) when it is newer than theirs or they have none (their Codex home created if missing), then discarded, and the link is put back, so a refreshed login is never lost; an older one is discarded without being copied. Anything else in its place fails the start, naming it. Two sessions starting at once both start and take the saved file at most once.
- **Kept, never temporary**: Codex saves its conversations in its home, so a session resumed with `skills` off finds the conversation it started there, and a conversation started with `skills` on is not found with `skills` off, nor the other way round.
- **One login**: Codex writes a refreshed login through the link into the person's own file (seen with codex-cli 0.144.4), so the person and the runs stay logged in as one. A login kept anywhere but `auth.json` (in the system keyring, or through a provider set in `config.toml`) is not linked, and such a run starts logged out; the readiness check asks Codex in the person's own home, so it does not catch that.

Codex's built-in skills load in any home; they are Codex's, not the person's, so nothing warns about them. Skills in `~/.agents/skills` load whatever the parts say: Codex reads that folder from the home directory it runs with, and changing the home directory would also move git's and `gh`'s own credentials. The readiness check warns about it (see "Can a session start here").

The `memory` and `connectors` switches go ahead of any extra arguments the driver was configured with, so a caller's own `-c` for the same feature wins, and they go on every turn, a resumed one included. A driver given no personal setup adds none of these, and Codex loads everything. The project's `AGENTS.md` and its skills load either way.

### Can a session start here

#### Context

**User story**: the user picks Codex in the dashboard's launcher, and a missing or logged-out `codex`, or a personal skill a run cannot keep out, is said under the prompt box before the Start.

#### Business logic

The readiness check (`agent-driver`'s `ready.ts`) asks `codex --version`, then `codex login status`. That answers in a sentence: "not logged in" (any case) is no, checked first because it contains the positive; "logged in" is yes; anything else is "could not say" and passes. A missing CLI is "`codex` not found — install the Codex CLI and make sure `codex` is on your PATH: https://developers.openai.com/codex/cli"; a logged-out one is "`codex` is not logged in. Run `codex login`, then start again."

When the caller's personal setup [13] has `skills` off and `~/.agents/skills` (in the home folder of this process, or the folder the caller names) holds anything not starting with a dot, the answer carries the warning "Codex loads your skills in <folder> even with `skills` off: it has no switch for that folder. Move them out to keep them out of runs." A missing, empty or unreadable folder, `skills` on, or no personal setup given adds nothing. With `skills` off and `memory` on, the answer also carries the warning "`memory` on does nothing for Codex while `skills` is off: Codex keeps its memories in your own Codex home, which runs then do not use. Turn `skills` on too to bring them back, or `memory` off."

### Ending the driver session

#### Context

See `## Context`.

#### Business logic

Ending a driver session [3] frees nothing: each turn's [2] process is spawned and reaped by that turn, so nothing durable is held. Ending twice is safe. While the driver session lives, the caller may read a file the coding agent [4] produced, by path relative to the driver session's directory (`agent-driver`'s `session-support.ts`).
