The deploy decision: an agent decides how the app should render and where it should ship, then hands that plan to a deploy target that executes it.

## TLDR

- Deciding and executing are deliberately separate: this step decides the plan; a pluggable target ships it.
- The agent is told to decide, not ask: server-rendered for per-request data or auth, prebuilt for mostly-static content, client-only for dashboards behind a login.
- The answer is checked against the allowed choices, so a stray value can never pick an unknown mode or target.
- The default target only decides and narrates — nothing ships until a real adapter is wired in, so bootstrap never does a blind deploy.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
