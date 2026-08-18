The rules for where the daemon's Discord notification webhook comes from: the environment first, then a value saved from the dashboard.

## TLDR

- Enabling Discord used to require editing the daemon's environment and restarting it; now the credentials can also be saved from the dashboard and are picked up live.
- The environment wins over a stored value, and the dashboard says so rather than offering an edit that would not take effect — a browser must not quietly override how the machine was deployed.
- The dashboard is only ever told which credential exists and where it came from, never the value: a stored credential cannot be read back.
- Validation is deliberately shallow — reject only what could never work (a non-URL webhook); whether it actually delivers is Discord's answer to give.
- Holds no credential and touches no file itself, so the browser shares exactly the rules the daemon enforces.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
