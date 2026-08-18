Keeps a recent reading of the account's quota on hand, polling slowly and backing off on failure so the number is available without being refused upstream.

## TLDR

- Reading the quota is expensive (it launches the whole agent) and gets refused when asked too often, so polling is deliberately slow and backs off rather than retrying into the refusal — an eager loop would keep the number permanently unavailable.
- The last good reading survives transient blips: a usage bar going empty would read as "nothing used", the one thing this must never imply.
- An authoritative answer — no subscription, no agent installed — stops polling for good and drops the retained reading; an unrecognized readout does not, so one odd answer never kills the usage bar for the daemon's whole life.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
