The `framework` CLI: parses argv, dispatches subcommands, and wires a live run end to end — config layers, preflight, store, control channel, dashboard, shared browser, consumption guard, journal — before handing either engine (build or direct prompt) to a shared epilogue.

## TLDR

- `parseArgs()` — pure argv → `CliOptions`: ~60 flags, subcommands (doctor, relay, stop, research, prompt, maintain, worktrees), tri-state mode toggles (#841), usage errors collected in `opts.error`.
- `runCli()` — a dispatch table: help/version/doctor/relay/resume/daemon-serve/daemon/stop/maintain/worktrees, else `runBuild()`.
- `runBuild()` — one run's lifecycle for builds, `prompt`, `research`, and transparent runs; both engines share `sharedRunOptions` and settle through `settleRun()`.
- `createRunJournal()` — the run's one event sink: print, persist, publish to the relay, fold the LOGS.md fields, track settle flags, rename the run-id branch on `session-name` (#736/#1277), hold the browser-stream port until `session` (#829).
- Exported pure helpers: `chooseSessionLink`, `claudeDriverOptions`, `unguardedNotices`, `mergeRunConfig`, `runLogKind`/`runLogEntry`, `isSteerable`/`isInteractive`, `promptRunArgs`, `buildDeployTarget`, `printStartupFooter`, `runOnBeforeMergeable`.

## Problems

- Steerable vs interactive (#905): "is a daemon alive" is a machine-global file wrong in both directions — missing while the daemon lives (#922: Stop presses written to control.jsonl, tailed by nobody) and present for unrelated runs (a terminal `--no-dashboard` run parked forever in the #714 chat loop). Split: steerable = own dashboard ∨ `--run-id` ∨ daemon alive; interactive (stays open for chat) = own dashboard ∨ `--run-id` only.
- Flags that silently do nothing are worse than errors: Codex reports no price/quota so `--max-cost`/consumption limits cannot gate it, and `--browser`/permission flags ride Claude-only config — `unguardedNotices` says which guards are not in force before the spend (#540/#542).
- Default SIGINT would kill the framework while its spawned agent tree keeps running; `armInterrupt` routes Ctrl+C/SIGTERM into aborting the run (the driver group-kills its child), a second signal force-quits (exit 130).
- Settle ordering (#835/#898): on-before-mergeable → auto-handoff → finishLog → `store.close()`, because close() archives the log into `runs/` and anything appended after misses the copy the dashboard history reads; handoff runs after the quality step so its commits get pushed; a run with no `end` event still gets a LOGS.md entry (`stopped` decides its status).
- Conversation appends are chained, not parallel (#1073-style race): each creates dir/header first, so overlapping turns could land a reply above its question; `flush()` is awaited before the log entry or the last reply is lost (#908).

## Decisions

- Headless default is `permissionMode: bypassPermissions` (#225): the library default `acceptEdits` silently denies installs/builds/tests, so the checklist could never verify the app runs; `--permission-mode`/`--dangerously-skip-permissions` override.
- Config resolves over layers, nearest wins (#841): flags > the-framework.yml; `--no-*` turns OFF what the file turned on; `--vanilla` is the negative face of `antiLazyPill`.
- Transparent (#625) = raw `claude -p`: routes any run (build kind included) through the direct prompt path verbatim — no system channel, guard, dashboard, or TODO loop — and logs as `prompt`.
- Default session link only for a live Claude run (`https://claude.ai/code`, #212); an explicit `--session-link` stands for any agent; fake/Codex get none (#542).
- `--unattended` (#846) keeps the control channel (Stop, messages) but leaves `requestChoice` unset so gates take the recommended option — auto PM fires when nobody is there.
- Both parked waits — the `requestChoice` resolver promise and the chat queue's `next()` — go through the gate keepalive (#1359): a daemon-spawned run (all stdio detached, no dashboard server, per-prompt driver children, unref'd control watcher) had nothing ref'd between turns, so Node exited 0 mid-await and the gate's picks landed in `control.jsonl` with nobody left to read them. A Stop releases the holds by resolving/closing what they wait on.
- Handoff defaults ON (#1102): a session left alone pushes its branch and opens a draft PR; the armed pair is mutable via control-channel `handoff` entries and mirrored to meta as `handoff-armed` events (only events reach a tab opened mid-run). A stopped run never hands off; `commitPendingWork` runs first only in a framework-owned checkout (`--run-id`), and its failure is its own `commit-failed` skip (#1376) — publishing a branch missing the session's last edits, or silently judging it "committed nothing", are both wrong, so the run says why and teardown rescues the work onto the branch. The merge half (#1216, `--auto-merge`/`--no-auto-merge`, defaults OFF) rides `armedHandoff` unmutated — no checkbox — and its outcome is reported beside the handoff's, never as a failed handoff.
- The on-before-mergeable follow-up spawns `framework prompt --vanilla` (skips the session-name/branch step that stranded its output on an unmerged branch, #560), never carries `--on-before-mergeable` (recursion guard), and refuses to spawn from a test entry (fork-bomb guard).
- A non-loopback `--host` prints a loud SECURITY warning + token-bearing URL (#1051): the daemon is code execution for anyone who reaches the port; the shared token is the only guard.
- Topic runs (#1120) get `bindDeps` wired to the real registry (validated `addProject`); a resolved bind travels control entry → `bind` event → meta, and the daemon re-homes the run (#1122).

## Facts

- Exit codes: 0 success or clean stop, 1 failure, 2 usage error. `frameworkVersion()` reads `../package.json` at runtime, cached, `0.0.0` fallback (#312).
- Bare `framework` foregrounds the dashboard (defers to a live background daemon); `--daemon` backgrounds it; `--daemon-serve` is the detached child's internal entry (#456).
- `--run-on actions` requires a GitHub origin remote + `GH_TOKEN`/`GITHUB_TOKEN` (a user PAT — never read from the committed the-framework.yml); `--run-on web` needs nothing (the CLI holds the account) but warns when there is no remote (bundle upload) and that unpushed commits are absent.
- `browserAttached` is narrower than `--browser`: Claude and not fake only, so the system channel never claims a browser the run lacks (#824); no Chrome found ⇒ note + old MCP path, no preview.
- The startup footer prints its static lines before the npm update check answers — the foreground path blocks on the server forever, so an awaited line would never print (#312).
- `resumeSession` is rejected on a build run (exit 2) rather than silently dropped: a fresh session that looks resumed is the worst outcome (#782).
- Store seeds `intent` so the Runs list has a label; research with no "what" uses the preset default (`defaultWhat()`); control is `resetControl`ed first so a previous run's picks can never fire into this one (gate ids repeat).

## Flows

- run: `parseArgs` → dispatch → `runBuild`: `loadFrameworkConfig` + `mergeRunConfig` → validate preset → preflight → notices → `startRunDashboard` → `RunStore.open` → `watchControl` (stop/message/handoff/bind/choice) → relay publisher → journal + start events (`handoff-armed`, `ticket`, `queue-entry`, `branch`) → `launchSharedBrowser` → `startBrowserStream` → driver (`createRunDriver` | `fakeDriver`) → `startConsumptionGuard` → `resolvePromptConfig` → `runPrompt` | `runFramework` → `settleRun`.
- settle: engine result → clearInterrupt → `maybeFireOnBeforeMergeable` → `maybeAutoHandoff` → `finishLog` → `store.close` → keep dashboard/app up until Ctrl+C; on throw: finishLog → close → clean stop ⇒ report + stay up + exit 0, else report + exit 1; finally: control/guard/stream/browser closed, relay flushed.
- resume (#211): `RunStore.open(fresh: false)` → replay saved events to terminal + read-only single-project dashboard.
- maintain (#298): `listProjects` → `planMaintenanceSweep` (per-repo baseline/review/skip) → dry-run print, or `maintainSweep` spawning `framework prompt "<maintainability>" --cwd <repo> --no-dashboard` children, recording merged state.
- worktrees (#752/#1036): list / rm <id> / prune (running kept) / sweep (only landed branches; checkouts removed, branches kept).
