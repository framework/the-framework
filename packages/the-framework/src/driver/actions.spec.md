The GitHub Actions driver: dispatch the agent workflow, poll for the run, download the transcript artifact, and replay it — one workflow run per prompt turn.

## Problems

- Dispatching a workflow returns 204 with no run id. The driver mints a **correlation id** (per-process counter + a random tag — without the tag, a restarted daemon would collide with a stale run's ids), the workflow echoes it into its run name and artifact name, and the driver polls recent dispatch runs matching on it.
- Every turn is a fresh runner and fresh checkout, so **continuity between turns is a branch, not a session**: the driver names the run branch up front and passes it as an input; the artifact's metadata reports the branch actually pushed, which becomes the ref for the next dispatch and the source for reading the code (over the contents API — the runner is gone).

## Decisions

- The agent's own session id is carried as a workflow input so resume chains across turns; model and resume id are token-validated because they reach a shell on the runner.
- Auth posture: a **user** token (repo + workflow scopes), never a GitHub App — the action rejects bot-triggered agent runs.

## Facts

- The transcript replays through the same stream parser the local driver uses: the action's execution file is a JSON array of exactly the messages the CLI emits line by line — the entire local-vs-runner difference is array-vs-JSONL. Cost: events arrive in one burst at the end of the turn.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
