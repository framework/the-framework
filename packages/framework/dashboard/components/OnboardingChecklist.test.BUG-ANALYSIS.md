# Bug analysis: packages/framework/dashboard/components/OnboardingChecklist.test.tsx

## Business logic (high-level)

Pins what its test SPEC claims: exactly three Optional marks with the two essentials unmarked;
unticked steps are checkboxes (no `<circle>`; `aria-label="Not done"` present); the GitHub-import
step starts the `updateTickets` preset unattended on the target project and hands
`(projectId, intent, agentId)` up; a start with no id still hands the project up with
`undefined`; a refused start shows the reason and never navigates.

Verification that the tests test what they claim:

- The Optional-mark test asserts both the total count (3) and, per label, whether the label's
  `<p>` carries the Optional span — `getByText(label)` matches on the element's *direct* text
  nodes (testing-library's `getNodeText`), so "Populate tickets/" still matches its `<p>` even
  though the Optional span sits inside it; the `marked()` helper is therefore sound for both the
  positive and negative cases.
- The checkbox test asserts the absence of any SVG `<circle>` (lucide's Square/SquareCheckBig
  draw rects/paths) plus at least one "Not done" mark — a real guard for the #1139 regression.
- The import tests assert the exact start call (project, rendered preset — compared against the
  live `presets.updateTickets.render()`, not a copied string — kind 'prompt', `{unattended:
  true}`) and the exact hand-up including the `undefined`-id case. All awaited (`clickImport`
  waits for the start call; hand-up assertions in `waitFor`). Falsifiable in both directions
  (the refusal test asserts `onAgentStarted` was never called).
- Mock hygiene: hoisted RPC/lib mocks cover every module the component (and its embedded
  dialogs) imports; the `startAgent` object is shared-and-reset (`afterEach`) so busy/error can
  be steered without re-mocking; `cleanup` stops the polls.

Notes (not bugs):

- L65's comment says "Four integrations/inputs are optional" while the assertion (and the
  source, and both SPECs) say three — stale arithmetic in prose only.
- The refusal test pre-sets `startAgent.error` before render, so the error text is visible from
  mount; the assertion still proves the two facts it names (reason shown, no navigation), just
  not that the error *appeared because of* the click. Adequate for the mocked hook's contract.
- The preferences mock exports `discordBotEnabled`, which nothing under test imports — dead
  fixture key, harmless.

## Functions (low-level)

- `EMPTY` / `WITH_PROJECT` fixtures: minimal `DashboardData` shapes for the rows exercised
  (cast through `unknown` — fine for fixtures). Correct.
- `clickImport()`: find-click-await helper; `findByRole` is itself awaited. Correct.
- The five tests: as analysed above. Correct.

## Bugs found

None found.
