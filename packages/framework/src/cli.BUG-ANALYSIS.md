# Bug analysis: packages/framework/src/cli.ts

## Business logic (high-level)

The CLI entry point: four human options (`--port`, `--host`, `--help`, `--version`) whose bare
form serves the dashboard in the foreground, plus `--agent <path>` — the daemon's process API —
behind which sits the entire lifecycle of one agent: spec consumption, config layering
(spec > the-framework.yml > defaults), refusals before spending anything (layout marker, empty
prompt, resume-on-build), the control channel (Stop / message / handoff / merge / choice picks),
the journal (events fan out to terminal + store, settle flags, branch rename, held browser
port/URL), the quality follow-up (on-before-mergeable), the handoff ladder (push → PR → merge
with the merge rung authorized), and the shared epilogue (`settleAgent`) that makes both flows end
identically with exit codes 0/1/2.

Key invariants checked against `cli.SPEC.md`:

- **Four options and no verbs** — `parseArgs` enforces it; unknown tokens exit 2. Holds.
- **Refuse before spending** — layout skew, empty prompt, resume-of-build, actions with no
  remote/token all stop before a driver exists; the actions aborts additionally close out the
  already-"running" meta via `abortBeforeDriver` (records `end ok:false`, releases interrupt trap,
  control watcher, shared browser). Holds; note `abortBeforeDriver` runs before `browserStream`
  exists, so not closing it there is correct.
- **Steering** — `isSteerable` = persist && agentId; the watcher maps `stop`→abort (also resolves
  parked gates to `proceed` via the abort listener and closes the message queue), `message`→queue,
  `handoff`→re-arm + announce, `merge`→arm full ladder + `mergeAuthorized` + resolve only
  `todo-next(-N)` gates with `stop`, `choice`→resolve by id. Matches SPEC.
- **Gates park only where someone can answer** — `requestChoice` is set only when
  `control !== undefined && !opts.unattended`; parked waits ride `gateKeepalive.hold`. Matches.
- **Live chat only where a UI exists** — here the implementation diverges from the SPEC: the SPEC
  says an unattended agent "keeps its control channel — Stop and messages still work", and the
  inline comment says the same, but the chat queue is handed over only when `requestChoice` is
  defined, which excludes every unattended agent. See Bugs #1.
- **Ordering at the end** — quality step, then handoff, then `store.close()` (which archives);
  enforced in `settleAgent`. `AgentStore.append`/`close` swallow their own errors, so the epilogue
  cannot be derailed by persistence. Holds.
- **Merge is authorized** — `withheldMerge({readyForMerge, agentTodoOpen})` gates `armed.merge`
  unless `mergeAuthorized`; a withheld merge still pushes/opens the PR and is recorded on the
  handoff event. Holds.
- **Stopped ≠ failed** — `isStopped` = signal aborted || `end.stopped`; exit 0, no quality step, no
  handoff (`run-stopped` skips). Holds.
- **Branch rename** — `session-name` event triggers `renameAgentBranch` (no-op when the agent
  branched itself) and only a rename that happened emits a `branch` event. Fire-and-forget: see
  Bugs #2 for the (small) window against the handoff's `currentBranch` read.

Concurrency/ordering concerns examined: control entries arriving before the journal exists land on
`armedHandoff` and are announced by the initial `announceHandoff()` call (correct); the abort
listener drains `pendingChoices` and closes `messages` (correct); `store.append` is internally
chained so event order is preserved; `resetControl` runs before `watchControl` so a previous
agent's picks cannot fire into this one.

## Functions (low-level)

- **`CLAUDE_CODE_SESSION_LIST` / `chooseSessionLink`** — generic claude.ai/code link for a live
  Claude agent, `undefined` for fake or non-Claude. Pure; matches tests. Correct.
- **`extensionStartConfig(env)`** — `CloudDriverOptions` only when `DAEMON_URL_ENV` set and the
  registry token reads; `readDaemonToken` failure is caught to `undefined`. A missing config is
  handled downstream by `CloudDriver` (`NO_DAEMON` message), as the SPEC requires. Correct.
- **`frameworkVersion()`** — reads `../package.json` relative to the compiled entry, caches,
  falls back to `'unknown'` (deliberately not `0.0.0`). Correct.
- **`parseArgs(argv)`** — four options + `--agent`. `--port` uses `Number(argv[++i])`; a missing
  value yields NaN → error; `-0` passes (`-0 >= 0`) and behaves as 0 — harmless. A later bad token
  overwrites an earlier `error` (last error wins) — cosmetic only, exit is still 2. Correct.
- **`SESSION_DEFAULTS` / `agentOptions(spec, env)`** — re-validates untrusted fields
  (`isDriverName`, `isAgentLocation`, `isHandoffLevel`, `isTicketPath`), trims model/resumeSession,
  keeps tri-states absent. `todoLoop` is always the default `true` — `StartAgentOptions` has no
  such field, so nothing can set it false; only `transparent` disables the loop downstream.
  Correct.
- **`claudeDriverOptions()`** — constant `bypassPermissions`. Correct per #225.
- **`unguardedNotices(opts)`** — one notice: browser on non-Claude driver. Correct.
- **`agentLogKind(opts, transparent)`** — prompt for directPrompt/research/transparent, else
  build. Note it cannot see `continueBuild` (a continuation's seed never lands anyway, since the
  store keeps the prior meta). Correct.
- **`flagConfigLayer` / `mergeAgentConfig`** — spec values as the nearest layer; absent says
  nothing. Correct (pinned extensively by tests).
- **`settleAgent(ctx, run)`** — success: clear interrupt, print line, quality step, handoff, store
  close, return 0; catch: close store, report stop (0) or failure (1); finally: clear interrupt,
  close control/browser stream/shared browser. `store.close()` never rejects (internally caught),
  so the catch path's second `close()` is safe. Correct.
- **`resolvePromptConfig`** — reads SYSTEM.md once, computes `noBuiltinPrompt` = transparent ||
  vanilla, echoes the deciding layer. Correct.
- **`isSteerable` / `isInteractive`** — persist+agentId / agentId. Correct per #905/#714.
- **`armInterrupt(controller, io)`** — first SIGINT/SIGTERM aborts, second `process.exit(130)`;
  disarm removes both handlers. Correct.
- **`createAgentJournal(deps)`** — the event sink: tracks ready-for-merge, open-pr (latest wins,
  `{}` when the event has neither title nor description — harmless, both spreads skip), session
  name (+ async branch rename, see Bugs #2), stopped flag; prints + `void store?.append` (append
  is internally ordered and swallowed); holds browser port until the first `session`, re-says the
  browser URL after every `session`. The `onEvent({kind:'browser-stream'})` recursion via the
  session branch is bounded (pendingBrowserPort cleared first). Correct except the rename race.
- **`runCli(argv, io)`** — dispatch: error→2, help/version→0, `--agent`→`driveAgent`,
  else foreground daemon. Unreadable spec → 2. Correct.
- **`driveAgent(opts, io)`** — the big one; walked through above. Specific edge findings:
  - `chatQueue` (≈L935): requires `isInteractive(opts) && requestChoice`; `requestChoice` is
    `undefined` for unattended agents, so unattended agents never receive the message queue even
    though the control watcher pushes into it → Bugs #1.
  - Inside `chatQueue`, `...(opts.agentId === undefined ? { stayOpenChat: true } : {})` is dead
    code: `isInteractive` already requires `agentId !== undefined`, so `stayOpenChat` is never
    set. This matches the SPEC's current behavior (a dashboard-started agent drains and ends
    itself; the dashboard reopens as a continuation), so it is dead-but-harmless, not a behavior
    bug — but a reader can wrongly conclude some path stays open for chat.
  - `continueBuild` requires `store?.snapshot().kind === 'build'`; when the store failed to open,
    a continued build falls to the prompt path — accepted degradation (persistence is
    best-effort), noted, not a bug.
  - Actions target: slug and token resolved before any driver; both failure paths use
    `abortBeforeDriver` (exit 2, `end ok:false`), pinned by the process-level test. Correct.
  - `browserAttached` narrower than the flag (local + real + claude). Correct per #824.
- **`maybeFireOnBeforeMergeable`** — skip events for every reason; only silent when never asked.
  `binPath = process.argv[1]` is the spawned bin.js in production. Correct.
- **`maybeAutoHandoff`** — skips: not-armed / run-stopped / fake-run / commit-failed (agentId
  only) / branch-gone. Merge gate consults `agentTodoPending(cwd, sessionName)` (handles
  undefined name → false). Ticket issue ref read from the data branch, defused for plan agents
  (title and description both). Outcome event + optional `pull-request` event + terminal lines.
  Correct, modulo the rename race window (Bugs #2).
- **`runForegroundDaemonCmd`** — pre-generates the token for non-loopback binds so the sync
  `onListening` can print it; failure → 1. Correct.
- **`printNonLoopbackAccess`** — warning + token URL. Correct.
- **`printStartupFooter`** — static lines first, update line fire-and-forget, errors swallowed.
  Correct.
- **`promptAgentSpec(prompt, cwd, vanilla)`** — kind `prompt`, no `onBeforeMergeable` (recursion
  guard), optional vanilla. Correct.
- **`spawnPromptAgent`** — refuses test entries (NODE_TEST_CONTEXT or `.test.` bin), writes the
  spec, spawns inheriting stdio, removes the spec on both `error` and `exit` (double resolve of
  the promise is harmless; `removeAgentSpec` is idempotent). Correct.
- **`runOnBeforeMergeable`** — materializes presets (best-effort), runs one child, returns
  `queued`/`incomplete`. Correct.

## Bugs found

1. **L935–944 (`chatQueue` condition): live-chat messages to an unattended agent are silently
   dropped.** `chatQueue` hands `messages` to the agent only when `isInteractive(opts) &&
   requestChoice`, and `requestChoice` is deliberately left `undefined` for `opts.unattended`
   (≈L920–924). But the control watcher (L870–872) still pushes every `{kind:'message'}` entry
   into the in-memory `AgentMessageQueue`, where nothing ever drains it; the queue's contents die
   with the process. Concrete scenario: the daemon starts a drain/routine agent unattended — or
   the user fires any preset from the launcher, which `StartAgentForm.tsx` submits with
   `unattended: true` (#1279) — the user opens that live agent and types into the composer;
   `AgentComposer` sends the message (the meta records nothing about unattendedness, so the UI
   cannot know better), shows it as "queued... the agent drains it between turns", and the agent
   never sees it. This contradicts `cli.SPEC.md` ("An unattended agent keeps its control channel —
   Stop and messages still work") and the code's own comment at L911–913 ("keep the control
   channel for Stop and live messages"), and it recreates exactly the #905 silence the SPEC
   recounts. Severity: major. Fix sketch: decouple the queue from the gate switch — hand
   `messages` whenever `isInteractive(opts) && control !== undefined` (unattended still ends at
   settle since `stayOpenChat` stays off; only `requestChoice` should depend on `!unattended`).

2. **L624–629 (`createAgentJournal` session-name branch rename): fire-and-forget rename can race
   the handoff's branch read.** `renameAgentBranch(...)` is `void`-ed and nothing awaits it. If a
   `session-name` event arrives in the agent's final turn (a one-turn prompt run, or the fake
   driver's compressed timeline), `maybeAutoHandoff` can read `currentBranch(cwd)` (L1043) while
   the rename is still in flight: the push/PR then targets `tf-agent-<id>`, and the rename lands
   afterwards, leaving the PR on a branch name that no longer exists locally (or, ordered the
   other way, the recorded `branch` event lands after the `handoff` event in the archived log).
   In the common case the name arrives turns before settle so the window is a single git command;
   severity: minor, unproven in practice. Fix sketch: keep the rename promise on the journal
   (e.g. `let pendingRename: Promise<void>`) and have `maybeAutoHandoff` await it before reading
   `currentBranch`.
