Turns the run target the user picked for an agent into the driver that executes it: this device by default, a fresh GitHub Actions runner, or a Claude Code cloud session.

## Flows

- When the user targets a GitHub Actions runner, the repo's owner, name, and a token are required; without them the start fails fast with a message naming what to set. Targeting a cloud session needs nothing extra, because the agent's own signed-in account carries it.

## Rationales

- The target is kept apart from which CLI the agent uses, so GitHub configuration is never pushed onto ordinary local agents.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
