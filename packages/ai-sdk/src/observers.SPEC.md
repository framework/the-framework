Process-wide announcements of agent activity — completed runs, failures, per-step progress, and eval case results — that any package can subscribe to.

## TLDR

- Each event carries what an observability dashboard needs: which agent, which model, tokens, duration, tools called, and how the run ended.
- Step events fire after every loop iteration so progress can be reported before the run finishes; eval events fire per case, including skipped ones, so coverage gaps stay visible.
- A subscriber that throws is ignored — observability must never break a live agent run.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
