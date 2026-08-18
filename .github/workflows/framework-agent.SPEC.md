The workflow the product dispatches to run one coding-agent turn on a disposable GitHub-hosted runner — how an agent runs "elsewhere" on GitHub Actions.

## TLDR

- One dispatch is one agent turn. The daemon's driver generates a correlation id and finds its own run by it — GitHub's dispatch call never reveals which run it started.
- The run spends the user's own driver subscription, not an API key, and the agent runs unrestricted because the runner is disposable.
- The turn's work — including anything left uncommitted — is pushed to the branch the driver chose, so the next turn continues exactly where this one stopped.
- The transcript comes back as an uploaded artifact, the only channel out of a run; a failed turn still uploads it, which is exactly when it's most wanted.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
