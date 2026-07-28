The driver seam: the one abstraction The Framework wraps a coding-agent CLI behind (prompt it, let its own loop run, read the code, gate on the outcome), plus its five implementations.

## TLDR

- `types.ts` — the contract: `Driver` / `DriverSession` / options, `DriverTurn`, `DriverEvent`, usage/rate-limit/quota telemetry types.
- `claude-code.ts` — the first real driver (`claude -p --output-format stream-json`), with resume (#714/#720/#778), per-session MCP config (#452), and the `StreamJsonParser`.
- `codex.ts` — the second real driver (#539): `codex exec --json` on the user's ChatGPT subscription; `CodexJsonParser` + usage mapping.
- `actions.ts` — runs turns as GitHub Actions workflow dispatches (#610), replaying the uploaded transcript; `actions-zip.ts` is its minimal artifact-zip reader.
- `cloud.ts` — one-shot hand-off to Claude Code on the web via `claude --cloud` under a pty (`handsOff: true`, #1225).
- `fake.ts` — deterministic in-memory driver for `--fake` and tests.
- `agent-cli.ts` — shared process core (detached spawn, stdin prompt, line-parser, kill/abort/exit handling); `child-registry.ts` — process-group kill registry against orphaned agent subtrees; `session-support.ts` — shared emit/signal/framing/readCode helpers; `claude-code-quota.ts` — `/usage` quota read + parse (#521).
- `index.ts` — barrel.

## Decisions

- Black box guardrail (#165): the seam is the code and the outcome, never the agent's tool calls; events are forwarded for dashboard visibility only. Single execution path (#166 option A): personas are prompt-framing, each loop pass a fresh `prompt`.
- Every driver keeps the user's own subscription auth (#495) — no API keys of ours anywhere.
- Local CLIs get the prompt over stdin; remote targets (Actions, cloud) get framing prepended to the prompt and pass values through inputs/env vars vetted to safe charsets, so user text never reaches a shell as syntax.
- Optional capabilities (`readQuota`, `readCode`, `handsOff`, resume) are omitted rather than stubbed by drivers that can't provide them.

## Facts

- All real drivers reuse `runAgentCli`/`session-support` rather than copying process plumbing; parsers are separate classes so the dialects are unit-testable without processes.
- Session ids mix a per-process counter with a random tag where cross-process uniqueness is load-bearing (actions, cloud), since the daemon spawns a fresh process per run.
