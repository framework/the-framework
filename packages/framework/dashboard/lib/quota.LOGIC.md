Feeds the usage panel: the account's quota [1] reading with where it stands against the quota boundary [2]. It is asked of the daemon every 30 seconds for as long as the panel is on screen, because it changes on the daemon's clock and not the browser's — the daemon is the one that reads the quota off the coding agent, and it hands back what it already knows, so asking again costs nothing and starts no coding agent.

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.

## Business logic — TL;DR

- **The quota reading** - the account's windows, when they were read, why there is no reading when there is none, and where consumption stands against the quota boundary [2]; nothing at all until the first answer arrives.
- **A call that fails keeps the last reading** - the panel goes on showing what it last knew rather than blanking, because an empty bar would read as "nothing used" instead of "no answer".
