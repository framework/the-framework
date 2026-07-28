Agent-agnostic core for running one wrapped coding-agent CLI invocation: spawn it in its own process group, stream stdout lines through a pluggable parser, and gate the turn on the exit code.

## TLDR

- `runAgentCli(opts)` spawns `bin args` detached, feeds the prompt over stdin, pipes each stdout line into an `AgentCliParser` (Claude Code's `StreamJsonParser`, Codex's `CodexJsonParser`), and resolves with `parser.result()` on clean exit.
- Everything process-shaped lives here (kill tree, abort wiring, grace window, non-zero-exit handling) so a second driver reuses it instead of copying claude-code.ts.
- Emits `start` / parser events / `result` or `error` driver events via `opts.emit`.

## Problems

- Interrupting only the top process orphans the agent's subtree (node workers, ripgrep, MCP servers): child is spawned `detached` as its own process-group leader, registered in `child-registry`, and killed via `killTree` — SIGTERM then SIGKILL after a 5s grace window.
- A CLI that exits before reading stdin (bad flag, instant crash) surfaces an async EPIPE that would crash the daemon as an uncaught exception (#943): a no-op `stdin.on('error')` listener swallows it; the close handler already reports the failed turn.
- A late `close` after an abort already settled the promise must not emit a second telemetry event — guarded by the `settled` flag.

## Decisions

- Prompt goes over stdin, never argv, so long prompts never hit arg-length limits.
- A non-zero exit fails the turn even when text was streamed first: the loop gates on outcome, so a crash mid-build must not pass as a result; stderr (else partial text) becomes the error detail.

## Flows

- turn: check aborted signals → emit `start` → spawn detached → registerChild → readline stdout → parser.push(line) → emit events → on close: code 0 ? emit `result` + resolve turn : emit `error` + reject; on abort: killTree(SIGTERM→SIGKILL) + reject.
