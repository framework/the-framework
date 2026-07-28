`launchAutopilot` — the background surface: start an event-emitting run detached and return an `AutopilotHandle` (`status` / `events(offset)` / `stream()` / `result()`), nothing blocking.

## TLDR

- `start` receives the internal `EventStream`'s sink and returns the run promise — typically `onEvent => new Supervisor({ ...opts, onEvent }).run(task)`; the surface deliberately knows nothing about how the run is built, it only owns the event stream and lifecycle.
- Status transitions `running` → `done` | `error`; the stream is closed in `finally`, so `stream()` iterators replay history, deliver live events, then end.
- The same handle backs the in-page surface (iterate `stream()` and push over SSE) and a background process (persist the handle, poll `status()` + `events(offset)`).
- Generic `<E, R>` defaulting to `SupervisorEvent`/`SupervisorRun`, so bootstrap launches with `AutopilotHandle<BootstrapEvent, BootstrapResult>`.
- ids: `opts.id` override or `autopilot-N` from a module counter.

## Decisions

- `result.catch(() => {})` pre-attaches a no-op handler so an unconsumed failure never surfaces as an unhandled rejection — callers still observe it through `result()`.
