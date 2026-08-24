# Bug analysis: packages/framework/dashboard/components/TicketDetailPage.test.tsx

## Business logic (high-level)

Tests for the ticket detail page, mocked at the two rpc modules. Coverage against the SPEC:

- **Read by identity + full body** — asserts `onTicket('p1', slug)` and that content below the fold
  renders; disambiguates the page `<h1>` from the markdown's own `#` heading via `getByRole('heading')`
  (the Markdown renderer emits headings as `<p>`, so the role query uniquely hits the page's h1 —
  correct and deliberate per the comment).
- **Meta row** — order test walks `description.nextElementSibling` and compares `indexOf` positions
  of 'ago' < 'Priority' < '#42'; all three first checked present. Sound (indexOf on the meta row's
  own textContent; 'ago' cannot appear later via other badges here). Link href asserted. The date
  test freezes nothing but computes "2 days ago" from `Date.now()` — `formatAge` floors, so it reads
  `2d ago` for the whole test's duration; not flaky.
- **Effort/uncertainty** — pins that `0` renders (`Uncertainty: 0`), which is exactly the
  `!== undefined` guard's job. Good regression net.
- **Queue** — args (title + file + priority) pinned; queued state pinned as disabled button with
  changed label; failure path pins the RPC's own error text surfacing and that no "Queued" button
  appears. All can fail if the logic breaks.
- **Missing ticket** — null answer → "does not exist" text.
- **Claim (#1420)** — claimed badge + inline holder + Release button; unclaimed shows neither;
  successful release calls the RPC with `(projectId, file)` and withdraws badge and button without a
  second poll (asserted via `waitFor` on absence — meaningful because the mock keeps answering
  `locked: true`, so only the `released` flag can explain the withdrawal: the test genuinely pins
  the optimistic bridge); failed release keeps the badge and surfaces the message.
- **Back** — click fires `onBack`.

Not covered: the 10s re-poll itself (would need fake timers), and the sticky-flag edge cases found
in the source analysis (released-then-reclaimed, slug switch on a live instance). Their absence
does not invalidate what is asserted.

Hygiene: `cleanup` + per-mock `mockReset` in `afterEach` — call-count assertions are all
`toHaveBeenCalledWith` within a single test, so no cross-test bleed. `usePolled`'s interval uses
real timers; each test finishes well under 10s and cleanup clears the interval, so no stray act
warnings from later ticks.

## Functions (low-level)

- **`ticket(over)`** — builder with sensible defaults (`planned: false`, no lock) and override
  spread. The `file` matches the rendered slug so the release-args assertion is meaningful. Correct.
- **Order test arithmetic** — `order.every(i => i !== undefined && i !== -1)` guards before the
  `toBeLessThan` comparisons (which use non-null asserts) — cannot pass vacuously. Correct.
- **`await screen.findByRole('button', { name: /queue/i })`** — matches the Queue button; after
  clicking, `/queued/i` distinguishes the flipped label. Note `/queue/i` also matches "Queued", but
  the click happens before the flip, so no ambiguity. Correct.
- **Release tests** — `findByRole('button', { name: /release lock/i })` unambiguous. Correct.
- **Back test** — `/tickets/i` matches only the back button (the h1 is not a button). Correct.

## Bugs found

None found.
