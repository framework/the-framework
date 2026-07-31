Source of the `@gemstack/the-framework` package: the CLI/daemon, the run orchestration built on ai-autopilot's spine, the driver seam, and everything the dashboard is served from.

## TLDR

Themes (~130 top-level modules plus five subdirectories):

- **Entry + CLI** — `bin.ts` (bin shim → `runCli`), `cli.ts`/`cli-exec.ts` (the `the-framework` command: arg parsing, run kick-off, on-before-mergeable handoff), `terminal.ts` (event → terminal rendering).
- **Daemon** — `daemon.ts`/`daemon-runtime.ts`/`daemon-services.ts` (long-lived background process: ensure/run/stop, state file + heartbeat, per-project services), `control.ts` (`control.jsonl` command channel into a run), `relay.ts` (event relay/publish), `host-exec.ts`, `jsonl-tail.ts`.
- **Run lifecycle** — `run.ts` (`runFramework`: the whole bootstrap flow), `steps.ts` (driver-backed build/checklist/improve gating on the `{ blockers }` verdict), `run-driver.ts`, `run-options.ts`, `run-messages.ts`, `run-view.ts` (loop/session/progress projections), `run-telemetry.ts`, `turn-gate.ts`, `await-gate.ts` (choice/multi-select gates, #636), `gate-keepalive.ts` (holds the event loop while a gate/chat wait is parked, #1359), `prompt-run.ts` (one-shot prompt runs), `todo-loop.ts` (TODO backlog loop), `sessions.ts` (per-user committed session history), `events.ts` (the `FrameworkEvent` union everything streams), `agent.ts`/`agent-names.ts` (agent registry → driver factory), `fake-script.ts` (the `--fake` scripted demo).
- **Worktrees + workspace** — `store/` (run persistence + worktree lifecycle, see its spec), `worktrees.ts`, `merged-worktrees.ts`, `stale-branch.ts` (cleanup of merged/stale run branches), `sandbox.ts` (workspace snapshots), `framework-dir.ts`.
- **Queue + autonomy** — `queue-promote.ts` (queued prompts → runs), `auto-pm.ts` (the autonomous PM loop: drain the queue / maintenance on quota headroom). Quick-win promotion is its own task, not planning's side effect (#1420 review): the [Triage quick] rotation preset picks and queues them, now with plans' `Effort`/`Uncertainty` to read.
- **Presets + prompting** — `presets.ts`, `preset-catalog.ts`, `preset-prompt.ts`, `preset-registry.ts`, `project-presets.ts`, `system-prompt.ts` (+ `system-prompt-file.ts` browser-safe split, #520), `prompt-template.ts` (`${{ }}` rendering), `on-before-mergeable-prompt.ts`, `tickets.ts` (ticket files), `prompts.generated.ts` (generated from `prompts/`).
- **Quota** — `quota-boundary.ts` (reset-window math), `quota-poller.ts`, `consumption-guard.ts` (stop spending near limits), `usage.ts`.
- **Discord** — `discord/` bridge plus `discord-credentials*.ts`.
- **Dashboard serving** — `dashboard/` (localhost server, data assembly, overview/interventions/activity), `dashboard-rpc/` (Telefunc RPCs), `client.ts` (browser-safe client surface), `preview.ts`/`preview-runtime.ts` (app preview processes), `browser.ts`/`browser-stream.ts` (agent-driven browser pane, #813), `claude-trust.ts`, `session-link.ts`.
- **Drivers** — `driver/` (the agent seam: Claude Code, Codex, GitHub Actions, cloud, fake; see its spec).
- **Projects + config** — `project.ts` (git runner, repo signals), `registry.ts` (global project registry + preferences), `repos-directory.ts`, `install.ts` (project activation), `config.ts`/`config-layers.ts` (file config + layered resolution), `preference-defaults.ts`, `runtime-keys.ts`.
- **Logs + conversations** — `logs.ts` (committed `LOGS.md` project log), `conversations.ts` + `conversation-commit.ts` (chat transcripts, auto-committed).
- **Upkeep + utils** — `maintenance.ts` (repo maintenance sweeps), `update-check.ts`, `preflight.ts`, `node-fs.ts`, `format-bytes.ts`, `error-message.ts`, `request-path.ts`.

- `index.ts` is the package's single public barrel (drivers, steps, run, store, daemon, dashboard, registry, config, presets, quota, CLI).

## Facts

- Architecture: the product wraps a coding-agent CLI as a black box behind the driver seam and gates on outcomes, running on `@gemstack/ai-autopilot`'s bootstrap/loop spine; the dashboard is a pure projection of the `FrameworkEvent` stream persisted by `store/`.
- Pervasive conventions: injectable fs/git/spawn/clock seams for in-memory tests; forgiving reads (missing/torn state yields empty, never throws); best-effort writes that never break a live run.
- Browser boundary: anything reachable from `client.ts` must not touch `node:fs` — prompts are compiled to `prompts.generated.ts` and browser-safe modules are split out (#520).
