The read model behind the dashboard (#405): run history and replay, per-project docs/tickets/log/git reads, cross-project rollups, file-tree reads, and the browser-bridge reads — each a projection of the same files the daemon writes.

## TLDR

- Helpers: `withProject` / `withRunPath` (resolve id → forgiving read, unknown/failed → `empty`), `withProjects` (rollup over every registered project); run-scoped reads wrap in `relayOr` so a run relayed to a device is answered there (#1067).
- Runs: `onRuns` (archived + all live worktree runs #736/#738 + in-memory remote stubs #1077, one row per id, live wins ties #768), `onRun` (archived event log for replay), `onRetainedWorktrees` (#737, finished runs whose checkout is still on disk), `onRunWorktree` (#798: path, own/fallback, branch, dirty, size, PR), `onRunHandoff` (#799: branch, commits, pushed/PR state).
- Project reads: `onDocs`, `onTickets`/`onTicket`/`onTicketsMeta` (#697/#1144/#1208), `onProjectLog` (committed `LOGS.md`), `onGithubUrl` (#489), `onGitStatus` (#491), `onSystemPromptUser` (#872, the project's `SYSTEM.md` for the prompt preview).
- Cross-project rollups: `onQueue` (#438), `onOverview` (#437), `onRecentRuns`, `onHotTickets` (#1112), `onInterventions` (#632), `onActivity` (#627), `onDashboard` (#471), `onAllTickets` (#1144).
- Files: `onProjectFiles` (#504, `git ls-files`), `onProjectFileStatus` (#492 porcelain dots), `onFileDiff` (#816), `onRunChanges` (#817), `onFileContent` (#828) — all accept `runId` to read the run's own worktree (#738/#815).
- Bridge reads (#1237): `onBridgeQuestion`/`onBridgeStatus`/`onBridgeToken`/`onBridgeAnswer`/`onBridgeEvents` — the Claude-web session state the browser extension reports, keyed by cloud session id.

## Problems

- Telefunc's `getContext` works only synchronously at the top of a telefunction: `onRuns` reads `contextRemote()` before any await (#1077) or every remote run vanishes from the list on reload.
- A continued run (#762) is live again while its first leg's archive exists, so the archive would show a running run as finished — live wins the id tie (#768); statuses are not filtered because a self-healed `stopped` row (#716) may lag a poll.
- A clean run's worktree is removed at finish and `resolveRunPath` then falls back to the project root — a worktree-addressed handoff read would report the *user's* branch and dirt as the session's, so `onRunHandoff` reads the project checkout against the run's branch (the thing that outlives the run) and takes uncommitted work only from a checkout that is the session's own (#1173).
- A reused pinned branch carries a predecessor's PR history, so run-scoped PR reads are since-filtered by the run id's start time (#1255).
- `onRunWorktree` reads size only for a checkout nothing is writing to: `du` over a live run's tree mid-build is cost with no stable answer.

## Decisions

- Forgiving throughout: unknown project or failed read → empty value (`[]`/`{}`/null), never a thrown RPC.
- `onFileDiff` takes the file's status from the server's own `git status`, never from the caller — a client must not be able to make the server read a file as untracked.
- `onRunChanges` derives from the worktree via git, not from the agent's tool calls: drivers surface tool names, not arguments (#165), so git is both the honest source and the one that works for every agent.
- `onBridgeToken` returns the secret only while the bridge preference is on; revealing it to the dashboard is no new exposure (dashboard access already implies run-start capability) and replaces telling users to copy it out of `~/.the-framework.json`.
- Bridge session ids are validated against `^session_[A-Za-z0-9]{1,128}$` before touching the store; the run↔session join happens client-side from the run's own `cloud <url>` event.
