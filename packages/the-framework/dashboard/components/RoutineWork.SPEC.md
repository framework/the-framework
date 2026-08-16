The Overview's Routine work card: the jobs the scheduled sweep fires, each with a Run now that starts it against a chosen project immediately.

## TLDR

- The list is read straight from the definition the daemon runs, so screen and schedule cannot drift; Run now starts the work at once rather than asking the sweep to come sooner.
- The queue-draining routine's Run now fires a drain-only sweep — the only path that can fan out several agents, up to the concurrency setting; card-fired routines run unattended, like the sweep's own.
- Two checkbox tiers: the master switch turns the schedule on or off, a row's box takes that one routine in or out of it — recorded as opt-outs, so a routine added by a later version runs by default.
- "Trigger routine now" sweeps once even with auto-run off (the click is the consent), and the sweep answers on the card per project, so "ran and found nothing" never looks like "never ran".

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
