# Bug analysis: packages/framework/src/dashboard/dashboard.test.ts

## Business logic (high-level)

Four tests, matching the four bullets of `dashboard.test.SPEC.md`: the rollup totals + working-now list, most-recently-active-first project ordering (the onboarding contract), per-project ticket presence, and the pinned payload shape (the #1139 guard against fields whose surfaces were removed while their cost — a full agent-archive fan-out per poll — remained).

All reads are injected (`liveAgents`, `queue`, `tickets`), so the tests run off disk and deterministically. The `agent()` helper's cast (`as AgentMeta`) is the usual test shorthand; the fields it fakes (`status`, `id`, `startedAt`, `updatedAt`) are the ones `buildOverview` consumes, so the cast hides nothing load-bearing.

## Functions (low-level)

- `project(id, path, lastActivityAt?)` — builds a `ProjectSummary` with the optional timestamp genuinely absent (spread trick) rather than `undefined`-valued, which matters for the sort's `?? ''`. Correct.
- 'buildDashboard rolls up the totals and the working-now list its readers ask for' — two projects, queues with open 2+0 → `totals` deep-equals `{projects: 2, openTodos: 2}`; one running agent on `/a` → `active.length === 1`; `queue` passed through by reference-equality of content. The injected `liveAgents` keys off `cwd`, proving the per-project fan-out reaches the right paths. Correct.
- 'orders projects most-recently-active first, which onboarding takes the head of' — old/new deliberately passed in reverse order, asserts `['new', 'old']`. Pins that the *input* order is not trusted. Correct.
- 'reports per-project ticket presence, which onboarding reads (#958)' — `tickets` keyed off cwd; asserts true for `/a`, false for `/b`. Note both projects here lack `lastActivityAt`, so their order depends on the stable sort of equal keys — the test wisely uses `find` rather than indices. Correct.
- 'the payload carries only what a reader asks for' — `Object.keys(...).sort()` deep-equals on the payload, `totals`, and a project row. This is the shape pin: any added field fails loudly. It cannot pass vacuously (keys are asserted exactly). Correct.

Gaps (not defects): the default ticket reader's `.catch(() => false)` forgiveness and the default `collectQueue` path are untested here (both covered by their own modules' tests); `queueOpen` summation across multiple projects is exercised with pre-summed fakes only.

## Bugs found

None found.
