The workflow the framework dispatches to run one coding-agent turn on a disposable GitHub-hosted runner — the runner-side half of running an agent on GitHub Actions instead of the user's machine.

## User Stories

- The user runs an agent on a fresh GitHub Actions runner instead of their own machine, and follows it from the same dashboard.

## Flows

- One dispatch is one agent turn. The framework tags the run with a correlation id of its own making and finds the run by that tag.
- The run spends the user's own Claude subscription — an OAuth token the user minted and the repository holds — never an API key.
- The agent runs unrestricted: it edits files and runs commands without waiting on permission prompts that nobody is there to answer.
- The turn's work — including anything the agent left uncommitted — is pushed to the branch the framework chose, so nothing is lost with the runner and the next turn continues exactly where this one stopped. A failed turn's work is pushed too. A turn that changed nothing pushes nothing, so a no-op run creates no branch.
- The run's report comes back as one uploaded artifact: the transcript, which branch was pushed, and the agent's session id so a later turn can resume the same conversation. Besides the pushed branch, that artifact is the only thing that leaves the runner; a failed turn still uploads it.

## Rationales

- The framework invents its own correlation id because GitHub's dispatch call never reveals which run it started.
- The agent runs unrestricted because the runner is disposable: nothing on it outlives the turn.
- The workflow pushes the branch itself because the action that runs the agent creates none for a dispatched run — and publishing is the framework's job, as it is locally: the agent only commits.
- A failed turn still uploads its transcript because a failure is exactly when the transcript is most wanted.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
