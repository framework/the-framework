The dashboard's single set of date/duration formatters, all guarding against absent or unparseable timestamps so nothing ever renders as the literal "Invalid Date" (#759).

## TLDR

- Timestamps reach the UI as unvalidated strings (a run's `startedAt`, a LOGS.md heading's `at` verbatim); every formatter parses through one guard and returns a fallback (default `—`, caller-wordable) when unusable.
- `formatDateTime` / `formatDateTimeShort` / `formatDate` — absolute local renderings (short form for timestamps standing in as names, e.g. unnamed sessions in the rail).
- `formatAge` (#1139) — compact "22s/30m/3h/5d/2w/1y ago" for the Agents list; never falls back to a bare date. `formatRelative` (#948) — "just now"…"Nd ago", then a local date past a week.
- `formatUntil` (#1161/#1159) — countdown "in 4 min" / "in 2 hr"; shared by the usage panel's next-sweep line and the routines card.
- `formatDuration` / `formatDurationLong` (#960) — "2h" vs "2 hours": largest whole unit, no weeks (backs the pace-deviation figure, which cannot exceed the week).
- `formatResetDay` / `formatResetTooltip` (#960) — a quota reset as "Tuesday 8:59pm"; the tooltip spells the full date and names the viewer's IANA zone.

## Decisions

- Ages and durations are floored, not rounded: "1m ago" must mean at least a minute has passed, not "closer to one than two".
- Past-due `formatUntil` reads "any moment", never late: the daemon ticks on its own clock, so "past due" only ever means "about to happen".
- `formatResetDay` names weekday + time, no date — the quota bar above already places the reset in the week.
- The reset tooltip names the timezone explicitly: the reset is the account's own clock, and a viewer in a different zone should not have to guess whether they agree.
