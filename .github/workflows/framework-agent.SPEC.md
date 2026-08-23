The GitHub Actions half of the `actions` run target: the workflow the driver dispatches to execute one agent turn on a disposable GitHub Actions runner. A workflow run receives the prompt, runs Claude Code on a fresh checkout of the repository, pushes whatever the turn produced to the run branch the driver named, and uploads the turn's transcript as an artifact; the driver polls for the finished workflow run and reads the turn's outcome from that artifact. The workflow only ever starts by explicit dispatch — never on pushes or pull requests — and the driver dispatches it by file name in the project's own repository, so a repository using the `actions` run target carries a copy of this workflow (this copy serves The Framework's own repository).

## User story

The user picks the `actions` run target so an agent executes on a GitHub Actions runner instead of occupying their device. The agent still spends the user's own Claude subscription, the dashboard still replays the turn's events, and the turn's work comes back as a branch on the repository that the next turn continues on.

## Glossary

- **correlation id** — the unique id the driver generates for each turn and passes as the `correlation_id` input. The workflow echoes it into the workflow run's display name and into the artifact name; matching on it is the only way the driver can find the workflow run it started.
- **run branch** — the branch a workflow run pushes the turn's work to, named by the driver in the `branch` input. The driver keeps the name stable across an agent's turns, so consecutive workflow runs chain their work on it.

## Business logic — TL;DR

- **One workflow run is one agent turn** - each dispatch carries one prompt; the runner checks out the repository with full history and lets Claude Code run one full turn, capped at 60 minutes.
- **The correlation id is how the driver finds its workflow run** - dispatching returns no run id, so the workflow interpolates the driver's correlation id into the run name and the artifact name, and the driver matches on it.
- **The prompt never crosses a shell** - the prompt reaches the coding agent verbatim as an action input, and the optional model and resume ids are assembled through environment variables, so no dispatch input can become a command on the runner.
- **The turn spends the subscription, never an API key** - the run authenticates with a `claude setup-token` OAuth token held as a repository secret.
- **The work survives only as the run branch** - the runner vanishes when the job ends, so the workflow commits anything the agent left uncommitted and pushes to the run branch; a no-op turn pushes nothing.
- **The artifact is the only channel out** - the turn's transcript, the branch actually pushed, and the session id are uploaded even when the turn failed, kept for 7 days.

## Business logic

### One workflow run is one agent turn

#### User story

See `## User story`.

#### Business logic

The workflow runs only when dispatched. The dispatch carries: the prompt (required), the correlation id (required), and optionally a model id (empty means the coding agent's default), a prior session id to resume instead of starting fresh, and the run branch to push work to. The runner checks out the repository with its full git history, so the agent can read the log to understand what it is changing, and the job is capped at 60 minutes — far under GitHub's 6-hour limit, because a turn running that long has gone wrong.

The driver chains turns into one continuing session: it dispatches each next turn onto the run branch the previous turn pushed and passes the previous turn's session id for resumption. The workflow itself is stateless; all continuity lives in the run branch and the resumed session.

### The correlation id is how the driver finds its workflow run

#### User story

The dashboard shows the turn's events and outcome, so the driver must locate and read exactly the workflow run it started — among any other runs dispatched concurrently.

#### Business logic

Dispatching a workflow returns only an acknowledgement, never a run id. The driver therefore generates a correlation id unique to the turn; the workflow interpolates it into the workflow run's display name (`framework-agent <correlation id>`) and into the artifact name (`framework-run-<correlation id>`). The driver polls the repository's recently dispatched workflow runs for the name containing its correlation id, waits for it to complete, then downloads the artifact matching the same id. Both interpolations are load-bearing: dropping either leaves the driver unable to find its workflow run or its artifact.

### The prompt and arguments never cross a shell

#### User story

The prompt is arbitrary text — task descriptions, ticket bodies, live chat. Nothing in a dispatch may be able to execute commands on the runner.

#### Business logic

The prompt is handed to the coding agent verbatim as an action input; it never passes through a shell. The optional model id and resume session id are folded into the agent's command-line arguments via environment variables rather than templated into a shell script, so a crafted value cannot become a command; the driver additionally refuses to dispatch a model or resume id containing anything beyond plain identifier characters. The agent itself runs with every permission gate disabled: an unattended turn must be able to edit files and run commands, and by default the coding agent's non-interactive mode allows neither.

#### Rationale

Disabling the permission gates is safe precisely because the runner is disposable: it holds nothing but a throwaway checkout that is destroyed when the job ends. The same flag on a developer's machine would be reckless.

### The turn spends the subscription, never an API key

#### User story

The Framework never makes model calls of its own: every agent, wherever it runs, draws on the user's own Claude subscription.

#### Business logic

The repository holds a `claude setup-token` OAuth token as the secret `CLAUDE_CODE_OAUTH_TOKEN`; the workflow run authenticates the agent with it, so the turn draws down that account's subscription quota rather than metered API billing. The job must be allowed to mint an OIDC token: the action exchanges one to authenticate the OAuth token, and without that permission every workflow run fails before the agent starts. The job also holds write access to repository contents (to push the run branch) and to pull requests (the agent may open one).

### The work survives only as the run branch

#### User story

After the turn, the driver reads the agent's files off the repository and dispatches the next turn on top of them — but the runner and its checkout no longer exist.

#### Business logic

When the dispatch named a run branch, the workflow — even after a failed agent step — first commits anything the agent left uncommitted, so it is not lost with the runner, then pushes the result to the run branch. A turn that advanced nothing past the ref it checked out pushes nothing, so a no-op turn never creates an empty branch (when that base ref cannot be resolved, the workflow errs toward pushing). Pushing is the workflow's job, not the agent's — mirroring the local flow, where the framework pushes the agent branch and the agent only commits.

#### Rationale

The driver names the run branch in the dispatch, rather than discovering it afterwards, because the action reports no branch of its own for a dispatched run. The push authenticates through an explicitly tokenized URL because the agent step reconfigures git for itself and leaves the checkout's stored credentials unusable.

### The artifact is the only channel out

#### User story

The dashboard replays the whole turn — the agent's messages, its actions, and the final message carrying the framework's signals — and the driver needs the session id to resume the next turn.

#### Business logic

After the agent step, succeeded or failed, the workflow uploads one artifact, `framework-run-<correlation id>`, kept for 7 days. It holds the turn's full transcript (`execution.json`, the coding agent's complete message log — replaced by an empty log when the agent step crashed, so the driver reads an empty turn instead of failing on a missing file) and `meta.json` with the run branch actually pushed (empty when nothing was pushed) and the agent's session id. A finished workflow run exposes nothing else to the API, and the artifact is uploaded even for a failed turn — which is exactly when the transcript matters most.

#### Rationale

The files are staged in a directory whose name is not dot-prefixed: the artifact uploader silently drops files under hidden path segments, and a hidden staging directory would upload an artifact the driver finds empty.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
