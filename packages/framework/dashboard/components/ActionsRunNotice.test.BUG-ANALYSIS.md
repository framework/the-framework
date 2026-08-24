# Bug analysis: packages/framework/dashboard/components/ActionsRunNotice.test.tsx

## Business logic (high-level)

Pins the four behaviors its SPEC names: (1) a live `actions` agent shows the
"updates arrive when the run finishes" line; (2) the link appears once a driver `action` event
labelled `run <url>` is in the stream, and (3) is absent before then; (4) a finished agent drops
the updates line but keeps the link; plus the null renders for `target="local"` and for an unset
target.

Do the tests verify what they claim? Yes:
- The `runAction` helper builds the exact event shape `actionsRunUrl` parses
  (`kind: 'driver'`, `event.type: 'action'`, label `run <url>`), so the link tests exercise the
  real extraction rather than a mock.
- Assertions are on rendered output (`getByRole('status')` text, `getByRole('link')` href,
  `container.firstChild === null`), each of which fails if the component regresses: dropping the
  gate breaks both null tests, losing the live clause breaks test 1, rendering the link
  unconditionally breaks test 3, keeping the clause when finished breaks test 4 (a negative
  match, but paired with the positive match in test 1 on the same string, so the pair cannot both
  pass vacuously).
- All renders are synchronous; nothing async is left un-awaited. `afterEach(cleanup)` prevents
  cross-test DOM bleed (needed since `getByRole('status')` would otherwise match a previous
  render).

Coverage gap worth noting, not filing: no test that a `remote`/`web` target renders nothing (the
component's union names them), and no test that the *last* `run <url>` event wins — both
behaviors live in `actionsRunUrl`/the gate and are low-risk.

## Functions (low-level)

- **`runAction(url)`** — event factory; matches the production regex's expected label format.
  Correct.
- **test "explains the burst wait"** — live + no events → status text matches. Correct.
- **test "links through"** — href equality against the exact URL, name-scoped role query.
  Correct.
- **test "no link before"** — `queryByRole('link')` null. Correct.
- **test "finished drops the line, keeps the link"** — negative text match plus positive link
  presence. Correct.
- **tests "renders nothing" (local / unset)** — `container.firstChild` null; the unset variant
  also pins that the prop is optional. Correct.

## Bugs found

None found.
