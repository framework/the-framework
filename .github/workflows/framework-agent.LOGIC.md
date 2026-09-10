Runs one turn [2] of an agent [1] on a GitHub-hosted runner instead of on the user's machine: The Framework's `github-actions` driver [3] dispatches this workflow with the prompt, and the workflow run, "the run" below, checks the repository out, runs Claude Code on that prompt with every permission granted, pushes whatever the coding agent [4] left behind to the branch the driver named, and uploads the coding agent's transcript together with that branch name as one artifact keyed by the driver's correlation id [5]. The run is the far end of the driver in `packages/agent-driver/src/actions.ts`: the driver never sees the runner, only what the run pushes and uploads.

## Context

**User story**: the user starts an agent whose location [6] is `actions`, so the agent's turns run on GitHub's runners and cost nothing on this machine; the agent's events, its final message and its branch still show up in the dashboard, and the next turn continues where the previous one stopped.

**Business logic story**: the driver starts a driver session [7] for the agent, and each prompt of that session is one dispatch of this workflow. The runner is discarded when the run ends, so everything the driver needs afterwards has to leave the runner before that: the work as a pushed branch, the transcript as an uploaded artifact.

**Problem**: dispatching a workflow answers with no run id, so the driver has no handle on the run it started. The driver therefore mints a correlation id per turn, passes it as an input, and the run echoes it into its display name and into its artifact name; the driver finds its run and its artifact by that id and by nothing else.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementation here is `github-actions`.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex. Only Claude Code runs on this workflow.
[5] correlation id: the id the driver mints for one turn, unique across driver processes, that the run echoes into its display name and its artifact name so the driver can find them.
[6] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[7] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.

## Business logic — TL;DR

- **When it runs and what it is given** - only on a manual dispatch, with the prompt, the correlation id, and optionally a model, a session id to resume and a branch to push to; the correlation id becomes part of the run's name.
- **What the run is allowed to do** - write the repository's contents and pull requests, mint an identity token, and run for at most 60 minutes; the coding agent itself runs with every permission granted, on a subscription OAuth token held by the repository.
- **How the coding agent is started** - a full-history checkout, then Claude Code on the prompt passed verbatim, with the model and the resumed session id passed as arguments that are never composed through shell interpolation.
- **What is pushed** - whatever the coding agent left, committed if needed, to the branch the driver named, but only when the turn advanced past the commit it started from, and even when the coding agent failed.
- **What is uploaded for the driver** - one artifact named after the correlation id holding the transcript and the name of the pushed branch, kept for 7 days, uploaded even when the coding agent failed.
- **How the driver and the run correlate** - the driver finds the run by the correlation id in its name, fails the turn when the run does not succeed, replays the uploaded transcript as the agent's events, and dispatches the next turn on the branch the run pushed.

## Business logic

### When it runs and what it is given

#### Context

See `## Context`.

#### Business logic

The workflow, named "framework-agent", never runs on a push or a pull request: it runs only when dispatched by hand or through GitHub's API, which is how the driver [3] starts it. It takes five inputs:

- `prompt` (required): what the agent [1] should do this turn [2]. The driver sends The Framework's system prompt and the user's prompt as one text, the system prompt first.
- `correlation_id` (required): the correlation id [5]. The run's display name is "framework-agent " followed by it.
- `model` (optional): the model id to run on; empty means the action's default.
- `resume_session_id` (optional): the session id of a prior driver session [7] to continue instead of starting fresh.
- `branch` (optional): the branch the run pushes its work to, so the driver can read the work back and run the next turn on it.

The driver dispatches the first turn on the repository's configured ref (its default is `main`) and every later turn on the branch the previous run pushed.

### What the run is allowed to do

#### Context

**Problem**: the coding agent [4] must be able to edit files, run commands, commit and open a pull request without anyone approving each action, since no human watches a runner; the runner being thrown away at the end of the run is what makes granting everything acceptable.

#### Business logic

The workflow is granted three permissions: writing the repository's contents (the push of the run branch), writing pull requests (the agent [1] may open one), and minting an identity token. The identity token is not optional: the action exchanges it to authenticate the subscription OAuth token, and without that permission every run fails with "Could not fetch an OIDC token".

The coding agent [4] authenticates with the repository secret `CLAUDE_CODE_OAUTH_TOKEN`, an OAuth token produced by `claude setup-token`: the run spends the user's subscription, never an API key of The Framework's. Without that secret the action cannot authenticate and the run fails.

The coding agent is started with all permissions skipped, because in this mode it is otherwise granted none and an unattended run could neither edit nor run anything.

One job runs on the latest Ubuntu runner and is cut off after 60 minutes, well under GitHub's cap of six hours: a turn [2] that runs longer has gone wrong.

### How the coding agent is started

#### Context

**Problem**: the prompt, the model id and the session id are inputs a caller controls; interpolating them into a shell script would let a crafted input become a command on the runner.

#### Business logic

The run checks the repository out with its full history, because the coding agent [4] reads the log to understand what it is changing.

The coding agent's arguments are composed from environment variables, never by interpolating inputs into the script: the permission skip always; `--model <model>` only when a model was given; `--resume <session id>` only when a session id was given. The driver [3] validates both values on its side too, refusing anything that is not a plain token of letters, digits, dots, underscores, colons and dashes.

The prompt is handed to the action as an input, verbatim and never through a shell, so a multi-line prompt is safe. The action then runs Claude Code on it for one turn [2].

### What is pushed

#### Context

**Problem**: the runner and its checkout vanish when the job ends, so the only way the driver [3] can read the agent's work, or run the next turn on top of it, is a branch on the remote. The action creates no branch for a dispatched run, so the workflow pushes one itself, to the name the driver chose. This mirrors the local flow: The Framework pushes the agent's branch, the coding agent [4] only commits.

#### Business logic

The push step runs even when the coding agent [4] step failed. When no branch was requested, the step logs "no run branch requested" and does nothing. Otherwise:

1. The git identity is set to "framework-agent".
2. Anything the coding agent left uncommitted is committed as "framework agent run (<branch>)", so it is not lost with the runner.
3. When the checkout's tip is still the commit the run started from (the dispatched ref's tip on the remote), nothing is pushed, so a turn [2] that changed nothing creates no empty branch. When that ref cannot be resolved, the run errs toward pushing.
4. The tip is pushed to the requested branch, creating or advancing it. The push authenticates explicitly with the workflow's own token through a tokenized URL: the coding agent's step runs its own git setup and leaves the checkout's persisted credentials unusable, so a plain push would fail with "Authentication failed".

The branch name is recorded as the step's output only when a push happened.

### What is uploaded for the driver

#### Context

**Problem**: an artifact is the only channel out of a run that the driver [3] can read over GitHub's API, and the transcript matters most exactly when the turn [2] failed.

#### Business logic

The collect step runs even when the coding agent [4] step failed. It assembles a directory `framework-run/` holding:

- `execution.json`: the transcript the action produced, a JSON array of the coding agent's messages. When the action produced none, the file holds an empty array, so a crashed coding agent yields an empty turn [2] rather than a driver error.
- `meta.json`: the name of the branch the run actually pushed (empty when nothing was pushed) and the coding agent's session id.

The directory is not dot-prefixed on purpose: the upload drops every file under a hidden path, and a hidden directory would upload nothing, leaving the driver [3] no artifact to read.

The directory is uploaded as one artifact named `framework-run-<correlation id>`, kept for 7 days, whether or not the coding agent succeeded.

### How the driver and the run correlate

#### Context

See `## Context`.

#### Business logic

The driver [3] side lives in `packages/agent-driver/src/actions.ts`; the contract between the two is:

- The driver mints one correlation id [5] per turn [2], unique across driver processes, and passes it as the `correlation_id` input. It finds its run among the workflow's recent dispatched runs by that id in the run's name, and its artifact among the run's artifacts by that id in the artifact's name.
- The driver names the branch the run pushes to, one stable name per driver session [7], and passes it as the `branch` input: the run's pushes chain on that branch from turn to turn.
- A run that completes with any conclusion other than success fails the turn, and the driver reports the run's URL.
- The uploaded `execution.json` is replayed as the agent's events in one burst when the run ends, since the run streams nothing while it runs; its final message is the turn's final message.
- The branch in `meta.json` is where the driver reads the agent's files from over GitHub's contents API, since the runner is gone, and the ref it dispatches the next turn on. The session id the driver continues with is read off the transcript itself.
