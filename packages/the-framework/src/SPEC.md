Everything of The Framework that runs in Node: the CLI entry, the daemon, the agent lifecycle, and the policies that make unattended work safe. The browser app lives in the sibling `dashboard/` directory; this directory serves it and feeds it.

## Business logic — TL;DR

- **The CLI** - four options and no verbs: serve the dashboard in the foreground. Everything else — starting agents, settings, steering — is the dashboard. An agent's whole configuration travels to its process as one JSON spec, never as command-line flags.
- **The agent lifecycle** - an agent gets a worktree and a branch, is framed with the built-in system prompt, works turn by turn through the driver, parks on gates when it needs the user, works the agent queue when its main task settles, and publishes itself per its handoff level when done.
- **The driver seam** - the wrapped coding-agent CLI is a black box (`driver/`): prompt in, full turn out, everything learned by parsing the turn's final message. Which CLI (Claude Code, Codex) and where it runs (this device, a GitHub Actions runner, a Claude Code cloud session) are two separate axes.
- **Files are the seam** - an agent appends events to `.the-framework/events.jsonl`; steering flows back through `.the-framework/control.jsonl`; the agent's status lives in `agent.json`. The daemon and every surface are projections of these files (`store/`) — there is no process-to-process IPC.
- **The data branch** - tickets, the agent queue, and agent archives are committed to the `tf-data` branch through one serialized sync → apply → commit → push funnel, giving every machine and cloud session the same view while the default branch stays 100% code.
- **Autonomy, bounded** - on one shared background clock the daemon runs Auto PM (drain the agent queue, triage, plan — at most one firing per routine at a time, guarded by a routine lock on the data branch), the CI watch (merge on green, fix on red), and the sweeps (reclaim pushed checkouts, adopt cloud work, expire dead refs) — each start gated by the quota boundary.
- **The dashboard's server side** - `dashboard/` (in this directory) serves the built browser app and implements its reads, live event stream, actions, and daemon-to-daemon relay; `dashboard-rpc/` is the RPC surface itself.

## Glossary

- **Gate** - a point where the agent stops and asks: it emits a question with options in its turn's final message; the dashboard renders it, the user's pick (or autopilot) resumes the agent.
- **Handoff** - how far a finished agent publishes itself, one ladder: keep it local, push the branch, open a pull request (the default), or merge.
- **Quota boundary** - the pro-rated share of the account's own quota week that may be spent by now; unattended work stands down beyond it, user-asked work never does.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
