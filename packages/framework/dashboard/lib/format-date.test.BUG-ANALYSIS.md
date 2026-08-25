# Bug analysis: packages/framework/dashboard/lib/format-date.test.ts

## Business logic (high-level)

Pins the module's guarantees: real timestamps format via the same locale calls (asserted against
freshly computed expectations, so the tests are locale-independent), absent/unparseable inputs
read as the fallback (including caller-worded), formatAge floors at every unit (with fake timers
pinning NOW; the 90s→"1m ago" case is the flooring proof, 400d→"1y ago" covers the year gate),
formatUntil counts down and clamps past-due to "any moment" (0 and negative both pinned),
formatDuration floors with no weeks (9d stays "9d") and clamps negatives, formatDurationLong
pluralizes exactly at one, and the reset formatters name weekday+time / full date+zone.

Are the assertions honest?

- The locale-sensitive expectations are computed with the same Intl calls as the source
  (`toLocaleString`, weekday/month lookups, and a `time()` helper that mirrors the source's
  lowercase/strip-whitespace pipeline). This verifies *composition* (which parts appear, in what
  order, with what wording around them) rather than tautologically re-running the function —
  e.g. `formatResetTooltip` is pinned to the exact sentence "Quota resets on <monthDay>, <time>
  (<zone>)". Reasonable; a wording drift fails, a pure locale difference does not.
- Fake timers are scoped with try/finally so a failing assertion cannot leak frozen time into
  later tests. Sound.
- The formatAge suite feeds ISO strings derived from a fixed NOW — no wall-clock flake. The
  formatUntil suite uses live `Date.now()` deltas of whole minutes, far from the rounding
  boundary, so no flake there either.

Gaps (noted, not defects): `formatDateTimeShort` and `formatRelative` are untested — the latter
is exactly where the source's rounding-vs-flooring tension lives (reported against the source);
a 91s → "1m/2m ago" test would have surfaced it. `formatAge` boundary 7d/365d values are covered
via 14d and 400d but not the exact edges.

## Functions (low-level)

- Unit helpers (`S/M/H/D`, `ago`, `time`) — straightforward; `ago` builds ISO strings so the
  parse path is the production one. Correct.

## Bugs found

None found.
