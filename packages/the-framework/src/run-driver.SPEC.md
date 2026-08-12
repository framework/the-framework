Turns a run's chosen target into the driver that executes it: this device by default, a fresh GitHub Actions runner, or a Claude cloud session.

## TLDR

- The Actions target needs the repo's owner, name, and a token, and fails fast with a clear message without them; the cloud target needs nothing extra, because the agent's own signed-in account carries it.
- Kept apart from the agent choice on purpose, so GitHub configuration is never pushed onto ordinary local runs.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
