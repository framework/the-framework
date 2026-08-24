# Bug analysis: packages/framework/dashboard/components/ProjectErrorBanner.tsx

## Business logic (high-level)

The warning banner at the top of a project's page (#1500): renders exactly the project errors the
daemon currently records; no state of its own and nothing to dismiss. SPEC invariants:

- **Only real, current problems**: `if (!errors || errors.length === 0) return null` — no banner
  for no errors; both `undefined` (project row without the field) and `[]` are covered. The banner
  disappears when the daemon clears the condition because the component is a pure projection of
  the prop.
- **Nothing to dismiss**: no close control, no local state. Holds.
- **Headline plus raw detail**: `projectErrorTitle(code)` headline + `error.message` verbatim
  underneath. Holds.
- **Since when**: `formatAge(error.since)` appended (" · since 3h ago"). `formatAge` handles an
  unparseable/absent timestamp with the "—" fallback, so a bad `since` never renders
  "Invalid Date" — it would read "since —", ugly but safe, and the daemon always stamps a real
  ISO time.

Each error renders with `role="alert"` so assistive tech announces it; the icon is `aria-hidden`
with the text carrying the meaning.

Edge cases considered: multiple errors stack in one bordered block (flex-col gap-2) — fine. React
keys are `error.code`; the daemon records at most one error per code (the code is the identity of
the condition), so keys are unique — a reliance on the daemon's model, noted, not a bug: the
`ProjectErrorCode` union has exactly one member today.

## Functions (low-level)

### `projectErrorTitle(code)`

Exhaustive switch over `ProjectErrorCode` (currently only `'data-sync'`), no default — TypeScript's
return-type check forces a new case when a new code is added, so the mapping cannot silently fall
behind the union. Returns the SPEC's exact headline "The data branch is not syncing". Verdict:
correct.

### `ProjectErrorBanner({ errors })`

Input: `ProjectError[] | undefined`. Null-render guard, then one alert row per error: warning
icon, danger-colored headline with muted "· since <age>" suffix, muted `break-words` message (long
git stderr wraps instead of overflowing). `min-w-0` on the text column lets it shrink inside the
flex row. Stateless; no effects, listeners, or timers to leak. Verdict: correct.

## Bugs found

None found.
