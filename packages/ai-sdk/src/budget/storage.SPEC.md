The contract for where per-user spend counters live, plus an in-memory implementation for tests and single-process apps.

## TLDR

- Checking a cap and recording the spend happen as one atomic step — otherwise two simultaneous requests could each pass the check before either is billed, letting a user blow past their cap.
- Daily budgets roll over at midnight and monthly ones at the month boundary, in the app's chosen timezone (UTC by default).
- Debiting nothing reads the current spend without changing it, for "you've spent $X today" displays.
- The in-memory counters exist per process only, so any deployment with workers or multiple servers needs shared storage instead.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
