Offline, deterministic end-to-end quickstart composing the four `@gemstack/ai-autopilot` layers — workers → Supervisor → runner (sandbox) → surfaces — to "build" a paginated Orders page.

## TLDR

- Exports `TASK` and `runQuickstart(write?)`; defines a 3-worker roster (`data-modeler`, `page-builder`, `ui-designer`) and `WORK`: each subtask, its owning worker, and the file it writes.
- `scriptModel()` scripts `AiFake`: step 0 is the planner's JSON plan, then per worker a (`write_file` tool-call, final-text) pair.
- `runQuickstart()` boots a `FakeRunner` sandbox seeded with `package.json`, builds one `agent()` per role with `runnerTools(session)` as tools, plans via `agentPlanner(agent(...roster...))`, and runs `Supervisor` with `concurrency: 1`.
- One event stream feeds two surfaces at once: `terminalSink({ write })` for live lines and a `launchAutopilot` background handle exposing `events()` + `result()`.
- After the run: `session.exec('pnpm build')` (FakeRunner's `onExec` answers "orders page built") and `session.preview({ port: 5173 })` produce the build result and preview URL returned in `QuickstartResult`.

## Decisions

- `concurrency: 1` makes the fake provider-call order deterministic: planner first, then each worker's pair in plan order.
- Fully offline by design (no API key): swapping `FakeRunner` for a real runner and dropping the fake is stated as the only change needed to run for real.
- The roster is the app's own — autopilot orchestrates the agents handed to it and injects no instructions of its own.
- `fake.restore()` runs in `finally` so the global provider fake never leaks past the run.

## Flows

- `runQuickstart: AiFake.fake() + scriptModel() → FakeRunner.boot({package.json}) → agentPlanner + workersWithSandbox() → launchAutopilot(Supervisor.run(TASK)) with events tee'd to terminalSink → handle.result() → session.exec('pnpm build') → session.preview(5173) → QuickstartResult{run, events, files, build, previewUrl}`
