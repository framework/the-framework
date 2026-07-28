In-memory `FakeRunner`/`FakeRunnerSession` — the runner analog of ai-sdk's `AiFake`, so autopilot can be driven and tested without any sandbox infra.

## TLDR

- Map-backed `FakeFs` keyed by `safeSegments(path).join('/')` — the same normalization/escape rules the real runners enforce, applied to every path.
- `exec` is programmable via `FakeRunnerOptions.onExec` (default: exit 0, empty output); every `exec`/`start` call is recorded (`execCalls`/`startCalls`) and started processes collected in `processes`, for test assertions.
- Capability toggles `preview`/`background` (both default `true`); when off, the corresponding session member is absent, matching real capability signaling. `previewUrl` (default `https://preview.fake.local`) joined with the port.
- Fake `start()` returns a `RunnerProcess` whose `exit` stays pending until `stop()`/`dispose()` resolves it with exit 0.
- `snapshot()` exposes the file map; `FakeRunner.sessions` records every boot; ids are `fake-session-N`.

## Decisions

- Every path routes through the shared `safeSegments` guard so code exercised only against the fake stays honest about the path check most worth exercising (workspace escape).
- `preview`/`start` are own properties assigned in the constructor, not prototype methods — a prototype method could not be conditionally omitted, and presence *is* the capability signal.

## Facts

- `list('.')`, `list('/')`, `list('./')`, `list('')` all key to the empty string (workspace root) and list everything, as the real runners do — regression for #998, where `'/'` matched no keys.
- The empty-string key is the workspace root, which no file names.
