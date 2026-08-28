The one place where an agent's run target — the `--run-on` choice — is turned into the thing that actually executes the agent's turns.

## Business logic — TL;DR

- **The run target picks the executor** - `actions` runs the agent on a GitHub Actions runner, `web` hands the task to a Claude Code cloud session, and anything else runs it locally on this device with the chosen driver.
- **`actions` refuses to start unconfigured** - without a resolved repo owner, repo name and GitHub token, the agent fails immediately with an explanation of what to set.
- **`web` needs nothing from the user** - the cloud session signs in with the same account the coding-agent CLI already uses, so every part of its configuration has a default.

## Business logic

### The run target picks the executor

#### User story

The user chooses where a task should run: on their own machine, on a GitHub Actions runner, or as a Claude Code cloud session. Everything else about the agent — prompt, project, handoff — stays the same.

#### Business logic

The run target is resolved once, at the moment an agent is created, and decides which executor drives the agent's turns for its whole life. The run target is a separate axis from the driver: choosing `local` still leaves the choice of Claude Code or Codex intact, and a `local` agent behaves exactly as it would if no run target had been named at all.

#### Rationale

The run target is deliberately kept separate from the driver choice: the GitHub owner, repo and token that the `actions` target needs have no meaning for a local agent, and folding them into the driver choice would push GitHub configuration onto every local agent.

### `actions` refuses to start unconfigured

#### User story

A user picks the `actions` run target in a project that has no GitHub origin remote or no token available. They should be told what is missing, not watch an agent start and fail obscurely.

#### Business logic

Running on a GitHub Actions runner requires the repo owner and name plus a GitHub token. When those are not available, the agent is refused up front with a message naming the remedy: set a GitHub origin remote and provide a GitHub token.

### `web` needs nothing from the user

#### User story

A user hands a task to a Claude Code cloud session without configuring any credentials for it.

#### Business logic

The `web` target requires no configuration of the framework's own: the coding-agent CLI already holds the account that the cloud session is signed in with — the same authentication the local driver runs on. Every part of the cloud session's configuration therefore has a default and the agent starts with no setup.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
