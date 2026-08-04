The tool phase of the agent loop: serial and parallel execution behind one shared gate chain.

## Decisions

- **All gating lives in one decision function** returning a typed decision, so serial and parallel modes provably share semantics and a new gate is written once. Gate order matters: unknown tool → handoff-skipped → handoff (checked *before* the no-execute branch, because a handoff tool also has no execute but must not be treated as a client tool) → client tool → approval → before-tool-call middleware → argument validation. Validation runs *after* arg-transforming middleware, so a transform can repair malformed model output before judgment.
- Parallel mode is three phases — serial prelude (all decisions and loop-state mutations), concurrent execution with buffered progress chunks, then serial replay in tool-call order — so **streamed chunk order is deterministic** regardless of which execution finished first.
- A handoff halts the phase by flagging the loop so *sibling* calls resolve to handoff-skipped with synthetic results, keeping the message log replay-valid.

## Facts

- A paused execution skips its result emission and message push — the yielding call stays orphaned in history until resume reconstructs it.
- Tool results and streamed result chunks always carry the **original** value; only the message-log entry is narrowed by the tool's model-output projection.
- Documented caveat: concurrent executions share one middleware context; middleware that writes through it during chunk handling should force serial mode.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
