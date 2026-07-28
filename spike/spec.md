Exploratory prototypes kept outside the pnpm workspace globs; currently one spike.

## TLDR

- `cc-web-extension/` — the "Claude web bridge" Chrome MV3 extension (#1237): scrapes the question a Claude Code cloud session is parked on out of claude.ai, reports it to the local Framework daemon, and types the dashboard's answer back into the session.
