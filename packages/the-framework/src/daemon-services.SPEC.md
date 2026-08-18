Everything the daemon runs in the background beside serving the dashboard: Discord notifications, automatic project management, CI watching, agent-archive committing, and disk reclamation.

## TLDR

- One clock runs every background job, each declaring how many ticks it wants between turns rather than owning an interval — six timers used to run side by side, with no single place to look when a sweep turned out not to be running.
- Every service re-reads its preference on each tick, so a dashboard toggle takes effect without restarting the daemon.
- An agent the daemon starts resolves its options from the same two tiers the launcher uses — your settings, then the repo's committed file — so one nobody asked for and one someone clicked differ only in who asked.
- Auto PM spends idle quota on the roadmap: it fans out up to the configured number of unattended agents, each pinned to one queue entry, and promotes the queue once an agent finishes cleanly; the daemon, never the agent, writes queue promotions and ticket locks.
- The CI watch merges a watched PR once its checks pass, and puts a fix agent on one whose checks fail.
- An hourly sweep deletes the dead refs Claude-web hand-offs leave on origin, once they are old enough and provably hold no work.
- The Discord notification watchers are rebuilt when the webhook changes, so a value pasted into the dashboard works immediately.
- Every background start forces unattended mode, so gates auto-answer instead of parking forever on an absent human.
- Shutdown has two phases: stop everything that could start an agent, then commit the archives the stopped agents just wrote. Nothing is resumed on the next boot — Ctrl-C closed those agents deliberately.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
