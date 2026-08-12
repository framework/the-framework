Everything the daemon runs in the background beside serving the dashboard: Discord notifications and chat, automatic project management, CI watching, conversation committing, and disk reclamation.

## TLDR

- Every service re-reads its preference on each tick, so a dashboard toggle takes effect without restarting the daemon.
- Auto PM spends idle quota on the roadmap: it fans out up to the configured number of unattended agents, each pinned to one queue entry, and promotes the queue once a run finishes cleanly; the daemon, never the agent, writes queue promotions and ticket locks.
- The CI watch merges a watched PR once its checks pass, and puts a fix agent on one whose checks fail.
- The Discord services (notification watchers, chatbot, reply mirror) are rebuilt as one group when credentials change, so a token pasted into the dashboard works immediately.
- Every background start forces unattended mode, so gates auto-answer instead of parking forever on an absent human.
- Shutdown has two phases: stop everything that could start a run, then commit the conversations the stopped runs just wrote.
- After a restart, the runs the previous daemon suspended are resumed in the same checkout and conversation — unless too old to be worth stale work.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
