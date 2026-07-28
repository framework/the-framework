Framework-free core of the `useAgentRun` hook: transcript reducer, client-tool batch executor, and the run/resume driver over the agent-SSE protocol.

## TLDR

- `appendAgentOutput(outputs, event, data)` — pure immutable reducer mapping SSE events (`text`, `tool_call`, `tool_update`, `tool_result`, `tool_approval_required`, `handoff`, `error`) to `AgentRunOutput` entries; consecutive `text` deltas coalesce into the trailing entry; `complete`/`pending_client_tools`/unknown events produce no entry (they drive status, not transcript).
- `executeClientTools(calls, resolver)` — resolves pending client-tool calls serially, keyed by `toolCallId`; a resolver throw becomes an `{ error }` result instead of aborting the batch, matching the server-side tool-error posture (the model sees the failure and can recover).
- `driveAgentRun(initial, opts)` — loop: `opts.request(req, signal)` → `readAgentStream` → if the turn is `awaiting === 'client_tools'` AND a resolver is configured, auto-execute and resume; approval pauses always park; returns the final `AgentStreamTurn`. Throws on non-ok responses.

## Decisions

- Kept out of React so the client-tool round-trip and approval resume are exhaustively unit-testable without a React harness (the framework intentionally ships none) — the hook is a thin wrapper.
- The app owns the endpoint and request-body shape: the driver hands a typed `AgentRunRequest` intent (`run` | `resume` with `{ turn, clientToolResults, approved, rejected }`) to a caller-supplied `request` function, because only the app's route can reconstruct server-side message history.
- Auto-resume never crosses approval gates — those require an explicit user approve/reject.

## Facts

- No `react` and no `node:` imports — safe in any `fetch`-capable runtime; builds on `../agent-sse.ts` (`readAgentStream` + `AgentStreamTurn`).
