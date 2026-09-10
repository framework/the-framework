A notice on the agent view for an agent [1] whose location [2] is `actions`: a GitHub Actions runner replays the agent's turn in a burst at its end, since every turn gets a fresh runner, so a live feed looks stalled with nothing streaming. The notice says the wait is expected and links to the live Actions run; for any other location it renders nothing, so the agent view can always include it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[3] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **Only for an Actions agent** - nothing is rendered for a local, relayed or web agent, or when no location is set.
- **What it says** - "Running on GitHub Actions — updates arrive when the run finishes." while the agent runs; once it has ended, just "Running on GitHub Actions.", since the updates-on-completion line no longer applies.
- **The link** - "View the Actions run", opening the Actions run in a new tab, shown only once the driver [3] has reported the run's URL in the agent's events (the rule in `lib/live-state.ts`: the latest reported run wins); until then, no link. A finished agent keeps the link.
