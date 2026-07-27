# The Framework: feature inventory

Every feature: what it is called, how it works today (file anchors, not aspirations), and how to test it deterministically (#1295). One entry per feature, in the order a user meets them. A feature whose entry cannot be written simply is a feature to simplify.

The inventory is the source of truth the fake-agent e2e suite grows against: every "how to test" line is a test to write or a test that exists. Real-agent drives stay a separate periodic exercise for prompt adherence, not CI.

Planned chapters, in user order: add a project, first session, the branch/commit/push/PR seam, queue and routines, worktrees and continue, web runs, tickets, usage and quota. The seam chapter is written first because it is where most of the current bugs live (#1277).

## The fake agent

Shared recipe for daemon-level tests, zero Claude usage:

- A stub `claude` executable first on `PATH`. It must answer `--version` immediately (runs hang pre-meta otherwise) and `-p /usage --output-format json` with `{"type":"result","result":"..."}` whose text contains quota lines matching `^(.+?):\s+(\d+(?:\.\d+)?)% used(?:\s*·\s*(.+))?$`, including a week line with a month-day-hour reset ("resets Jul 28 at 3pm (UTC)"). Without a readable quota the #879 gate refuses to start anything. Every other invocation: the scenario's scripted behavior (write lifecycle events, exit).
- An isolated registry: `XDG_CONFIG_HOME` pointing at a scratch dir with `the-framework.json` containing `{"projects":[{"id","path","addedAt"}]}` plus the preferences under test.
- A scratch git repo as the project, a daemon on a scratch port.

Unit-level, the seam is already testable without any of that: the modules below take injected `git`/`gh` runners and fake stores.

---

## Chapter 1: the branch / commit / push / PR seam

### 1.1 The run branch

**Name.** Every run gets its own branch and its own git worktree; nothing ever runs on the user's checkout or a shared branch.

**How it works.** `runBranchName(runId)` returns `the-framework/run-<runId>` (`packages/the-framework/src/store/worktree.ts:23`). `allocateWorkspace` creates the worktree on that branch via `addWorktree` (`worktree.ts:59`, `git worktree add -b`) at `daemon-runtime.ts:461`. The run id is timestamp-shaped, so the branch name is unique per run and `startedAtFromRunId` can invert it later (see 1.6).

**How to test.** `store/worktree.test.ts:42` (worktree args), `:211` (name shape). Fake-agent level: start a run, assert the repo gained one worktree on `the-framework/run-<id>`.

### 1.2 The session name and the rename

**Name.** The agent invents a human-readable session name; the daemon renames the run branch to match, so branches read `the-framework/<name>` instead of a timestamp.

**How it works.** `SESSION_NAME` is a prompt macro only. The system prompt tells the agent to invent a slug, create branch `the-framework/<SESSION_NAME>`, and call `setSessionName` (`prompts/system_prompt.md:35-37`). No code binds it: no env var, no flag. The only code path is the agent-emitted `set-session-name` block, parsed in `turn-gate.ts:215` into a `session-name` event (`turn-gate.ts:450`). On that event `cli.ts:1157` (inside `createRunJournal`) calls `renameRunBranch` (`store/worktree.ts:198`), which renames the run-id branch to `the-framework/<name>` and silently returns `false` if the agent already switched branches or the name is taken.

Presets redefine the macro three different ways: `triage_quick.md:5` pins it to a constant, `research.md:13` derives it from the current branch (inside a run worktree that is the run-id branch). A pinned name means one branch shared across unlimited runs, which is how a closed PR's leftover branch jams the routine forever (#1293).

**How to test.** `cli.test.ts:983` (rename + branch event), `worktree.test.ts:221` (rename only while still on the run-id branch), `:234` (never throws), `preset-catalog.test.ts:154-189` (preset pinning).

### 1.3 The branch record

**Name.** `RunMeta.branch` is the recorded answer to "which branch is this run's work on"; surfaces read it instead of guessing.

**How it works.** A `branch` event (`events.ts:216`) is emitted at run start with the branch the checkout is actually on (`cli.ts:1571`) and again when the rename succeeds (`cli.ts:1158`); the store folds it into `meta.branch` (`store/run-store.ts:326`). At teardown the archive re-stamps it from the worktree's live HEAD (`daemon-runtime.ts:500-505`, `run-store.ts:702`), which catches an agent that self-branched off the run-id branch. Continue-run re-attaches through `runBranchFor` (`run-handoff.ts:114`, first rung is `run.branch`) at `daemon-runtime.ts:427`.

Known gap: a hands-off web run records the local run-id branch, which has zero commits; the real work lands on a remote `claude/...` branch the framework never learns (#1277, documented, not fixed).

**How to test.** `cli.test.ts:983`, `run-handoff.test.ts:31` (recorded branch wins). Fake-agent level: a stub that self-branches must still end with `meta.branch` naming the branch that holds its commit.

### 1.4 Commits

**Name.** Three writers commit to a run's branch: the agent doing the work, the agent's pre-work safety commit, and the daemon's conversation committer.

**How it works.** The system prompt orders a safety commit of any pre-existing dirty state, message `[The Framework] Uncommited changes` (sic, the typo is in the prompt: `system_prompt.md:34`); only the agent produces that spelling. Code-side, `commitPendingWork` (`store/worktree.ts:135`) and `install.ts:52` commit `[The Framework] uncommitted changes`. Separately the daemon's conversation committer (`conversation-commit.ts:264`, wired at `daemon-services.ts:207`) commits `.the-framework/` conversation and session files on its own cadence.

Consequence: nearly every run branch carries bookkeeping commits even when the agent did nothing, which is why "empty" is judged by paths, not by commit count (next entry).

**How to test.** `conversation-commit.test.ts` (pathspecs, cadence), `worktree.test.ts:184` (dirty-worktree work is kept on the branch).

### 1.5 The handoff: push and PR

**Name.** When a run ends cleanly, the handoff decides whether to push the branch and open a PR; empty runs are never published.

**How it works.** `settleRun`'s success path calls `maybeAutoHandoff` (`cli.ts:905`; defined `cli.ts:1612`). Two deliberate gaps: a run the user stopped skips it (`cli.ts:1618`, reason `run-stopped`), and `settleRun`'s catch block never calls it, so failed or aborted runs never hand off. `readRunHandoff` computes `empty: commits.length === 0 || files.every(isBookkeepingPath)` (`run-handoff.ts:311`, `:222`), i.e. a branch whose only changes live under `.the-framework/` is empty (#1291); `runAutoHandoff` skips empty runs (`run-handoff.ts:553`) and `openSessionPullRequest` refuses them (`:487`). Otherwise `pushRunBranch` pushes with `--set-upstream` (`:375`) and `openRunPullRequest` pushes then runs `gh pr create` (`:438`, `:451`).

**How to test.** `run-handoff.test.ts:389` and `:409` (bookkeeping-only is empty), `:261` (already merged is empty), `:307`/`:330`/`:363` (armed handoff pushes and opens), `:143` (push failure is reported, not swallowed). Fake-agent level: a no-op run must end with zero pushed refs and no PR; a run with one real commit must end with exactly one PR.

### 1.6 Finding a run's PR

**Name.** No PR number is ever stored; every surface resolves a run's PR live from its branch record.

**How it works.** `resolveRunPr` (`run-handoff.ts:154`) builds candidate branches in order: recorded branch, `the-framework/<sessionName>`, run-id branch (`:160-166`), and filters each through `pickRunPr` (`dashboard/gh.ts:151`): an OPEN PR always wins; a closed PR only counts if it was created at or after the run started (`since = run.startedAt ?? startedAtFromRunId(run.id)`), oldest first. The since-filter is what keeps a reused pinned branch from wearing a merged PR from days ago (#1251, #1255).

**How to test.** `run-handoff.test.ts:31`, `:120`, `:261`.

### 1.7 Attended vs unattended runs

**Name.** Unattended runs end at settle, so the handoff can fire; attended runs park in the chat loop until the user acts.

**How it works.** `StartRunOptions.unattended` (`dashboard/types.ts:80`) becomes the `--unattended` flag (`daemon-runtime.ts:280`, parsed `cli.ts:583`). It unsets `requestChoice` (`cli.ts:1514`) which empties the chat queue (`cli.ts:1522`): no gates, no chat phase, the run ends at settle and the handoff evaluates. The sweep always starts runs unattended (`daemon-services.ts:127`), and the dashboard passes `unattended: true` from routine "Run now" (`RoutineWork.tsx:117`), preset submits (`StartRunForm.tsx:96`), the onboarding import (`OnboardingChecklist.tsx:107`), and ticket imports (`TicketsPanel.tsx:77`). A typed prompt stays attended and parks at settle (#1279).

**How to test.** `StartRunForm.test.tsx:61` (preset starts unattended), `:72` (typed prompt stays attended).

### 1.8 Queue claims follow PR state

**Name.** A queue entry stays claimed while its run is live or its PR is open, so two drains never hand the same entry to two agents.

**How it works.** `claimedQueueEntries` (`queue-promote.ts:195`): a live run claims its entry; a done run keeps the claim while `resolveRunPr` answers OPEN or the lookup is still pending (`:211-213`, wired with `resolveRunPr` at `daemon-services.ts:179`). A failed or stopped run, or a closed/merged PR, releases the entry for the next drain. The dashboard card and the sweep read the queue file with the same open-entry semantics (`dashboard/queue.ts`, pinned to the sweep's parser by `queue.test.ts:76`, #1296).

**How to test.** `queue-promote.test.ts:127`, `:147`, `:163`, `queue.test.ts:76`.

### Open seams in this chapter

- `SESSION_NAME` is never bound by code; the branch step and the `setSessionName` step are independent agent actions, so the branch and the emitted name can disagree (#1277).
- Pinned preset names share one branch across runs; a closed PR never releases it (#1293).
- Web runs record a branch that holds none of the work (#1277).
- The prompt tells the agent to create a branch the daemon already created; removing that step is the #326 surface.

---

## Chapter 2: starting a session from the composer

What happens, in order, between the Start click and a working agent, and what every composer control actually does. Anchors verified on main.

### 2.1 The submit chain

**Name.** Two composers start sessions: the launcher's `StartRunForm` and the in-session `RunComposer`. Both funnel into one telefunc write, `sendStart`.

**How it works.**
1. `StartRunForm` builds options from the saved preferences plus the picked context (`StartRunForm.tsx:85-88`) and submits (`:96`). A preset submit adds `unattended: true`; a typed prompt stays attended (#1279).
2. `RunComposer` has three branches (`RunComposer.tsx:62-111`): new session -> `start(projectId, text, 'prompt', {})`; live run -> `sendMessage` (a control-log write, not a start); ended-but-resumable -> `start` with `resumeSession` + `continueRunId`.
3. Both go through `useStartRun` (`lib/use-start-run.ts:29`) -> `sendStart` (`dashboard-rpc/control.telefunc.ts:184`): rejects an empty prompt (unless research), resolves a `tickets/*.md` from the prompt server-side (`:198`, an explicit `options.ticket` wins), then calls the daemon's `startRun`.

Open seam: the `RunComposer` new-session branch sends `{}`, so a session started from inside another session ignores every saved preference the launcher would have applied.

**How to test.** `StartRunForm.test.tsx:60` (preset -> unattended), `RunComposer.test.tsx:74-87` (new-session branch), `Composer.test.tsx:188/:277` (submit paths).

### 2.2 What the daemon does before the agent exists

**Name.** `onStart` (`daemon-runtime.ts:746-858`) turns one telefunc call into a detached child in its own worktree. The daemon writes almost nothing; the child owns its own record.

**How it works, in order.**
1. `options.remote` short-circuits to the relay: the run happens on another device, only a memory stub is kept (`:756-777`).
2. `options.topic` short-circuits to a scratch-dir run that later re-homes onto a project (`:780`, `:661-734`).
3. Project resolution against the registry (`:781`), spawn binary resolution (`:784`).
4. Workspace: `continueRunId` re-attaches the recorded branch (`continueWorkspace`, `:418`); otherwise `allocateWorkspace` (`:456`) creates `.the-framework/worktrees/<runId>` on `the-framework/run-<runId>` and links dependencies. In a git repo a failed `worktree add` fails the start (#997); a non-repo falls back to the main checkout.
5. Busy guard per project/worktree key (`:802-808`).
6. Flags: `startOptionFlags` (`:239-289`) maps the options to `--model`, `--agent`, `--run-on`, `--unattended`, `--ticket`, `--queue-entry`, `--via`, `--resume-session`, the tri-state `--[no-]autopilot/technical/vanilla/transparent/auto-push-branch/auto-open-pr`, the three `--eco-*`, `--context` (repeated), `--browser`, `--on-before-mergeable`. `onStart` itself appends `--no-dashboard`, `--cwd`, `--run-id`, `--continue-run`.
7. `spawnDetached` with stderr to `.the-framework/stderr.log` (`:821-834`); exit handlers arm `markFailedStart` -> `tearDownWorktree` -> `retryTransientDeath` (`:837-852`).

Who writes what: the child writes `run.json`, `events.jsonl` and LOGS.md; the daemon writes only the stderr file, a `failed` marker when the child died before its own meta (#1261), and the post-exit archive (`tearDownWorktree`, `:492-519`). There is no daemon-side quota gate on a manual start: the #879 boundary lives in the child (`startConsumptionGuard`, `cli.ts:1734`); only the auto-PM sweep checks quota before starting.

**How to test.** `daemon-workspace.test.ts:62/:95` (allocation and fallback), `:586/:607` (transient retry); fake-agent level: one start must yield exactly one worktree, one branch, one child, and a `run.json` written by the child.

### 2.3 The child's run, in order

**Name.** The spawned `cli.ts` run (`runBuild`, `cli.ts:1285-1901`) owns the session record and the whole lifecycle up to settle.

**How it works, in order.**
1. Config layering: CLI flags over `the-framework.yml` (`mergeRunConfig`, `:1305`); preflight for the chosen agent (`:1351`).
2. First writes: `RunStore.open` creates `run.json` + `events.jsonl` (`:1419`); `handoff-armed`, `ticket`, `queue-entry`, then the `branch` event with the checkout's actual branch (`:1559-1572`, #1277).
3. The attended/unattended switch: `requestChoice` is wired only when a dashboard or control channel exists and `--unattended` is absent (`:1514`); that same bit decides the stay-open chat queue (`:1522`). Unattended = gates auto-answer, no chat phase, the run ends at settle (#1279).
4. Control channel: `watchControl` tails stop/message/handoff/bind/choice picks (`:1462`).
5. Target and driver: `actions` requires a GitHub slug + `GH_TOKEN` or the run fails (exit 2, `:1679`); `web` prints a notice; `createRunDriver` (`run-driver.ts:27`) picks ActionsDriver / CloudDriver / local Claude or Codex; `fake` picks the stub driver.
6. The #879 consumption guard starts (`:1734`, off under transparent).
7. Prompt composition: `composeRunSystem` (`system-prompt.ts:385-402`) joins prompt block, optional BROWSER_PROTOCOL, AWAIT_PROTOCOL, HANDS_OFF_PROTOCOL (hands-off drivers), topic bind, SIGNAL_PROTOCOL; context fragments ride `--context`.
8. Two run shapes: prompt/research/transparent -> `runPrompt` (`prompt-run.ts:103`: session-start, system-prompt event, driver start, await rounds with the chat loop); build -> `runFramework` (`run.ts:277`: scope -> build -> checklist steps, todo loop, then the chat phase, all gate steps skipped for hands-off drivers).
9. Per turn, `createTurnSignalEmitter` (`turn-gate.ts:442`) parses views, `set-session-name` (the rename trigger, chapter 1.2), ready-for-merge; blocking gates come from `parseAwaitGate` (choices, multi-select, confirmation, browser, bind/create-project).
10. Settle (`settleRun`, `cli.ts:888-942`), in this exact order: clear interrupt -> on-before-mergeable hook -> `maybeAutoHandoff` (chapter 1.5) -> `finishLog` (LOGS.md) -> `store.close()` (archives the run) -> stay up only if a local dashboard is attached. The catch path skips the handoff entirely.
11. Process exit -> daemon teardown: failed-start marker (no-op if the meta exists), archive, worktree retained unless `done`, transient-death retry (max 2, #1281).

**How to test.** `cli.test.ts:983` (branch event + rename), `run-handoff.test.ts` (settle-side handoff), `daemon-workspace.test.ts` (teardown + retry); fake-agent level: a scripted driver stepping the whole order, asserting the event sequence in `events.jsonl` matches steps 2-10.

### 2.4 How the dashboard learns

**Name.** No push from the daemon on start: the composer navigates optimistically and the polls adopt the run.

**How it works.** `onRuns` poll every 2s (`lib/use-runs.ts:10`); the live event feed is a telefunc channel, not a poll (`lib/use-live-events.ts:35`). On start the page bumps a tick, resets context, and navigates with the returned `runId` (`pages/index/+Page.tsx:144-156`); a start that returned no id lands on the project and adopts the first `running` run the poll surfaces (`:163-171`, the #1191 fallback).

**How to test.** `+Page` navigation tests; fake-agent level: submit, assert the run page shows the new run within one poll interval.

### 2.5 The composer options

Every control, the option it maps to, the flag it becomes, and whether a test pins it. Full mapping: `Composer.tsx`, `lib/run-option-rows.ts`, `daemon-runtime.ts:239-289`.

| Control | Option -> flag | Pinned by |
|---|---|---|
| Typed prompt | positional prompt, kind `build` | `Composer.test.tsx:188` |
| Preset picker (`/`) | kind `prompt` + `unattended: true` | `PresetsMenu.test.tsx:38-81`, `StartRunForm.test.tsx:60` |
| Preset "new session" | forces the empty-options new-session branch | `RunComposer.test.tsx:74-87` |
| Custom/project presets | preference/file, not a run option | `PresetCreatePanel.test.tsx` |
| Agent | `agent` -> `--agent` (only non-claude) | `AgentModelMenu.test.tsx:44/:52` |
| Model | `model` -> `--model` | `AgentModelMenu.test.tsx:35` |
| Run on machine/Actions/web | `target` -> `--run-on actions\|web` | `OptionsMenu.test.tsx:80-177` |
| Run on saved device | `remote` (relay, never a flag) | `OptionsMenu.test.tsx:184/:199` |
| Transparent | `transparent` -> `--[no-]transparent` | `run-option-rows.test.ts:31/:109` |
| Autopilot (default on) | `autopilot` -> `--[no-]autopilot` | `run-option-rows.test.ts:26` |
| Technical control | `technical` -> `--[no-]technical` | `run-option-rows.test.ts:31` |
| Vanilla (no system prompt) | `vanilla` -> `--[no-]vanilla` | `run-option-rows.test.ts:52`, `SystemPromptDisclosure.test.tsx:81` |
| Eco + its three subs | `eco.*` -> `--eco-auto-planning/-research/-maintenance` | `run-option-rows.test.ts:52-98` |
| Post-merge cleanup | `onBeforeMergeable` -> `--on-before-mergeable` | `run-option-rows.test.ts:98` |
| Open PR | `autoOpenPr` (implies `autoPushBranch`) -> both flags | `run-option-rows.test.ts:13` |
| Browser | `browser` (Claude-only) -> `--browser` | `run-option-rows.test.ts:64` |
| Context picker (`#`, other repos) | `context: string[]` -> repeated `--context` | `ContextMenu.test.tsx:30-60` |
| System-prompt disclosure | writes `vanilla`/`transparent` only | `SystemPromptDisclosure.test.tsx:27-115` |
| "In play" strip | display-only | `ResolvedOptions.test.tsx` |

Options with no composer surface (daemon/internal only): `unattended` (implicit on preset submits, auto-PM, retries), `ticket` (server-resolved), `queueEntry` (drains), `via` (other surfaces), `resumeSession`/`continueRunId` (set by `RunComposer`, not user-choosable), `topic` (its telefunc is not re-exported by the dashboard shim, so nothing reaches it), `autoPushBranch` alone (push-without-PR only via preference key, flag, or `the-framework.yml`).

Disabled logic worth knowing: in-session composers bake everything at spawn, so agent/model/run-on/gear options vanish (#831/#833); Transparent greys autopilot/technical/vanilla/cleanup; Vanilla or Transparent greys Eco; Browser needs Claude and no Transparent; submit is disabled when empty, busy, or the picked device is offline.

### Open seams in this chapter

- `RunComposer`'s new-session branch sends empty options: saved preferences apply only to launcher starts.
- No daemon-side quota gate on manual starts; only the sweep checks before starting (the child guard catches it later).
- `topic` runs are built end to end but unreachable from the dashboard.
- Push-without-PR exists as an option with no surface.
