Effort: 4
Uncertainty: 4

# [Plan] Launcher: choose where an agent starts

How the launcher's "Starts from" pick is shown, carried to the run as the base of its checkout, read back by the Files tab and the run page, and what a run started on unpushed commits changes downstream.

## What is already there

- The runner takes the base (#1903, #1905): `agent-runner run --base <ref>` (`cli.ts`, refused with `--resume`), through `detachRun`/`spawnRun`/`runProject` (`runner.ts`) into `createCheckout`'s `base` (`run.ts`). A base skips the fetch (`worktree.ts`: `opts.base ?? freshStart`). It is kept on the run's record for its whole life, under the runner's own mark (`caller.runner.base`, `records.ts`), and a continued run whose branch is gone starts again from it.
- The Files tab's "starting" view (#1900): `packages/files/src/tree.ts`, `starting()`, always `originDefaultBranch`, nothing marked; `FileTree.tsx` captions it "Starting from the project's files".

So what is left is the launcher, the daemon, one word in the hook line, one more key on the record, the Files tab, and the run page.

## Problems

1. **What the pick carries.** The branch the project's checkout is on can change between the launcher being read and Start being pressed. Either the browser sends a word (`head`) the daemon resolves at Start, or the branch name it showed.
2. **A start line that does not read the pick.** The pick reaches the run through the project's own `start` line in `.the-framework/hooks.yml`. `agent-runner init` never rewrites a `start` line already there, so a project set up earlier would drop the pick in silence: the launcher says "my current branch" and the run starts from `main`.
3. **The Files tab cannot read the base.** The dashboard names no tool: it never reads `caller.runner`. It reads a card's `caller` unfolded into its meta (`store/run-record.ts`), which is how `host` reaches it: the runner writes `host` twice, in its mark and beside it. `base` is only in the mark. And `RunFacts.record` (`module-server.d.ts`), all a module's server part is told about a run, has no base.
4. **No record yet.** The start hook answers the id before the run's process has written its marker, so for a moment the Files tab asks about a run nothing is known of (`!record` in `resolveAgentFiles`), and answers origin's default branch.
5. **A push publishes the user's unpushed commits.** This is what #1900 closed, reopened on purpose:
   - The agent's pull request, against `main`, lists the user's unpushed commits as its own. A command that sets its pull request to merge on its own (`/work-queue`) then merges them into `main`.
   - Reclaim (`skill-branches/src/reclaim.ts`, `branchHoldsNothing`): an agent branch that committed nothing has its tip on the user's unpushed branch, which no remote-tracking ref contains, so it reads as holding work and is pushed when its checkout is reclaimed. The user's commits are published by a run that did nothing.
   - `branches show` counts commits beyond the default branch: the user's commits are listed as the agent's.
6. **Remembering the pick** (the ticket's first open question).
7. **A device.** A relayed run starts in the device's own project, whose checkout is on another branch with other commits.

## Solutions

1. **The branch name, checked at Start.** `StartAgentOptions.base?: string` is the local branch name the picker showed: what the user read is what the run gets. The daemon checks it is a local branch (`git rev-parse --verify --quiet refs/heads/<base>`) before it runs the hook, and refuses in words when it is gone ("no branch `my-feature` in this project"); the check also keeps a name starting with `-` from reaching `git worktree add` as a flag (`createCheckout` passes the base as given). Not picked: a `head` word resolved by the daemon; simpler to validate, but the run can start from a branch the user never saw named.
2. **The picker only where the start line reads `BASE`.** `HOOK_LINES.start` gains `${BASE:+--base "$BASE"}`. The launcher's read says whether the start line mentions `BASE` (`/\bBASE\b/` over the line); without it the launcher shows the plain line "Starts from `main`", no picker. A project set up earlier removes its `start` line and runs `npx agent-runner init` again; nothing migrates it (no users, AGENTS.md). Not picked: the runner reading `BASE` from its environment itself; that hides the contract the hook line is there to show.
3. **`base` beside `host` on the card.** The runner writes `caller.base` wherever it writes `caller.host` (the marker card in `records.ts`, the running cards in `run.ts`), when the run has a base. The dashboard's meta then has `base` with no tool named, and `RunFacts.record` gains `base?: string` (`module-server.d.ts`, filled in `dashboard/module-host.ts`). A subagent's record gets it too (its base is the main agent's branch), so its Files tab starts right as well. Not picked: a top-level `base` on the logs card; that is a change to the `logs` skill's format for one reader.
4. **Accept the first moment.** With no record the tab still answers origin's default; the marker is committed locally within a second and the tab asks again every 2 seconds while starting, so the picked branch's tree replaces it on the next read. Not picked: the page passing the pick to the `tree` read as a hint (a second path for one fact, and a reload loses it), or the daemon remembering the base of each start (it holds nothing about a run, on purpose).
5. **Say it, and keep an untouched run from publishing.**
   - The picker's second choice says what it does: "my current branch (`my-feature`): what is committed, its 3 unpushed commits included. The agent's push publishes them." The count is `git rev-list --count origin/<default>..<branch>`.
   - The run page says "Started from `my-feature`" off the record (the ticket's second open question: yes). It is the only trace, after the fact, of why a pull request holds commits the agent did not write.
   - Reclaim: an `agent-*` branch whose tip is contained in a local branch the package did not mint holds nothing of its own, the same as one contained in a remote-tracking ref: it goes unpushed. This changes a rule `skill-branches/DECISIONS.md` lists under "Flow: reclaim", so it is a person's pick: propose the bullet, do not write it. When the answer is no: leave reclaim as it is and accept that an untouched run started on a local branch pushes it.
   - The pull request and `branches show` are left as they are: the request is against `main` because the user's branch is not on the remote to be its base.
6. **Not remembered.** The pick is the form's state, back to the default when the project changes or the page reloads. The default is the safe one, and the other publishes local commits: it should be picked each time it is meant. It stays picked across several starts in one sitting.
7. **No picker for a device.** With a device picked in "Run on" the line is not shown and no `base` is sent (and `onStart` drops it from what it forwards), as the project's commands are not offered there.

## The Files tab

- `starting()` in `tree.ts` takes the record's base: with one, the ref is `refs/heads/<base>` and the source carries what the marks are measured from, `{ source: 'starting', ref, branch, base }`, `base` being `forkPoint(ask, ref)`: the same merge-base with the default branch a checkout's marks use. A base this machine no longer has (deleted since) falls back to origin's default, as today.
- `readAgentTree`: a starting source with a `base` lists the tree at `ref` and marks `committedChanges(base, ref)`, deleted paths included (`withDeleted`); without one, as today, nothing marked. `'unchanged'` stays as it is.
- `readAgentFileDiff`: a starting source with a `base` answers the diff from `base` to `ref`, like a branch; the hover card asks for a diff on every marked path, so without this a marked file previews as nothing.
- `AgentTree`'s starting answer gains `branch?: string`; `FileTree.tsx` captions it "Starting from `my-feature`", and keeps "Starting from the project's files" without one.
- No jump when the checkout appears: the checkout's marks are measured from the same fork point, so the user's commits stay marked (as committed) and the agent's own are added to them. The tab does not tell the two apart; the caption and the run page say where the run started.
- Only the no-record read (Problems 4) and the `record.status === 'running'` read reach `starting()`; the second one has the record, so it passes `record.base`.

## Considerations

- A follow-up (`resume`) and a `--then` follow-up are untouched: both attach to the run's own branch.
- No remote: `originDefaultBranch` answers nothing and git starts from the head. The line reads "Starts from `<current branch>`", no picker: there is one choice.
- A detached checkout: no current branch, so only the default is offered. A checkout on an `agent-*` branch is offered like any other.
- On `main` itself the second choice still means something (local `main` with unpushed commits against `origin/main`); it is offered whenever the checkout is on a branch.
- The current branch with nothing ahead of origin's default is still offered: it may be behind, and "start from what I have here" is the pick. The text drops the unpushed-commits sentence when the count is 0.
- Uncommitted edits are not carried (the ticket says so); the choice's text says "what is committed".
- The other surfaces that start a run (`StartAgentButton`, `UpdateTicketsButton`, the scheduler, the bridge and web starts) send no base.
- The default branch's name comes from `originDefaultBranch` (`@gemstack/agent-data`), minus `origin/`; the current branch from `git rev-parse --abbrev-ref HEAD` as `readGitStatus` reads it (`dashboard/git-status.ts`).
- The launcher is read once per project (`useProjectLauncher`), so the current branch it shows can go stale: the bases are their own small read, asked again when the picker opens. The check at Start (Solutions 1) covers what is left.
- `AgentMeta.base` (a run's) and the `base` of `store/branches.ts` (a branch row's) are two things; name the meta's field in its comment.
- The e2e fake start line (`framework/src/e2e/fake-run-bin.ts`) records `PROMPT`, `DRIVER`, `MODEL`: it records `BASE` too, writes `caller.base` on its card, and an e2e story asserts the pick arrives.
- Every changed source has a `LOGIC.md` beside it (and the package `DECISIONS.md` files): read the `logic-driven-development` skill first and update them with the code.

## Implementation

1. **Runner** (`packages/agent-runner`): `init.ts`, `HOOK_LINES.start` gains `${BASE:+--base "$BASE"}`. `records.ts` `markerCard` and the two running cards in `run.ts` write `caller.base` beside `caller.host` when the mark has one. Nothing else: `--base` is there.
2. **Daemon** (`packages/framework/src`): `StartHookInput.base` → `BASE` in `runStartHook` (`project-hooks.ts`); `StartAgentOptions.base` (`dashboard/types.ts`); `onStart` in `daemon-runtime.ts` checks the branch exists, then passes it, and drops it from what is forwarded to a device. A new read in `dashboard-rpc/projects.ts`, `onStartBases(projectId)`: `{ default?: string; current?: string; ahead?: number; picks: boolean }`, `picks` being whether the start line reads `BASE`. `AgentMeta.base`; `RunFacts.record.base` (`module-server.d.ts`, `dashboard/module-host.ts`, `ServerHostDeps.agent`).
3. **Files** (`packages/files`): the section above, in `src/tree.ts` and `dashboard/FileTree.tsx`.
4. **Dashboard** (`packages/framework/dashboard`): a `StartFromMenu.tsx` beside `RunOnMenu.tsx` and `DriverModelMenu.tsx`, in the same menu idiom, passed in `StartAgentForm.tsx`'s `launcherControls`: "Starts from `main`" as the trigger, two choices, one checkmark; plain text when `picks` is false or there is one choice; absent for a device. The form holds the pick in state and adds `base` to the start's options when it is the current branch. The run page says "Started from `<base>`" off the meta, in the bar row that shows the branch (`GitStatusBar.tsx`; `AgentDetails.tsx` repeats nothing that row says).
5. **Reclaim** (`packages/skill-branches/src/reclaim.ts`), only once a person takes the bullet in Solutions 5: `branchHoldsNothing` also answers true for a tip contained in a local non-`agent-*` branch (`git branch --contains`, filtered with `isAgentBranch`), with a test in `reclaim.test.ts`.
6. **Tests**: `project-hooks.test.ts` (`BASE` set only when given); `daemon-runtime.test.ts` (an unknown branch is refused before the hook runs; a device start carries no base); `agent-runner` `init.test.ts` (the new line) and `run.test.ts` (`caller.base` on the marker and the running card, absent without a base); `files` `tree.test.ts` beside the #1900 ones (a starting run with a base lists that branch's tree and marks its changes against the default branch, answers a marked file's diff, falls back when the branch is gone; no record still answers the default); `module-host` test (`record.base`); a component test for the menu (hidden without `picks`, for a device, with no remote) and for the caption; one e2e story.

## Open for a person

- The reclaim bullet (Solutions 5): take it, or accept the push.
- Whether a command that merges its own pull request should refuse, or warn, on a run that started from a local branch. Not planned here: the launcher's text and the run page say it, and the user picked it.
