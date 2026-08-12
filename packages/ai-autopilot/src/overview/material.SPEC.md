Decides whether a change is material enough to refresh the overview — the judgment scale mode rests on, since a stale map is worse than none yet refreshing on every edit would be churn.

## TLDR

- Material signals: a build or configuration change, a test-tooling migration, a change sweeping many files across several areas, or a change summary that describes a restructure.
- A large change confined to a single area is not material — it does not move the map.
- The check is deterministic and cheap (file paths and words, no model call), so it can run on every change; projects can watch extra paths and tune the many-files threshold.

## Rationales

- The signal set was checked against Cloudflare's published code reviewer, which hit the same problem — overview-style instructions rot fast — and converged on the same triggers.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
