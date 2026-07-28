Banner in the run view for a GitHub Actions target (#1053): explains why nothing is streaming and links to the live Actions run.

## TLDR

- An Actions run replays its transcript in a burst at the end (fresh runner per turn), so a live feed looks stalled; this `role="status"` bar says the wait is expected.
- While `live`, adds "updates arrive when the run finishes"; a finished run drops that line but keeps the link.
- The "View the Actions run" link comes from `actionsRunUrl(events)` (`lib/live-state.ts`), which finds the run URL in driver `action` events; no link until the driver reports it.
- Returns `null` for any target other than `'actions'` (including unset), so the run view mounts it unconditionally.
