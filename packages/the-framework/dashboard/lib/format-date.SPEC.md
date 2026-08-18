Every timestamp the dashboard shows is formatted here, so an absent or unparseable one reads as a quiet fallback instead of "Invalid Date".

## TLDR

- Full, short, and date-only forms for tables and rows; the short form doubles as a name for unnamed sessions.
- Ages ("22s ago", "2w ago") and durations ("2h", "2 hours") are floored, so "1m" always means at least a full minute has really passed.
- Countdowns to a scheduled sweep read past-due as "any moment" — the daemon ticks on its own clock, so overdue only ever means imminent, not late.
- A quota reset is named by weekday and time (the bar above already places it in the week), with the full date and time zone spelled out in its tooltip.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
