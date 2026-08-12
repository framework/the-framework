Covers the daemon's lifecycle and dashboard-driven behavior: the global state file (stale records reported but not deleted, the heartbeat healing a deleted record while yielding to a live daemon, stop waiting until the port is truly free), event-log tailing, the mapping of dashboard options to run flags including tri-state on/off/absent, home-project and repos-directory registration rules, and starts over the dashboard — concurrent runs in their own worktrees, teardown retention, steering through the control log, and the guard that refuses to re-exec a test file as a run.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
