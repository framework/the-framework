The Overview's Routine work card: the jobs fired by the scheduled sweep — the daemon's recurring pass that starts routine work on its own — each with a Run now that starts it against a chosen project immediately.

## Flows

- The list is read straight from the definition the daemon runs, so screen and schedule cannot drift; Run now starts the work at once rather than asking the sweep to come sooner.
- The queue-draining routine's Run now fires a drain-only sweep — the only path that can fan out several agents, up to the concurrency setting; card-fired routines run unattended, like the sweep's own.
- Two checkbox tiers: the master switch turns the schedule on or off, a row's box takes that one routine in or out of it — recorded as opt-outs, so a routine added by a later version runs by default.
- "Trigger routine now" sweeps once even with auto-run off (the click is the consent), and the sweep answers on the card per project, so "ran and found nothing" never looks like "never ran".
- Beside each Run now sits "Configure first, then run": it opens the picked project's launcher with that routine's prompt already in the box, so the model and where it runs can be set before an agent is spent. For the queue-draining routine it says what it costs — the launcher sends one agent, not the fan-out.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
