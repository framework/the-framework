The runner — autopilot's pluggable execution seam: one `Runner` interface for booting isolated workspaces (virtual fs + shell + optional preview), four adapters behind it, and a bridge that hands a workspace to an agent as tools.

## TLDR

- `types.ts` — the Flue-sandbox-shaped contract: `Runner`/`RunnerSession`/`RunnerFs`/`RunnerProcess` + option/result types + `RunnerError`.
- `path.ts` — shared `norm`/`safeSegments` workspace path rules and the escape guard (+ `path.test.ts`).
- `fake.ts` — in-memory test double with recorded calls and programmable exec, the runner analog of `AiFake` (+ `fake.test.ts`).
- `local.ts` — real host temp-dir adapter; the reference implementation; unsandboxed, for trusted execution only (+ `local.test.ts`).
- `docker.ts` — container adapter via the `docker` CLI with a published preview port (+ `docker.test.ts`, daemon-gated).
- `webcontainer.ts` — in-browser StackBlitz adapter, lazy optional peer dep (+ `webcontainer.test.ts`; real proof lives in `harness/webcontainer/`).
- `tools.ts` — `runnerTools`: expose a booted session to an ai-sdk agent as `read_file`/`write_file`/`remove_file`/`list_files`/`exec`/`start_server`/`preview` tools (+ `tools.test.ts`).
- `index.ts` — barrel.

## Decisions

- Capability signaling by presence: `session.preview`/`session.start` are simply absent when unsupported; callers and `runnerTools` branch on that instead of capability flags.
- The fake enforces the same path/escape rules as the real adapters (via the shared `path.ts`), so tests that only run against the fake stay honest.

## Facts

- All adapters agree on cross-file semantics: workspace-relative paths only, escape rejection, recursive *sorted* `list` with missing dir → `[]`, `timeoutMs` overrun → exit 124 with a stderr note, and idempotent `dispose` that first stops background processes.
- Sandboxing spectrum: fake (in-memory) → local (trusted host) → docker (container) → webcontainer (browser); a Flue adapter is the intended next implementation behind the same seam.
- WebContainer merges stdout+stderr into `stdout` (pseudoterminal) — the one adapter whose exec output shape differs.
