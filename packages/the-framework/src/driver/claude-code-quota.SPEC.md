Asks Claude Code where the account's subscription quota stands, by running the CLI's own usage command and parsing the prose it prints.

## User Stories

- The user sees how much of their Claude subscription each quota window has consumed, and looking it up spends none of it.

## Flows

- The read costs nothing — the CLI answers locally without prompting a model — and it runs with the CLI's own credentials, so the product never touches the user's token.
- The readout is prose, so a reworded readout is a real failure mode: an unreadable answer reports "unrecognized", never an empty reading.
- An account with no subscription quota (API-key auth) is told apart from a readout that failed to parse: one means no quota exists, the other means try again — and an account burning overage still reports its quota.
- A missing CLI, a refused fetch, and a hung read each get their own reason, so the dashboard knows whether to keep showing the last good reading.

## Rationales

- An unreadable answer never reports an empty reading because a silent zero would read as "nothing used" and let a consumption limit run the account dry.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
