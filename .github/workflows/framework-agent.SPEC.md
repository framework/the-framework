The workflow the product dispatches to run one coding-agent turn on a disposable GitHub-hosted runner — how an agent runs "elsewhere" on GitHub Actions.

## User Stories

- The user runs an agent on a fresh GitHub Actions runner instead of their own machine, and follows it from the same dashboard.

## Flows

- One dispatch is one agent turn. The daemon tags the run with a correlation id of its own making and finds the run by that tag.
- The run spends the user's own driver subscription, not an API key, and the agent runs unrestricted.
- The turn's work — including anything left uncommitted — is pushed to the branch the driver chose, so the next turn continues exactly where this one stopped.
- The transcript comes back as an uploaded artifact, the only channel out of a run; a failed turn still uploads it.

## Rationales

- The daemon invents its own correlation id because GitHub's dispatch call never reveals which run it started.
- The agent runs unrestricted because the runner is disposable: nothing on it outlives the turn.
- A failed turn still uploads its transcript because a failure is exactly when the transcript is most wanted.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
