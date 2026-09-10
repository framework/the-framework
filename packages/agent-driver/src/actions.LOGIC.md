Drives Claude Code on a GitHub Actions runner as a driver [1]: each turn [2] dispatches one run of the project's agent workflow with the prompt as a workflow input, finds that run by a correlation id [3] of its own making, waits for it to finish, downloads the transcript the run uploads and replays it as the turn's progress events [4] and final message. Every run is a fresh runner with a fresh copy of the repository, so continuity across turns is a branch the driver names and every run pushes its work to. Its implementation id is `github-actions`.

## Context

**User story**:
- The user starts an agent [5] whose location [6] is `actions`; its turns [2] run on GitHub's runners instead of this machine, and the agent view shows a link to the run while it is in progress and, once it has finished, everything Claude Code said and did, all at once.
- The user picks a model for the agent, and sends live chat [7] messages that continue Claude Code's conversation on the next run.

**Business logic story**: the workflow the driver [1] dispatches is `.github/workflows/framework-agent.yml`. On the runner, Claude Code authenticates with an OAuth token the repository holds as a secret, produced by `claude setup-token`, so every run spends the user's subscription; The Framework never holds a model key and passes none. The driver itself holds a GitHub token that dispatches the workflow and reads runs, artifacts and file contents; it must be a user's token, since the action refuses an agent run triggered by a bot. What the driver requires of the workflow: the inputs `prompt`, `correlation_id` and `branch`, optionally `model` and `resume_session_id`; the correlation id [3] echoed into the run's display name; the run's work pushed to the `branch` input; and one uploaded artifact named after the correlation id, holding `execution.json` (Claude Code's transcript as a JSON array) and `meta.json` (the branch the run pushed). The workflow answers with minutes, not seconds, and with no live stream: the transcript arrives once, at the end.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] correlation id: the id the driver makes up for one turn and hands the workflow, which echoes it into the run's display name and the artifact's name; it is the only way the driver finds its own run, since dispatching a workflow answers with no run id.
[4] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[7] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[8] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[9] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.
[10] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[11] coding agent: the CLI doing the actual work: Claude Code or Codex.
[12] usage: what one turn spent, as the coding agent reports it: token counts, and a notional price in US dollars when the coding agent prices its turns.
[13] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.

## Business logic — TL;DR

- **One turn is one workflow run** - a turn [2] dispatches the workflow with the framing [9] placed ahead of the prompt, the correlation id [3], the run branch, and the model and session id when there are any, on the branch the previous run pushed or else the configured ref or `main`.
- **The correlation id** - `<driver session id>-turn-<n>`, where the driver session [8] id carries a random tag so two daemons, or two processes of one daemon, never match each other's runs.
- **Only ids reach the runner's shell** - a model id or session id containing anything but letters, digits, dots, underscores, colons and hyphens is refused before dispatch; the prompt is a workflow input and never goes through a shell.
- **Waiting for the run** - the workflow's recent runs are polled every 5 seconds for one whose display name contains the correlation id; the run's link is reported once as an action; a run that concludes with anything but success fails the turn, naming the run; the wait gives up after 1 hour; a stop request [10] ends the wait, not the run.
- **Reading the transcript back** - the run's artifact named after the correlation id is downloaded as a zip and read for `execution.json` and `meta.json`; a run without an artifact or without a transcript fails the turn.
- **Replaying the transcript** - the transcript is a JSON array of the messages Claude Code streams one per line, read by the Claude Code parser, so the progress events replay in a burst at the end and the last message is the turn's answer; a transcript that is not a JSON array fails the turn, and an empty one is an empty turn.
- **Continuity through the branch** - the driver names one run branch per driver session, `claude/<driver session id>`, that every run pushes to; the branch a run reports back is where the next turn is dispatched and where produced code is read.
- **Continuing the driver session** - the session id read off the last transcript, or the one the driver session was started with, is passed to the workflow when a turn asks to continue.
- **Model pass-through** - the model the caller names is passed as a workflow input; without one, the action's default runs.
- **Reading produced code off the branch** - the runner is gone, so a file is read from the pushed branch over GitHub's contents API; before any run has pushed one, the reader is told so.
- **No quota reading** - the driver reports no quota [13]: it belongs to the account whose token the repository holds, and the runner that could answer is torn down.
- **GitHub API failures** - any failed GitHub API call fails the turn with the call, the status and the start of GitHub's answer.
- **Ending the driver session** - nothing is freed; every run reaps itself on the runner.

## Business logic

### One turn is one workflow run

#### Context

See `## Context`.

#### Business logic

A turn [2] first reports a `start` progress event [4] carrying the prompt it sends. The driver session's [8] framing [9] and the turn's extra framing are joined as separate paragraphs and placed ahead of the prompt with a blank line between, as with Codex, because the prompt is passed to the action as a workflow input, where a multi-line prompt is safe, whereas a system prompt flag would have to survive shell quoting inside the workflow and is not worth an injection seam. The workflow is dispatched with the inputs `prompt` (framing plus prompt), `correlation_id` (see "The correlation id"), `branch` (the run branch, see "Continuity through the branch"), `model` when the caller named one, and `resume_session_id` when the turn asks to continue and a session id is known (see "Continuing the driver session"). It is dispatched on the branch the previous run pushed; the first turn, and any turn after a run that pushed nothing, is dispatched on the ref the driver [1] was configured with, or `main` when none was. Dispatching answers with no run id, which is why the correlation id [3] exists. Once dispatched, a `notice` progress event tells the user "Dispatched <correlation id> to <owner>/<repository>; waiting for the runner."

### The correlation id

#### Context

**Problem**: dispatching a workflow answers with nothing, so the driver [1] cannot be told which run is its own. The daemon starts a fresh process per agent [5], and a counter alone would restart at one in each, so two agents would both look for a run named after the same first turn [2] and one could latch onto the other's run.

#### Business logic

Each driver session [8] gets an id of the form `actions-<counter>-<tag>`: the counter climbs within one process and reads well in logs, and the tag is eight random characters that keep the id unique across processes. Each turn's [2] correlation id [3] is `<driver session id>-turn-<n>` with `n` climbing from 1 within the driver session, so it is unique per turn. The workflow echoes it into the run's display name and into the artifact's name, and the driver [1] matches on it in both places.

### Only ids reach the runner's shell

#### Context

**Problem**: the model id and the session id are composed into a command line by a shell on the runner. An id that is not an id is a bug or an attack, and the workflow's own care in composing its arguments from environment variables is only one half of the protection.

#### Business logic

Before dispatch, the model id and the session id to resume must consist only of letters, digits, dots, underscores, colons and hyphens. Anything else fails the turn [2] before anything reaches GitHub: "Refusing to pass an unsafe model to the workflow: <value>", or "Refusing to pass an unsafe resume session id to the workflow: <value>". The prompt is never checked this way, because the action takes it as an input verbatim and never through a shell.

### Waiting for the run

#### Context

**User story**: the user sees, in the agent view, a link to the run as soon as GitHub has created it, and the agent [5] fails plainly when the run goes red rather than passing a broken run off as a result.

#### Business logic

After dispatch the driver [1] polls the repository's fifty most recent dispatched workflow runs, every 5 seconds unless configured otherwise, for a run whose display name contains the correlation id [3]. While GitHub is still creating the run, nothing is found and polling continues. The first time the run is found, one `action` progress event [4] reports "run <run URL>", and never again. Once the run has completed, its conclusion decides the turn [2]: `success` lets the turn go on to read the transcript; any other conclusion fails the turn with `GitHub Actions run concluded "<conclusion>": <run URL>`, the URL being the only way to see why it went red. The wait gives up after 1 hour unless configured otherwise, failing the turn with "Timed out waiting for the GitHub Actions run (<correlation id>)." A stop request [10], the driver session's [8] or the turn's own, is checked before and after each pause and fails the turn with "Session aborted while waiting for the GitHub Actions run."; the run itself is not cancelled and keeps going on the runner.

### Reading the transcript back

#### Context

**Problem**: the runner and its copy of the repository vanish when the job ends. The one channel out of a run that the driver [1] can read is the artifact the workflow uploads, always, even when the turn [2] failed on the runner, which is exactly when it is most worth reading.

#### Business logic

The driver [1] lists the run's artifacts and takes the one whose name contains the correlation id [3], or the first artifact when none matches. A run that uploaded no artifact fails the turn [2]: "Run <run id> uploaded no artifact; the workflow must upload the transcript as one." The artifact is downloaded as a zip and read with the reader in `actions-zip.ts`. The entry ending in `execution.json` is the transcript; without one the turn fails with "Artifact <name> has no execution.json (entries: <names, or none>)". The entry ending in `meta.json` names the branch the run pushed: a missing entry, a malformed one, or an empty branch means the run pushed nothing, which costs the next turn's continuity and the reading of produced code, never the turn.

### Replaying the transcript

#### Context

**Business logic story**: the transcript is a JSON array holding exactly the messages Claude Code streams one per line when it runs on this machine. The whole difference between a local turn [2] and a runner's turn is array versus lines, so the transcript is read by the same parser as a local turn (`claude-code.ts`).

#### Business logic

The transcript is parsed as JSON; a transcript that is not JSON fails the turn [2] with "Could not parse the run transcript as JSON: <reason>", and one that is not a JSON array with "The run transcript is not a JSON array of messages.", so a transcript in a shape the driver [1] does not recognize never reads as an agent [5] that did nothing. Each message is fed to the Claude Code parser, and the progress events [4] it yields (the session id first, then text and tool names) replay in a burst at the end of the turn: this driver has no live stream, and the caller sees the same event stream either way. An empty array, which is what the workflow uploads when the action crashed before writing a transcript, is an empty turn with an empty final message rather than a failure. The parser's result is the turn's answer: the final message, the session id and the usage [12], reported once more as the `result` progress event.

### Continuity through the branch

#### Context

**Problem**: every run is a fresh runner and a fresh copy of the repository, so the machine cannot carry state from one turn [2] to the next; only a branch on the remote can. The action leaves its own branch name empty for a dispatched run, so there is nothing to discover after the fact: the driver [1] has to name the branch itself.

#### Business logic

Each driver session [8] names one run branch, the configured prefix followed by the driver session id, `claude/<driver session id>` by default, and passes it as the `branch` input of every turn's [2] dispatch, so each run pushes its work to the same branch and a later run builds on the earlier one. The branch the run reports back in `meta.json` is remembered as the branch of the driver session: the next turn is dispatched on it, and produced code is read from it. Until a run has reported a branch, turns are dispatched on the configured ref or `main`.

### Continuing the driver session

#### Context

**User story**: the user sends a live chat [7] message to a running agent [5], and it lands in the same Claude Code conversation on the next run; the user revives a finished agent, and its opening prompt continues the conversation it had.

#### Business logic

The driver session [8] keeps the session id read off the last turn's [2] transcript; a driver session started with the session id of an earlier driver session begins with that one. A turn that asks to continue the previous turn passes the known session id to the workflow as `resume_session_id`, after the id check in "Only ids reach the runner's shell", and the workflow resumes Claude Code with it. A turn that asks to continue when no session id is known, and a turn that does not ask, are dispatched without one and run fresh. Whether the runner can actually resume the conversation is the workflow's and Claude Code's business; the driver [1] passes the id and reads what comes back.

### Model pass-through

#### Context

**User story**: the user picks a model for an agent [5] in the launcher.

#### Business logic

When the caller names a model, it is passed as the workflow's `model` input, after the id check in "Only ids reach the runner's shell"; the driver [1] neither validates it further nor substitutes it. Without one, the input is left out and the action's default model runs.

### Reading produced code off the branch

#### Context

**Business logic story**: the seam is the code, so a caller verifies a turn [2] by reading what the coding agent [11] left behind. The runner is gone by then, so the code is read from the branch the run pushed, over GitHub's contents API, rather than from disk.

#### Business logic

A file is read by its path relative to the repository root, from the branch the last run reported, and decoded as UTF-8 text from GitHub's answer. Before any run of the driver session [8] has reported a branch, reading fails with "No branch yet: readCode is only available after a run has pushed one." A path that is not a file on that branch fails with "<path> is not a file on <branch>".

### No quota reading

#### Context

**Business logic story**: the quota [13] every run draws down is the subscription of whichever account's OAuth token the repository holds, not the runner's minutes; free runner minutes on a public repository change nothing about it. The runner that could report that quota is torn down before the driver [1] ever reads it.

#### Business logic

The driver [1] offers no quota [13] reading at all rather than a made-up number.

### GitHub API failures

#### Context

**Problem**: dispatching, polling, listing and downloading artifacts and reading files are all GitHub API calls, each of which can fail on a bad token, a missing workflow, a missing permission or an outage. The user must see which call failed and what GitHub said.

#### Business logic

Every call carries the driver's [1] GitHub token as a bearer token. A call GitHub does not answer successfully fails the turn [2], or the code read, with "GitHub API <method> <path> failed (<status> <status text>): <the first 500 characters of GitHub's answer>", or "<no body>" when the answer cannot be read, so the real error is never replaced by a failure to read its body.

### Ending the driver session

#### Context

See `## Context`.

#### Business logic

Ending a driver session [8] frees nothing: every run reaps itself on the runner, and the driver [1] holds no process. Ending twice is safe.
