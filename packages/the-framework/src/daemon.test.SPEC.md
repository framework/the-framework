Covers the daemon's lifecycle and dashboard-driven behavior: coming up on a fresh workspace and reporting where it bound, serving the dashboard until its signal aborts, event-log tailing, home-project and repos-directory registration rules (auto-added repos are installed first, and a failed install skips the repo), and starts over the dashboard — the JSON spec each child is handed, concurrent agents in their own worktrees, teardown reclaiming a checkout once its work is on the remote, steering through the control log, and the guard that refuses to re-exec a test file as an agent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
