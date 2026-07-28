The workflow ActionsDriver dispatches (#610) to run one Claude Code agent turn (`prompt()`) on a disposable GitHub-hosted runner.

## TLDR

- `workflow_dispatch` inputs: `prompt`, `correlation_id` (both required), `model`, `resume_session_id`, `branch`.
- Runs `anthropics/claude-code-action@v1` with a `claude setup-token` OAuth token — the run spends the subscription, not an API key (#495) — and `--dangerously-skip-permissions` (agent mode grants nothing by default; the disposable runner is what makes that safe).
- Pushes the run's work — including anything the agent left uncommitted — to the driver-chosen `branch`, so the driver can read it back and run the next turn on top of it (#1085).
- Uploads artifact `framework-run-<correlation_id>` containing `execution.json` (the transcript) and `meta.json` (`{branch, session_id}`) — the only REST-readable channel out of a run; `always()` so a failed turn still returns its transcript, which is exactly when it's most wanted.

## Problems

- The dispatch API answers 204 with no body, so the driver can never learn a run id; the driver-generated `correlation_id` is echoed into `run-name` and the artifact name — that is how the driver finds its own run, and why both MUST keep interpolating it.
- The agent step runs its own git setup and leaves the checkout's persisted credentials unusable — a plain `git push origin` fails "Authentication failed", so the push goes through a tokenized URL (`x-access-token:${github.token}@github.com/...`).
- `upload-artifact@v4` defaults `include-hidden-files` to false and drops every file under a hidden path segment — hence `framework-run/`, not `.framework-run/`.
- The action creates no branch for a `workflow_dispatch` run (its `branch_name` output stays empty), so the workflow pushes the branch itself — mirroring the local flow where the framework, not the agent, pushes the session branch (#799).

## Decisions

- Agent args are composed from env vars inside the step, never by interpolating `${{ }}` into the shell, so a crafted input cannot become a command (the driver validates too); `if` rather than `[ .. ] && ..`, which returns non-zero on empty input and would fail under `set -e`.
- `id-token: write` is NOT optional: the action exchanges an OIDC token to authenticate the subscription OAuth token; without it every run fails "Could not fetch an OIDC token". Also `contents: write` + `pull-requests: write` (the agent may open a PR).
- No push for a no-op turn (HEAD equals `origin/<dispatch ref>`); if that base can't be resolved, err toward pushing.
- A crashed action yields `execution.json` = `[]` — an empty array still parses, so the driver sees an empty turn, not an error.
- `timeout-minutes: 60` (well under the 6h cap — a turn that long has gone wrong); `fetch-depth: 0` so the agent can read history; artifact retention 7 days.

## Flows

- one turn: driver dispatches with `correlation_id` → compose args (model/resume) → claude-code-action runs the prompt → push run branch (commit leftovers, skip if no new commits) → collect transcript + meta → upload `framework-run-<id>` artifact → driver locates the run by `run-name` and reads the artifact.
