# Bug analysis: packages/framework/dashboard/components/TicketFilterBar.test.tsx

## Business logic (high-level)

Tests for the toolbar, unmocked — they exercise the real `lib/ticket-filter.ts` helpers through the
component, which is right for a component whose behavior *is* those helpers' composition. Coverage
vs. the SPEC:

- **Priority facet** — bucket labels with spans, count beside the option (asserted via the label's
  `parentElement` textContent containing '1' — slightly loose (the label itself contains no digits
  for these fixtures; '1' can only be the count or the bucket span text `(8–10)`... note: the label
  text "Critical (8–10)" *does* contain '1', so `toContain('1')` would pass even with a wrong count
  — see Bugs), toggling emits `buckets: ['critical']`, slider readout "Range: any", and the
  "No priority" row present when a ticket lacks priority / absent when none does.
- **Conditional facets** — effort/uncertainty only with recorded numbers; project only with ≥2
  projects. Matches spec.
- **Topics** — case-dedup (UX + ux → 'ux') and toggle payload.
- **Stage** — claimed counts the lock and composes with planned (the fixture is both planned and
  locked and counts once under Claimed).
- **Clear** — resets filters, keeps a non-default sort.
- **Sort** — picking a new key lands on its natural direction; re-click of the active key emits
  nothing (`onChange` not called); asc/desc pair present, labeled by meaning, `aria-pressed` on the
  applied one; direction click emits `{ key: 'date', dir: 'asc' }`.
- **Slider mirror/dim** — contiguous `['critical','medium']` → no `[data-dimmed]`, readout 5–10;
  gap `['critical','low']` → dimmed + "not one span". These pin `bucketUnionRange` through the UI.
- **Keycap chip** — visible initially, gone on focus.
- **`/` shortcut** — keydown on window focuses the field. The "unless something is already being
  typed into" half of the test name is not exercised (no test types `/` while an input is focused),
  so that clause rests on the source's target check alone — a coverage gap, not a wrong assertion.

Hygiene: `cleanup` per test (and mid-test where two renders are compared); `onChange` is created per
`renderBar`, so `mock.calls[0]` is always this render's first change. No fake timers needed (no
async beyond popover mounting, handled by `findBy*`).

## Functions (low-level)

- **`row(file, over, projectId)`** — minimal WorkspaceTicket with overrides; title = file keeps
  label queries unambiguous. Correct.
- **`renderBar(rows, view, projects)`** — fresh spy per call; default single project matches the
  facet-hiding default. Correct.
- Queries: `getByRole('button', { name: /priority/i })` — unambiguous while the popover is closed;
  after opening, the option checkboxes are found by `aria-label`, not role button, so no collision.
  `findByRole('menuitem', { name: 'Priority' })` distinguishes the sort row from the facet button.
  Correct.

## Bugs found

1. `L27`: the priority-count assertion cannot fail —
   `expect(screen.getByText('Critical (8–10)').parentElement?.textContent).toContain('1')` matches
   the '1' inside the bucket's own span text "(8–10)" (and even the '0' in '10' would satisfy a
   `'0'` check), so the test passes even if the count were 0, missing, or wrong. The test's stated
   purpose ("counts ride each option") is therefore not pinned. Severity: minor (test-only; the
   count logic itself lives in `rangeFacetCounts`, which has its own lib tests). Fix sketch: assert
   on the count element specifically, e.g. the label's last child span
   (`within(label).getByText('1')` after scoping to the count span), or give the count an
   accessible name and assert `screen.getByLabelText('Critical (8–10)')`'s row shows the exact
   count text outside the parenthesized span.
