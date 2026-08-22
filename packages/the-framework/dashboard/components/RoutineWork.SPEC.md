The Overview's Routine work card: the jobs fired by the scheduled sweep — the daemon's recurring pass that starts routine work on its own — each with a Run now that starts it against a chosen project immediately.

## Flows

- The list is read straight from the definition the daemon runs, so screen and schedule cannot drift; Run now starts the work at once rather than asking the sweep to come sooner.
- The project a Run now targets is picked once and kept as one of the user's settings, so leaving the Overview to look at a run and coming back — or reloading — does not quietly put the first project, the user's real repo, back in the picker. A remembered project that is no longer registered falls back to the first.
- The two routines that fan out — queue-draining and ticket-planning — have their Run now ask the sweep for that routine's work only, which is the one path that can spin up several agents, up to the concurrency setting. Draining visits every project; planning stays in the project the card has picked. The two triage routines ask the sweep too, for a different reason: each works on one fixed branch, and only the sweep deletes a leftover copy of it before starting — started directly, the agent read the leftover as a triage already under way and gave up. Every other routine's Run now is one agent started directly, because concurrent copies of it would undo each other. Card-fired routines run unattended, like the sweep's own.
- Two checkbox tiers: the master switch turns the schedule on or off, a row's box takes that one routine in or out of it — recorded as opt-outs, so a routine added by a later version runs by default.
- "Trigger routine now" sweeps once even with auto-run off (the click is the consent), and the sweep answers on the card per project, so "ran and found nothing" never looks like "never ran".
- Hovering a Run now says what it is about to spend before it is spent: what that routine does, which model it will use, and where it runs — none of which the card can otherwise show, because all three come from the Global options on another page. It also says how many agents the click costs, which is one for most routines but the concurrency setting for the two that fan out. The queue-draining routine answers the model and place differently, since its Run now visits every project the daemon watches and each of those decides its own.
- Beside each Run now sits "Configure first, then run": it opens the picked project's launcher with that routine's prompt already in the box, so the model and where it runs can be set before an agent is spent. For either routine that fans out it says what it costs — the launcher sends one agent, not the fan-out.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
