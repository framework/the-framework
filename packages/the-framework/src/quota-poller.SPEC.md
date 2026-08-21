Keeps a recent reading of the account's quota on hand, polling slowly and backing off on failure so the number is available without being refused upstream.

## User Stories

- The user's usage bar always shows a recent reading — an upstream blip never blanks it into "nothing used".

## Flows

- Polling is deliberately slow and backs off on failure rather than retrying into the refusal.
- The last good reading survives transient blips.
- An authoritative answer — no subscription, no agent installed — stops polling for good and drops the retained reading; an unrecognized readout does not, so one odd answer never kills the usage bar for the daemon's whole life.

## Rationales

- Reading the quota is expensive (it spawns the coding agent's own CLI) and gets refused when asked too often — an eager retry loop would keep the number permanently unavailable.
- The last good reading is retained through blips because a usage bar going empty would read as "nothing used", the one thing this must never imply.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
