# Bug analysis: packages/framework/dashboard/components/TicketPlanPage.test.tsx

## Business logic (high-level)

Four tests over the plan page with only the rpc read mocked:

- **`planPath` mapping** — direct unit assertion of the slug → path spelling; pins the exported
  helper's contract (the reason it is exported).
- **Read + render** — asserts the RPC is called with exactly the mapped path, and that the
  markdown's heading and body render ('The plan' as text — the Markdown renderer emits headings as
  `<p>` text, so `findByText` works).
- **No plan** — null answer → "no plan yet" text.
- **Truncated** — `truncated: true` → the admission line renders.

Each behavior asserted is a real observable; each test fails when its behavior breaks. Hygiene:
`cleanup` + `onFileContent.mockReset()` per test; `usePolled` uses real timers but tests end well
before the 10s tick and unmount clears the interval.

Gaps (noted, not bugs): the `binary: true` branch (renders "no plan yet") is untested; the 10s
re-poll (growth of a plan being written) is untested — both are simple wiring over `usePolled`,
which has its own tests.

## Functions (low-level)

- Hoisted `onFileContent` mock + module mock — matches the component's single import from
  `../rpc/reads.js`. Correct.
- Top-level `await import` after the mock — the vitest pattern this suite uses throughout. Correct.
- The waitFor-on-args assertion in the read test precedes the text assertions, so a wrong path
  fails loudly with the actual call rather than a timeout on missing text. Correct.

## Bugs found

None found.
