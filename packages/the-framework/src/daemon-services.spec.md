Every background service the daemon runs beside serving the UI: Discord notification watchers, the auto-PM sweep, CI watch, the conversation committer, merged-worktree sweeps, and the Discord chatbot with its reply mirror.

## TLDR

- Returns a three-phase teardown (quiesce, flush conversations, stop) plus live handles (reload Discord, wake auto-PM, report).
- `resumeSuspendedRuns` restarts what the previous daemon suspended on shutdown.

## Decisions

- **Uniform gating**: an env var says *where* a service may run, a preference says *whether*, and the preference is re-read **per tick** — a dashboard toggle needs no daemon restart.
- Auto-PM sweeps once immediately at boot when already enabled, rather than letting quota sit idle for a full interval.
- Saving a Discord credential triggers an immediate reconnect — the missing half that used to make the onboarding step unfinishable in-product.
- CI watch's *fix* half (start a repair run on red) takes the same consent as other self-starting work (autonomy on + quota headroom); its *merge* half runs ungated, because that run was already armed and authorized.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
