# Bug analysis: packages/framework/dashboard/lib/format-date.ts

## Business logic (high-level)

Every date/duration/countdown wording in one module (format-date.SPEC.md). Audit per guarantee:

- **Bad timestamps never reach the user** (#759): all string-input formatters go through
  `parse()` (empty/undefined/NaN → fallback "—" or caller wording). Test-pinned. Correct.
- **Three absolute forms**: full `toLocaleString`, short month/day/hour/minute (the
  timestamp-as-name form), date-only. Correct.
- **formatAge floored at every unit**: floor for s/m/h/d/w/y; the `days < 365` gate (rather than
  a weeks-based gate) avoids the "0y ago" hole at day 364 the comment documents — verified:
  364d → 52w, 365d → 1y. `Math.max(0, …)` clamps a slightly-future timestamp (clock skew) to
  "0s ago" rather than negative. Correct.
- **formatUntil**: rounds; ≤0 → "any moment" (past-due reads imminent, per the daemon-clock
  rationale). 90min → "in 2 hr" by rounding — countdown precision the SPEC does not constrain.
  Correct.
- **formatRelative**: "just now" under a minute, then m/h/d with `Math.round`, past `days > 7` a
  bare local date. The rounding is where a spec tension sits — see bug 1.
- **Durations**: `formatDuration`/`formatDurationLong` floor at every unit, clamp negatives to 0,
  no weeks (the pace-deviation rationale), pluralize exactly at 1. Test-pinned. Correct.
- **Reset wording**: weekday + `timeOfDay` (locale time lowercased, whitespace removed — the
  `\s+` class includes U+202F, the narrow no-break space newer ICU inserts before AM/PM, so
  "8:59 PM" → "8:59pm" holds on modern Node/browsers); tooltip adds month/day and the resolved
  IANA zone. 24h locales simply keep "20:59" — fine. Correct.

Boundary checks probed mentally: formatAge at exactly 60s → "1m ago"; 7d → "1w ago" (`days < 7`
false); formatRelative at exactly 7d → "7d ago" (`days <= 7`), 8d → date. Consistent with each
function's own docs.

## Functions (low-level)

- `parse(value)` — undefined/''/unparseable → undefined; delegates parsing to `new Date` (ISO
  strings from the store; locale-free). Correct.
- `formatDateTime` / `formatDateTimeShort` / `formatDate` — fallback-or-format; caller-wordable
  fallback. Correct.
- `formatAge` — see audit. Correct.
- `formatUntil` — see audit. Correct.
- `formatRelative` — see bug 1; otherwise correct (no "0m ago": sub-minute is "just now").
- `formatDuration` / `pluralize` / `formatDurationLong` — see audit. Correct.
- `timeOfDay` / `formatResetDay` / `formatResetTooltip` — see audit. Correct.

## Bugs found

1. `L87`: **formatRelative rounds where the SPEC says ago-strings are floored.** The SPEC bullet
   "Ages and durations are floored, never rounded — '1m ago' means at least a minute has passed"
   is implemented in formatAge/formatDuration but not here: `Math.round` makes 91 seconds read
   "2m ago" (1m31s → 2 minutes claimed) and 1.5 days read "2d ago". If the flooring rule is meant
   to cover every "…m/h/d ago" string the user sees, the freshness boards lie by up to half a
   unit. Counter-reading: the SPEC's freshness bullet is separate and formatAge's own doc calls
   itself "finer than formatRelative", so the rounding may be accepted legacy behavior — hence
   low confidence. Severity: minor, confidence: low. Fix sketch: switch the three `Math.round`
   steps to `Math.floor` (keeping "just now" under 60s), or amend the SPEC to scope flooring to
   formatAge/formatDuration.

