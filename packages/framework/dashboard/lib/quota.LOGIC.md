Feeds the usage panel: the account's quota [1] reading with where it stands against the quota boundary [2], and what Auto PM [3] last decided. Both are asked of the daemon every 30 seconds for as long as the panel is on screen, because both change on the daemon's clock and not the browser's — the daemon is the one that reads the quota off the coding agent and runs the sweeps [4], and it hands back what it already knows, so asking again costs nothing and starts no coding agent.

## Glossary

[1] quota: The account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: The share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[3] Auto PM: The daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[4] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.

## Business logic — TL;DR

- **The quota reading** - the account's windows, when they were read, why there is no reading when there is none, and where consumption stands against the quota boundary [2]; nothing at all until the first answer arrives.
- **What Auto PM last did** - the same 30-second rhythm, so a decision the sweep [4] made between two beats shows up on the panel without the user reloading; nothing at all on a daemon that runs no such sweep.
- **A call that fails keeps the last reading** - the panel goes on showing what it last knew rather than blanking, because an empty bar would read as "nothing used" instead of "no answer".
