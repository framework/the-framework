The workflow the product's `ActionsDriver` dispatches to run a coding-agent turn on a GitHub-hosted runner. **One workflow run = one prompt turn.**

## TLDR

- `workflow_dispatch` only; inputs: `prompt`, `correlation_id`, plus optional `model`, `resume_session_id`, `branch`.
- Runs the official Claude Code action authenticated by a subscription OAuth token (`claude setup-token`) — runs spend the subscription, not an API key. `id-token: write` is mandatory: the action exchanges an OIDC token to authenticate that OAuth token.
- Two output channels, both `if: always()`:
  1. **Branch continuity** — the runner and its checkout vanish, so the workflow commits any leftovers and pushes to the run branch; that branch is how the driver reads the work and where the next turn's checkout starts.
  2. **Transcript artifact** — `execution.json` (or a literal `[]` when the action crashed, so the driver sees an empty turn instead of an error) plus `meta.json` (`{branch, session_id}`), uploaded under a name embedding the correlation id. The artifact is the only REST-readable channel out of a run.

## Problems

- The dispatch REST API answers 204 with no body, so the driver never learns a run id. The **correlation id is the whole addressing scheme**: the workflow echoes it into `run-name` and the artifact name, and the driver polls recent dispatch runs matching on it.
- The Claude action runs its own git setup and leaves the checkout's persisted credentials unusable — the push must go through a tokenized URL or it fails with "Authentication failed".
- The artifact staging dir must not start with a dot: `upload-artifact` silently drops hidden paths, and the driver would find no artifact.

## Decisions

- Inputs reach the shell only via `env:` vars, never `${{ }}` interpolation inside script text — a crafted prompt cannot become a command.
- `--dangerously-skip-permissions` is always passed: agent mode grants nothing by default, and the disposable runner is the sandbox.
- No branch push when the turn produced nothing (HEAD unchanged) — a no-op turn must not litter branches.
- `meta.json.branch` records the branch the workflow itself pushed, not the action's `branch_name` output, which stays empty for `workflow_dispatch` runs.
- `fetch-depth: 0` so the agent can read history; `timeout-minutes: 60` — a longer turn has gone wrong.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
