# Bug analysis: packages/framework/src/fake-script.ts

## Business logic (high-level)

The deterministic offline demo scenario: exports the canned intent, scripted `FakeTurn`s for a one-turn orders-app build, three `FRAMEWORK_FAKE_AWAIT` gate variants (single-select, multi-select, plan confirmation), and the `fakeDriver()` factory with fixed session id `fake-orders-app`. Checked against `fake-script.SPEC.md`:

- One canned task, default single build turn — matches (`TURNS = [BUILD_TURN]`, #1372).
- Spend accumulates — every turn (including all ask/resume variants) carries `FAKE_USAGE`; matches.
- Three gate variants selected via env var; each variant is "ask, then resume" — matches (`[askTurn, RESUME_TURN]`).
- Fixed session id — matches.

Lifecycle/concurrency: `fakeDriver()` reads `process.env.FRAMEWORK_FAKE_AWAIT` at call time, which is exactly what the e2e harness relies on (it sets/deletes the var around Starts, `e2e/harness.ts:120-124`). No state is retained between calls except that `demoTurns(undefined)`/unknown-mode returns the *same* `TURNS` array instance each time (not a copy) and the ask variants return fresh arrays that embed the same shared `FakeTurn` objects. That is only a hazard if `FakeDriver` mutated its `turns` input; nothing suggests it does (turns are consumed read-only), so noted as a reliance, not a bug.

The gate JSON blobs use `recommended: "Session cookies"` — a *label*, not an id. This works because `parseAwaitGate` (turn-gate.ts:330) assigns ids `opt:<i>` and resolves a recommended given as a label; the test pins `gate.recommended === 'opt:0'`, so the coupling is exercised. The `confirmation` variant additionally uses `"stop": true` on Decline and a `file` reference (`PLAN_fake-orders-app.agent.md`); the referenced plan file is fictional in the fake run — the dashboard's doc sidebar will simply have nothing to render, which is acceptable demo behavior (nothing crashes on a missing doc; the sidebar reads the workspace).

## Functions (low-level)

- **`FAKE_INTENT`** — constant string. Correct.
- **`FAKE_USAGE` / `BUILD_TURN` / `TURNS` / `AWAIT_*_TURN` / `RESUME_TURN`** — data constants. The embedded JSON in each ```await-choices``` block is valid JSON (verified by eye and by the tests exercising two of three; the `confirmation` blob parses identically in structure). Correct.
- **`demoTurns(awaitMode)`** — maps `'choices' | 'multiselect' | 'confirmation'` to `[askTurn, RESUME_TURN]`, anything else (including `undefined`, `''`, garbage) to `TURNS`. Edge cases: unknown mode falls back (tested); case-sensitive matching means `CHOICES` falls back to the plain run — acceptable for a dev-only env var. Verdict: correct.
- **`fakeDriver()`** — constructs `FakeDriver` with the env-selected turns and fixed session id. Env read at call time (needed by the e2e harness's set/delete pattern). Verdict: correct.

## Bugs found

None found. (Coverage note, not a bug: the `confirmation` variant has no test parsing its blob — a typo in that JSON would only surface at demo time. Its structure mirrors the tested variants.)
