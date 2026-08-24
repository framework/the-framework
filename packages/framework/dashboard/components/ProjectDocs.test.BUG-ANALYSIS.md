# Bug analysis: packages/framework/dashboard/components/ProjectDocs.test.tsx

## Business logic (high-level)

Pins the two ProjectDocs behaviors its test SPEC names: (1) a project with no docs renders nothing
at all; (2) with a doc, a "Docs" heading appears and the doc renders in the DocsPanel presentation
(name button + markdown content). `onDocs` is mocked at the rpc boundary via
`vi.hoisted` + `vi.mock` before a top-level `await import` of the component — the correct pattern
for mocking an ESM dependency of the module under test. `beforeEach` resets the mock and defaults
it to resolving `[]`; `afterEach(cleanup)` unmounts, which (via the hook's effect cleanup) clears
the 4s poll interval so tests do not leak timers into each other.

What the tests genuinely verify:

- Test 1 awaits `onDocs` being called with `'p1'` (so the poll wiring and the projectId argument
  are pinned), then asserts `container.textContent === ''`. Because the component returns `null`
  both before load and for empty docs, this asserts the whole no-docs path. Note the assertion runs
  after the mock resolved *inside* waitFor's retry loop; `waitFor` wraps in `act`, so the resolved
  state has flushed by the time textContent is read — and even if it hadn't, the pre-load render is
  also empty, so the assertion cannot pass for the wrong reason in a way that hides a regression
  (a regression that rendered an empty section would produce heading text and fail).
- Test 2 waits for the heading (async-safe), then asserts the doc name button and the rendered
  markdown text ("the plan" — the `#` heading marker is stripped by the Markdown renderer, so
  `getByText('the plan')` is the right query).

Not covered (noted, not bugs): the 4s re-poll ("kept current") and the bounded-height styling.
Both are hard to pin meaningfully in jsdom; the poll behavior is pinned in use-async's own tests.

## Functions (low-level)

### Module setup (`vi.hoisted`, `vi.mock`, `await import`)

Hoisted mock fn shared into the factory; dynamic import after registration so ProjectDocs binds
the mock. Correct — no real rpc module is touched.

### Test "a project with no docs gets no section at all"

Renders, `await waitFor(onDocs called with 'p1')`, asserts empty output. Fails if the section ever
renders for empty docs or if the poll stops passing the project id. Awaited properly. Correct.

### Test "docs render under a Docs heading in the DocsPanel presentation"

Overrides the mock to resolve one doc, waits for the heading role, asserts name and content text.
`getByRole('heading', { name: 'Docs' })` matches the `<h2>`; if DocsPanel stopped receiving docs
the text queries throw. Awaited properly. Correct.

## Bugs found

None found.
