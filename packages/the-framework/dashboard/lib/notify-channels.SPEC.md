One shared reading of which notification channels the daemon can deliver on, so every surface showing it — the bell, the settings rows, the onboarding checklist — agrees the moment one of them changes it.

## TLDR

- Loaded once and shared: several surfaces mounting together ask the daemon a single time.
- After saving a credential, one reload settles every surface on the new state together.
- A failed read keeps the last known state — a daemon hiccup is not evidence a credential went away.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
