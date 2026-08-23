The dashboard's handles for the quota panel and Auto PM: where the account's usage stands against its quota boundary, what Auto PM last decided, and running one of its routines on demand.

Each handle is declared against the daemon's own implementation, so a rename or a changed shape breaks the dashboard at build time instead of failing as a missing route once a user opens the Overview.

## Business logic — TL;DR

- **Quota standing** - read where the account's quota week stands against the boundary that unattended work stands down at.
- **What Auto PM last did** - read Auto PM's last decision for the line under the panel's toggle, with "nothing to report yet" told apart from a sweep that ran and found nothing to do.
- **Run now** - trigger an Auto PM sweep immediately instead of waiting for its interval, optionally narrowed to one routine and one project, and wait for it so the card can show what the sweep decided per project rather than leaving the click without an outcome. Asking for a sweep is not the same consent as letting Auto PM spend quota unasked, so it runs even with auto-run switched off, while every other stand-down reason still applies and the schedule is left alone.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
