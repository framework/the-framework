React hook driving a streamed agent run over the named-event agent-SSE protocol — wraps `driveAgentRun` with state and imperative `run`/`respond`/`approve`/`reject`/`reset`.

## TLDR

- State: `status` (`idle`/`running`/`complete`/`error`), `outputs` transcript (each stream callback feeds `appendAgentOutput`), `pendingClientTools`, `pendingApproval`, `error`.
- A parked run (approval gate, or client tools with no resolver) keeps `status === 'running'` with the pending state populated; the UI renders the prompt and calls `respond`/`approve`/`reject`, which resume via the stored turn.
- `run(input)` clears the transcript and starts fresh; resume actions reuse `turnRef` and the shared `drive` loop; `reset()` aborts any in-flight stream and returns to `idle`.
- `onComplete`/`onError` callbacks, and `onAppEvent` for SSE events outside the protocol vocabulary (e.g. a server's `run_started` correlation id).

## Decisions

- `optionsRef`/`turnRef`/`abortRef` keep the async driver and imperative callbacks from going stale between renders; each `drive` call aborts the previous `AbortController` before creating its own.
- After an abort, results are discarded (`controller.signal.aborted` checked before any state update) — a superseded run can't clobber the new one's state.
- An `error` SSE event seen mid-stream (`sawError`) wins over turn-completion state: status becomes `error` even though the stream ended normally.
