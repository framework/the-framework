Turns an agent's chosen target into the driver that executes it: this device by default, a fresh GitHub Actions runner, or a Claude cloud session.

## Flows

- The Actions target needs the repo's owner, name, and a token, and fails fast with a clear message without them; the cloud target needs nothing extra, because the agent's own signed-in account carries it.

## Rationales

- The target is kept apart from which CLI the agent uses, so GitHub configuration is never pushed onto ordinary local agents.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
