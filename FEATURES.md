# The Framework: feature inventory

One entry per feature (#1295). Each answers three questions:

- **What is it?** One line.
- **How does it work?** What the code does today, with file anchors.
- **How do you test it?** A deterministic recipe. Fake agents first, zero Claude usage. Real-agent drives are a separate periodic exercise, not CI.

Entries come in the order a user meets them. A feature whose entry cannot be written simply is a feature to simplify. The "how to test" lines are the backlog for the fake-agent e2e suite.

Chapters so far: **1. branch/commit/push/PR**, **2. starting a session from the composer**. Planned: add a project, queue and routines, worktrees and continue, web runs, tickets, usage and quota.

## The fake agent (shared test recipe)

For daemon-level tests without Claude:

- Put a stub `claude` first on `PATH`. It must:
  - answer `--version` instantly (runs hang otherwise)
  - answer `-p /usage --output-format json` with `{"type":"result","result":"..."}` containing lines like `Current week (all models): 3% used · resets Jul 28 at 3pm (UTC)`. No readable quota = the #879 gate starts nothing.
  - script everything else per scenario (write lifecycle events, exit).
- Point `XDG_CONFIG_HOME` at a scratch dir with `the-framework.json`: `{"projects":[{"id","path","addedAt"}]}` plus the preferences under test.
- Use a scratch git repo as the project and a daemon on a scratch port.

Unit-level you rarely need any of that: the modules below take injected `git`/`gh` runners.

---

## Chapter 1: branch, commit, push, PR

### 1.1 The run branch

Every run gets its own git worktree on its own branch. Nothing runs on your checkout.

- Branch name: `the-framework/run-<runId>` (`store/worktree.ts:23`).
- Created by `allocateWorkspace` via `git worktree add -b` (`worktree.ts:59`, `daemon-runtime.ts:461`).
- The run id is a timestamp, so the branch is unique and the start time can be read back off it (see 1.6).

Test: `store/worktree.test.ts:42`, `:211`. Fake-agent: one start = one worktree on `the-framework/run-<id>`.

### 1.2 The session name and the rename

The agent invents a readable name; the daemon renames the run branch to match.

- `SESSION_NAME` exists only in prompts (`system_prompt.md:35-37`). No env var, no flag, no code binds it.
- The agent emits a `set-session-name` block. Parsed at `turn-gate.ts:215`, it becomes a `session-name` event (`:450`).
- On that event the daemon renames `run-<id>` to `the-framework/<name>` (`cli.ts:1157` -> `renameRunBranch`, `worktree.ts:198`). If the agent already switched branches or the name is taken, the rename silently does nothing.
- Presets redefine the name three ways: `triage_quick.md:5` pins a constant, `research.md:13` derives it from the current branch. A pinned name means one branch shared by every firing (#1293).

Test: `cli.test.ts:983`, `worktree.test.ts:221`, `:234`, `preset-catalog.test.ts:154-189`.

### 1.3 The branch record

`RunMeta.branch` is the recorded answer to "which branch holds this run's work". Surfaces read it instead of guessing.

- Written by `branch` events: at run start (`cli.ts:1571`) and on a successful rename (`cli.ts:1158`); folded in `run-store.ts:326`.
- Teardown re-stamps it from the worktree's HEAD (`daemon-runtime.ts:500-505`), catching an agent that self-branched.
- Continue-run re-attaches through it (`runBranchFor`, `run-handoff.ts:114`).
- Known gap: a hands-off web run records the empty local branch while the real work lands on a remote `claude/...` branch (#1277).

Test: `cli.test.ts:983`, `run-handoff.test.ts:31`.

### 1.4 Commits

Three writers commit to a run's branch:

1. The agent doing the work.
2. The agent's pre-work safety commit of any dirty state, message `[The Framework] Uncommited changes` (the typo lives in the prompt, `system_prompt.md:34`). Code-side commits spell it right (`worktree.ts:141`, `install.ts:52`).
3. The daemon's conversation committer for `.the-framework/` files (`conversation-commit.ts:264`, wired `daemon-services.ts:207`).

So nearly every branch has commits even when the agent did nothing. That is why "empty" is judged by paths, not commit count (1.5).

Test: `conversation-commit.test.ts`, `worktree.test.ts:184`.

### 1.5 The handoff: push and PR

When a run ends cleanly, the handoff decides whether to push and open a PR. Empty runs are never published.

- Fires from `settleRun`'s success path (`cli.ts:905`). Two deliberate gaps: a user-stopped run skips it (`cli.ts:1618`), and the failure path never reaches it.
- Empty = zero commits, or every changed file under `.the-framework/` (`run-handoff.ts:311`, #1291). Empty = no push, no PR, and the Open PR button refuses.
- Otherwise: `pushRunBranch` (`:375`), then `openRunPullRequest` runs `gh pr create` (`:438`).

Test: `run-handoff.test.ts:389`, `:409` (empty), `:307`-`:363` (push + PR), `:143` (push failure reported). Fake-agent: a no-op run ends with zero pushed refs; one real commit ends with exactly one PR.

### 1.6 Finding a run's PR

No PR number is ever stored. Every surface resolves it live from the branch record.

- `resolveRunPr` (`run-handoff.ts:154`) tries: recorded branch -> `the-framework/<sessionName>` -> run-id branch.
- Each is filtered by `pickRunPr` (`gh.ts:151`): an open PR always wins; a closed one counts only if created after the run started. That stops a reused pinned branch from wearing an old merged PR (#1251/#1255).

Test: `run-handoff.test.ts:31`, `:120`, `:261`.

### 1.7 Attended vs unattended

Unattended runs end at settle so the handoff can fire. Attended runs park in the chat loop.

- One flag: `StartRunOptions.unattended` -> `--unattended` (`types.ts:80`, `daemon-runtime.ts:280`). It disables choice gates and the chat phase (`cli.ts:1514`, `:1522`).
- Always set by: the sweep (`daemon-services.ts:127`), routine "Run now", preset submits, onboarding and ticket imports (#1279).
- A typed prompt stays attended and parks at settle.

Test: `StartRunForm.test.tsx:61`, `:72`.

### 1.8 Queue claims follow PR state

A queue entry stays claimed while its run is live or its PR is open, so two drains never double-assign it.

- `claimedQueueEntries` (`queue-promote.ts:195`): live run = claimed; done run = claimed while its PR is open. Failed/stopped run or closed PR releases it.
- The card and the sweep read the queue file with the same open-entry rules (`dashboard/queue.ts`, pinned by `queue.test.ts:76`, #1296).

Test: `queue-promote.test.ts:127`-`:163`, `queue.test.ts:76`.

### Chapter 1 open seams

- `SESSION_NAME` is never enforced by code; the branch and the emitted name can disagree (#1277).
- Web runs record a branch that holds none of the work (#1277).
- The prompt tells the agent to create a branch the daemon already created; removing that is #326.

---

## Chapter 2: starting a session from the composer

### 2.1 The submit chain

Two composers, one telefunc write.

1. Launcher (`StartRunForm`): saved preferences + picked context become the options (`StartRunForm.tsx:85-88`). Preset submit adds `unattended: true`; typed prompt stays attended.
2. In-session (`RunComposer`): new session -> start with **empty options**; live run -> `sendMessage` (not a start); ended run -> start with `resumeSession` + `continueRunId` (`RunComposer.tsx:62-111`).
3. Both call `sendStart` (`control.telefunc.ts:184`): rejects empty prompts, resolves a `tickets/*.md` from the prompt (`:198`), calls the daemon.

Test: `StartRunForm.test.tsx:60`, `RunComposer.test.tsx:74-87`, `Composer.test.tsx:188/:277`.

### 2.2 The daemon, before the agent exists

`onStart` (`daemon-runtime.ts:746-858`), in order:

1. `remote`? Relay to another device, keep a memory stub, done (`:756`).
2. `topic`? Scratch-dir run that re-homes later (`:780`).
3. Resolve the project in the registry (`:781`).
4. Workspace: `continueRunId` re-attaches the recorded branch; otherwise create the worktree + run branch (1.1). Git repo + failed `worktree add` = failed start; non-repo falls back to the main checkout.
5. Busy guard per project (`:802`).
6. Build flags from the options (`startOptionFlags`, `:239-289`), spawn detached, stderr to `.the-framework/stderr.log` (`:821`).
7. Exit handlers: failed-start marker -> teardown/archive -> transient retry (`:837`).

The child owns `run.json`, `events.jsonl`, LOGS.md. The daemon writes only stderr, the failed marker (#1261), and the archive. There is no daemon-side quota check on manual starts; the #879 guard runs inside the child (`cli.ts:1734`).

Test: `daemon-workspace.test.ts:62/:95` (allocation), `:586/:607` (retry).

### 2.3 The child, in order

`runBuild` (`cli.ts:1285-1901`):

1. Merge flags over `the-framework.yml` (`:1305`); preflight the agent (`:1351`).
2. First writes: `run.json` + `events.jsonl` (`:1419`), then events: handoff-armed, ticket, queue-entry, branch (`:1559-1572`).
3. Attended or not: gates + chat exist only with a dashboard/control channel and no `--unattended` (`:1514`, `:1522`).
4. Watch the control channel: stop / message / handoff / choice picks (`:1462`).
5. Pick the driver (`run-driver.ts:27`): local Claude/Codex, `web` = CloudDriver, `actions` = ActionsDriver (needs repo slug + `GH_TOKEN` or the run fails), `fake` = the test stub.
6. Start the #879 consumption guard (`:1734`).
7. Compose the system prompt + protocols (`system-prompt.ts:385-402`); context fragments ride `--context`.
8. Run: prompt/research -> `runPrompt` (`prompt-run.ts:103`); build -> `runFramework` (`run.ts:277`: scope -> build -> checklist, todo loop, chat phase).
9. Each turn is parsed for views, session name, ready-for-merge, and blocking gates (`turn-gate.ts:442`).
10. Settle (`cli.ts:888`), in order: on-before-mergeable hook -> handoff (1.5) -> LOGS.md -> archive (`store.close`).
11. Process exit -> daemon teardown: archive, keep the worktree unless `done`, retry transient deaths (max 2, #1281).

Test: `cli.test.ts:983`, `run-handoff.test.ts`, `daemon-workspace.test.ts`. Fake-agent: script the driver and assert `events.jsonl` matches this order.

### 2.4 How the dashboard learns

No push on start. The composer navigates with the returned run id (`+Page.tsx:144-156`); if there is no id, the 2s runs poll (`use-runs.ts:10`) surfaces the running run and the page adopts it (`:163-171`, #1191). Live events stream over a telefunc channel (`use-live-events.ts:35`).

Test: `+Page` navigation tests. Fake-agent: submit, expect the run page within one poll.

### 2.5 Composer options

Option -> flag -> pinning test. Mapping lives in `Composer.tsx`, `lib/run-option-rows.ts`, `daemon-runtime.ts:239-289`.

| Control | Becomes | Pinned by |
|---|---|---|
| Typed prompt | positional prompt, kind `build` | `Composer.test.tsx:188` |
| Preset picker (`/`) | kind `prompt` + `unattended` | `PresetsMenu.test.tsx:38-81`, `StartRunForm.test.tsx:60` |
| Agent / Model | `--agent` / `--model` | `AgentModelMenu.test.tsx:35-52` |
| Run on: machine / Actions / web | `--run-on actions\|web` | `OptionsMenu.test.tsx:80-177` |
| Run on: saved device | `remote` relay (never a flag) | `OptionsMenu.test.tsx:184/:199` |
| Transparent / Autopilot / Technical / Vanilla | tri-state `--[no-]...` flags | `run-option-rows.test.ts:26-52` |
| Eco + 3 subs | `--eco-auto-planning/-research/-maintenance` | `run-option-rows.test.ts:52-98` |
| Post-merge cleanup | `--on-before-mergeable` | `run-option-rows.test.ts:98` |
| Open PR | `--auto-open-pr` (+ implied `--auto-push-branch`) | `run-option-rows.test.ts:13` |
| Browser (Claude only) | `--browser` | `run-option-rows.test.ts:64` |
| Context picker (`#`, repos) | repeated `--context` | `ContextMenu.test.tsx:30-60` |
| System-prompt disclosure | writes `vanilla`/`transparent` | `SystemPromptDisclosure.test.tsx:27-115` |
| "In play" strip | display only | `ResolvedOptions.test.tsx` |

No composer surface (internal only): `unattended`, `ticket`, `queueEntry`, `via`, `resumeSession`, `continueRunId`, `topic`, and push-without-PR (`autoPushBranch` alone; config/flag only).

Disabled rules: in-session composers hide agent/model/run-on (baked at spawn, #831/#833); Transparent greys autopilot/technical/vanilla/cleanup; Vanilla or Transparent greys Eco; Browser needs Claude without Transparent; submit disables when empty, busy, or the device is offline.

### Chapter 2 open seams

- A new session started from inside a session sends empty options: saved preferences apply only to launcher starts.
- Manual starts skip the daemon-side quota gate; only the sweep checks before starting.
- `topic` runs are fully built but unreachable from the dashboard.
- Push-without-PR exists as an option with no control.
