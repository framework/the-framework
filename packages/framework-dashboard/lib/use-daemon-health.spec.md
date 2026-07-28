`useDaemonHealth(enabled?)` — a 5s liveness probe (one cheap `onProjects()` read) turning "daemon unreachable" into a boolean the shell can say out loud (#948).

## Problems

- A dead daemon is otherwise invisible: the live channel's transport retries silently with no channel-level verdict, and polled reads keep their last value on failure — every surface just froze, indistinguishable from a quiet agent.

## Decisions

- Recovery needs no action here: channels reconcile and polls resume on their own once the daemon answers, so the probe only reports.
- Probes on the same fixed cadence (`PROBE_MS = 5000`) healthy or not, rescheduling only after each answer (no overlap); `enabled=false` (the relay case) skips probing entirely and reads healthy.
