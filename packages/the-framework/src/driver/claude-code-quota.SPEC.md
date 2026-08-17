Asks Claude Code where the account's subscription quota stands, by running the agent's own usage readout and parsing the prose it prints.

## TLDR

- The read costs nothing — the driver answers locally without prompting a model — and it runs with the driver's own credentials, so the product never touches the user's token.
- The readout is prose, so a reworded readout is a real failure mode: an unreadable answer reports "unrecognized", never an empty reading, because a silent zero would read as "nothing used" and let a consumption limit run the account dry.
- An account with no subscription quota (API-key auth) is told apart from a readout we failed to read: one means no quota exists, the other means try again — and an account burning overage still reports its quota.
- A missing agent, a refused fetch, and a hung read each get their own reason, so callers know whether to keep the last good reading.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
