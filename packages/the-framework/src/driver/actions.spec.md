`Driver` that runs the agent on GitHub Actions (#610): dispatch the `framework-agent.yml` workflow with the prompt, poll the run, then replay the transcript artifact it uploads.

## TLDR

- `ActionsDriver.start` boots an `ActionsSession`; each `prompt` is one `workflow_dispatch` of `anthropics/claude-code-action@v1`, so turns take minutes and events replay in a burst at the end (no live stream).
- Continuity across turns: the session names a stable push branch (`<branchPrefix>framework-<sessionId>`, #1085) and dispatches later turns onto the branch the previous run pushed; the agent's own session id is carried for `--resume`.
- `readCode` reads from the pushed branch over the contents API — the runner is gone by the time we read.
- `replayTranscript` unwraps the action's `execution_file` (a JSON *array* of exactly the SDKMessage objects the CLI emits per line) and feeds it through the existing `StreamJsonParser` — array-vs-JSONL is the whole difference from running locally.

## Problems

- The dispatch API returns 204 with no run id, so there is nothing to poll by: a unique correlation id (`actions-<n>-<randomTag>-turn-<m>`) is passed as a workflow input, echoed into the run-name and artifact name, and matched against recent runs. The random tag is load-bearing: a fresh driver process restarts the session counter at 1, so without it every run's first turn would be `actions-1-turn-1` and a new process could latch onto a stale same-named run.
- The action leaves `branch_name` empty for `workflow_dispatch` runs, so the branch cannot be discovered after the fact — the driver names it up front and passes it in (#1085).
- Model / resume-session-id inputs reach a shell on the runner as env vars: `assertToken` rejects anything outside `[A-Za-z0-9._:-]`.

## Decisions

- Chosen over the routines fire API (prompt arrives wrapped as untrusted data, no read-back) — the official action passes the prompt verbatim and publishes its full transcript. Auth is the same subscription posture as everywhere (#495): a `claude setup-token` OAuth token held by the repo, never an API key.
- The token must belong to a user, not an App: the action's `checkHumanActor` rejects bot-triggered runs unless allow-listed.
- System framing is prepended to the prompt (as with Codex), not `--append-system-prompt`: that flag would have to survive shell-quoting inside the workflow — an injection seam not worth a system prompt.
- No `readQuota`: quota belongs to whichever account's token the repo holds, and `/usage` cannot run on a torn-down runner.
- A malformed `meta.json` costs only `readCode` (no branch), never the turn.

## Facts

- Defaults: workflow `framework-agent.yml`, poll 5s, timeout 1h (job cap is 6h), API base `api.github.com`; fetch/clock/sleep/runTag injectable for tests.
- The artifact must contain `execution.json`; `meta.json` optionally carries the pushed `branch`.

## Flows

- prompt: combineFraming+prepend → dispatch(workflow, {prompt, correlation_id, branch, model?, resume_session_id?}, ref = last pushed branch ?? config.ref ?? main) → awaitRun (poll runs list, match correlation id in run-name, emit `action: run <url>`, fail on conclusion != success) → readRunArtifact (list artifacts → download zip → readZip → execution.json + meta.json branch) → replayTranscript through StreamJsonParser emitting burst events → emit `result` → track sessionId/branch.
