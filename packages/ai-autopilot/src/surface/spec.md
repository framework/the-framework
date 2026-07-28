Surfaces — run the same autopilot in the terminal, an in-page UI, or as a background process by adapting the engines' `onEvent` stream; they differ only in rendering and whether the run blocks.

## TLDR

- `events.ts` — `EventStream` (replayable multi-consumer transport, Flue-style tail replay, SSE-safe iterator cancellation) + `formatEvent`/`terminalSink` for the terminal surface (+ `events.test.ts`).
- `launch.ts` — `launchAutopilot`: detached background run returning an `AutopilotHandle` (`status`/`events`/`stream`/`result`) (+ `launch.test.ts`).
- `index.ts` — barrel.

## Facts

- Surfaces are pure consumers of `onEvent`; they never know how a Supervisor (or Bootstrap) is built.
- Both `EventStream` and `AutopilotHandle` are generic over event/result types (defaults: `SupervisorEvent`/`SupervisorRun`) so bootstrap reuses them with its own `BootstrapEvent`/`BootstrapResult`.
