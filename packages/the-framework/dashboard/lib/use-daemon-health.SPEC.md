Whether the daemon is answering at all, so the dashboard can say "unreachable" out loud instead of quietly freezing. A cheap read is made every five seconds — at the same pace whether the daemon is healthy or not — and the next one is only scheduled once the previous has answered, so probes never pile up. The dashboard assumes health until a probe actually fails, so it never accuses the daemon before it has asked.

This exists because a dead daemon is otherwise invisible: the live feed retries silently, and polled reads keep their last answer when a read fails, so every surface simply stops moving and looks exactly like a quiet agent. Recovery needs nothing beyond the probe succeeding again: the live feeds reconcile and the polled reads resume on their own once the daemon answers.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
