The rules for where the daemon's Discord notification webhook comes from: the environment first, then a value saved from the dashboard.

## User Stories

- The user turns on Discord notifications from the dashboard alone — or a deployment sets the webhook in the daemon's environment.
- The user sees which credential exists and where it came from, and is never offered an edit that would not take effect.
- The user can never read a stored credential back out of the dashboard.

## Flows

- Credentials can be set in the daemon's environment or saved from the dashboard; a dashboard save is picked up live, without a restart.
- The environment wins over a stored value, and the dashboard says so rather than offering an edit that would not take effect.
- The dashboard is only ever told which credential exists and where it came from, never the value: a stored credential cannot be read back.
- Validation rejects only what could never work (a non-URL webhook).
- The rules hold no credential and touch no file themselves, so the browser shares exactly the rules the daemon enforces.

## Rationales

- The environment wins because a browser must not quietly override how the machine was deployed.
- Validation is deliberately shallow: whether a credential actually delivers is Discord's answer to give.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
