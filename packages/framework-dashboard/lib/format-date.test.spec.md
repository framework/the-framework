Tests for `format-date.ts` — covers the fallback path for absent/unparseable timestamps (#759), floored age and duration units, `formatUntil`'s past-due-reads-as-imminent rule, and the reset-day/tooltip wording.

## TLDR

- Real timestamps defer to `toLocaleString`/`toLocaleDateString`; `undefined`, `''`, and garbage all read as `—` (or the caller's wording).
- `formatAge`/`formatDuration`: 90s floors to "1m", not "2m"; age climbs s → m → h → d → w → y, duration stops at days.
- Negative durations clamp to "0s"; `formatDurationLong` pluralizes ("1 second" / "2 seconds").
- Reset formatters asserted against the machine's own locale output, with the zone taken from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
