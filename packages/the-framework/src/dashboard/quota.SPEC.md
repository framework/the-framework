Feeds the dashboard's usage panel: the account's quota windows and where they stand against the spending boundary.

## TLDR

- The daemon polls for the dashboard's whole life, not just while an agent is up — the panel must answer while nothing is running.
- A failed reading never blanks the panel: the last good reading is kept and marked stale, and "no reading at all" is reported as such rather than as zero usage.
- The boundary is recomputed on every read (it moves with the clock), and the user's spend-limit slider is read fresh each time so moving it needs no restart — one source, so the bar the user sees and the line automation obeys cannot disagree.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
