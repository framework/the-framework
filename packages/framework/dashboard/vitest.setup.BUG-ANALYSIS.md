# Bug analysis: packages/framework/dashboard/vitest.setup.ts

## Business logic (high-level)

One line of configuration: raise Testing Library's async-query ceiling to 5s (#886), because
Base UI portals/positions menus a frame or two after a click and a loaded CI machine blew the
default 1s. The comment's key claim — "the timeout is a ceiling, not a delay" — is accurate for
`waitFor`/`findBy*` (they resolve as soon as the predicate matches), so healthy runs pay
nothing.

Interaction check: `configure({ asyncUtilTimeout: 5000 })` applies process-wide per worker and
is set before any suite runs (setupFiles); `test-utils.ts`'s `hoverTooltip` passes its own
`timeout: 5000` explicitly, and `use-live-events.test.tsx` passes larger per-call timeouts where
retry backoff needs them — all consistent, none silently capped by this value (per-call options
override the configured default). The vitest `testTimeout` (20s) stays comfortably above, as the
config file's comment requires.

## Functions (low-level)

- Module body — a single `configure` call. Verdict: correct.

## Bugs found

None found.
