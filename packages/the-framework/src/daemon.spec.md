The machine-global daemon lifecycle (#302/#393): the liveness state file, ensure/stop/status, the self-healing heartbeat, and the `runDaemon` body that serves the dashboard and wires the project runtime plus background services together.

## TLDR

- One daemon per machine: `DaemonState` (`pid`, `port`, `url`, `host`, `startedAt`) lives in a single global file beside the registry — `$XDG_CONFIG_HOME/the-framework-daemon.json`, else `~/.the-framework-daemon.json` — written atomically (temp file + rename, #922).
- `ensureDaemon(cwd)` returns the live daemon or spawns a detached `--daemon-serve` child and polls for its state file; `stopDaemon` SIGTERMs (escalating to SIGKILL) and waits for actual exit.
- `runDaemon(cwd)`: create `.the-framework/`, register the home project (#392) and the opt-in repos directory (#1123), reconcile orphaned `running` runs to `stopped` (#642), build the project runtime, start the Vike+Telefunc dashboard, record state + heartbeat, resume suspended runs and start background services, then block until SIGINT/SIGTERM/abort and tear down in order.
- The dashboard is a pure projection of the store: runs append to their own `events.jsonl`, the daemon tails; steering flows back through `control.jsonl` (#344) — no run↔daemon IPC.

## Problems

- Stale-pid handling (#922): `daemonStatus` reports a dead-pid state file as "no daemon" but never deletes it — a read that deleted once unregistered a *live* daemon for good (the file is only written at startup, so `framework stop` could no longer find it and a second daemon died on the bound port). Removal belongs to the two owners: the daemon's own teardown (`removeDaemonStateIfOwned`, only while the file still names its pid) and `stopDaemon`.
- The heartbeat re-asserts the state file every 5s so anything that deletes it heals within a tick; a file naming a different *live* daemon is left alone — that one owns the port and this one is the impostor.
- `stopDaemon` waits for the process to actually exit (#514): the port is only free once it is gone, so stop-then-restart would otherwise race — the new daemon hits EADDRINUSE, never reports itself, and the old one keeps serving a stale bundle with no state file.
- Startup failure after the port bound must tear the server down, or the event loop stays alive: a zombie daemon squatting the port with no state file, wedging every later `framework` start.

## Decisions

- Security (#1051): default bind is `127.0.0.1`; a non-loopback bind generates and requires the shared registry token — a daemon that spawns processes is RCE for anyone who finds the port — while the loopback path stays byte-identical zero-config. The browser bridge (#1237) is opt-in (preference `bridge`) and reuses the same secret rather than minting a second one: both guard the same daemon, and a second secret is another thing to rotate and leak without narrowing anything.
- Shutdown order is load-bearing: quiesce services (nothing may start/steer a run mid-shutdown) → `suspendRuns` (detached runs left alone become `ppid 1` orphans holding worktrees) → `flushConversations` (their last turns are now on disk, #912) → `quota.stop()` (a broken install serves 503s without taking ownership of the source) → `runtime.dispose()` (previews) → `dashboard.close()` → heartbeat stop **before** state-file removal, or the heartbeat writes the record back.
- `registerHomeProject` skips a cwd nested inside an already-tracked project (#647): the daemon creates `.the-framework/` for its own state, so running from a repo subfolder would keep re-adding a nested duplicate.
- `registerReposDirectory` runs only under the explicit `reposDirectoryAutoGrant` opt-in — it grants filesystem access to a whole directory of repos at once, so the blast radius stays a deliberate choice.
- Writes take effect live: the Discord credential store's `onChange` → `services.reloadDiscord()` (#1095); a preferences write that switches `autoPm` on → `wakeAutoPm()` (#1161, and only the switching-on write); the dashboard's sweep button → `wakeAutoPm({onDemand: true})` (#1210).
- Every background start is a verbatim `prompt`-kind run (#353): preset prompts and chat text, never build intents to re-scaffold from.
- The quota source is owned here, not by the dashboard (#685): auto PM must consult the same long-lived meter the usage panel draws — a second poller would double a rate-limited read.
- `services` is assigned after `startDashboard` on purpose (#1095): the mount must exist before the services do, and a save can only arrive over a mount that is already up — hence the `services?.` guards.

## Facts

- `DEFAULT_DAEMON_PORT` 4200; `DAEMON_STATE_HEARTBEAT_MS` 5000; ensure/stop grace default 5000ms.
- `isLoopbackHost`: `localhost`, `::1`, `[::1]`, `127.*` — anything else gates behind the token. Defined in `loopback-host.ts` (the Telefunc mount shares it) and re-exported here.
- `state.host` is absent in files written before #1051; readers treat it as optional.
- `EventTailer` is `JsonlTailer<FrameworkEvent>` kept under its historical public name.
- `listBridgeSessions` collects cloud runs across every registered project (a cloud run is not tied to the home checkout), best-effort per project so one unreadable repo cannot empty the list.

## Flows

- ensure: `daemonStatus` → live? return it → `spawnDetached(bin, ['--daemon-serve', '--cwd', cwd, '--port', …, '--host'?])` → poll state file + pid up to timeout.
- boot: mkdir `.the-framework/` → `registerHomeProject` → `registerReposDirectory` → `reconcileOrphanedRuns` per project → `createProjectRuntime` → `startDashboard` (runtime RPCs, relay endpoints, credential/preference stores, bridge) → `writeDaemonState` + `onListening` + heartbeat → `resumeSuspendedRuns` (fire-and-forget) + `startBackgroundServices` → `waitForShutdown`.
- shutdown: `quiesce` → `suspendRuns` → `flushConversations` → `quota.stop` → `dispose` → `dashboard.close` → heartbeat stop → `removeDaemonStateIfOwned`.
