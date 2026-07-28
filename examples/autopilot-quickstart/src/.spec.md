Source of the ai-autopilot quickstart: one offline "build a feature" flow plus its runnable entry and smoke test.

## TLDR

- `autopilot.ts` — the flow: workers → Supervisor → FakeRunner sandbox → surfaces, scripted via `AiFake`; exports `TASK` + `runQuickstart()`.
- `main.ts` — CLI entry printing each surface's output.
- `autopilot.test.ts` — node:test smoke asserting plan routing, sandbox files, build/preview, and event order.
