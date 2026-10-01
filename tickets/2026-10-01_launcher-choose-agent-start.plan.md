Effort: 3
Uncertainty: 4

# [Plan] Launcher: choose where an agent starts

How the launcher's "Starts from" pick is shown, carried to the run as a base for its checkout, and what a run started on unpushed commits changes downstream.

## Problems

1. **What the pick carries.** The picker says "my current branch", but the branch the project's checkout is on can change between the launcher being read and Start being pressed. Either the browser sends a word (`head`) the daemon resolves at Start, or it sends the branch name it showed.
2. **A start line that does not read the pick.** The pick reaches the run through the project's own `start` line in `.the-framework/hooks.yml`. `agent-runner init` never rewrites a `start` line that is already there (`init.ts`: "a one-line key already there keeps its line"), so every project set up before this change has a line without the new variable. There the pick would be dropped in silence: the launcher says "my current branch" and the run starts from `main`.
3. **A push publishes the user's unpushed commits.** This is what #1900 closed, reopened on purpose. Three places it shows:
   - The agent's pull request, against `main`, lists the user's unpushed commits as its own. A command that sets its pull request to merge on its own (`/work-queue`) then merges them into `main`.
   - Reclaim (`skill-branches/src/reclaim.ts`, `branchHoldsNothing`): an agent branch that committed nothing has its tip on the user's unpushed branch, which no remote-tracking ref contains, so it reads as holding work and is pushed when its checkout is reclaimed. The user's commits are published by a run that did nothing.
   - `branches show` (`branch-state.ts`) counts commits beyond the default branch: the user's commits are listed as the agent's.
4. **Remembering the pick** (the ticket's first open question).
5. **A device.** A relayed run starts in the device's own project, whose checkout is on another branch with other commits.

## Solutions

1. **The branch name, checked at Start.** `StartAgentOptions.base?: string` is the local branch name the picker showed. What the user read is what the run gets, even when the checkout moved to another branch since. The daemon checks it is a local branch (`git rev-parse --verify --quiet refs/heads/<base>`) before it runs the hook, and refuses in words when it is gone ("no branch `my-feature` in this project"); that check also keeps a name starting with `-` from reaching `git worktree add` as a flag. Alternative, not picked: a `head` word resolved by the daemon; simpler to validate, but the run can start from a branch the user never saw named.
2. **The picker only where the start line reads `BASE`.** The launcher's read (`onCommands`, `ProjectLauncher`) says whether the start line mentions `BASE` (`/\bBASE\b/` over the line). Without it the launcher shows the plain line "Starts from `main`", no picker. `HOOK_LINES.start` gains `${BASE:+--base "$BASE"}`. A project set up earlier removes its `start` line and runs `npx agent-runner init` again; nothing migrates it (no users, AGENTS.md). Alternative, not picked: the runner reading `BASE` from its environment itself; that hides the contract the hook line is there to show.
3. **Say it, and keep an untouched run from publishing.**
   - The picker's second choice says what it does: "my current branch (`my-feature`), with its unpushed commits. The agent's push publishes them." With the count when cheap (`git rev-list --count origin/<default>..<branch>`).
   - The run's record carries `base` when one was given, and the run page says "Started from `my-feature`" (the ticket's second open question: yes). It is the only trace, after the fact, of why a pull request holds commits the agent did not write.
   - Reclaim: an `agent-*` branch whose tip is contained in a local branch the package did not mint holds nothing of its own, the same as one contained in a remote-tracking ref: it goes unpushed. This changes a rule `skill-branches/DECISIONS.md` lists under "Flow: reclaim", so it is a person's pick: propose the bullet, do not write it. Shortcut when the answer is no: leave reclaim as it is and accept that an untouched run started on a local branch pushes it.
   - The pull request and `branches show` are left as they are: the request is against `main` because the user's branch is not on the remote to be its base.
4. **Not remembered.** The pick is the form's state, back to the default when the project changes or the page reloads. The default is the safe one, and the other publishes local commits: it should be picked each time it is meant. It stays picked across several starts in one sitting, so "start three agents on my branch" is one pick.
5. **No picker for a device.** With a device picked in "Run on" the line is not shown and no `base` is sent, as the project's commands are not offered there.

## Considerations

- A follow-up (`resume`) and a `--then` follow-up are untouched: both attach to the run's own branch (`attachCheckout`). `--resume` refuses `--base`, as it refuses `--driver` and `--then`.
- A base skips the fetch (`freshStart` runs only without one): nothing to fetch for a local branch.
- No remote: `originDefaultBranch` answers nothing and git starts from the head. The line reads "Starts from `<current branch>`", no picker: there is one choice.
- A detached checkout: no current branch, so only the default is offered. A checkout on an `agent-*` branch is offered like any other branch.
- On `main` itself the second choice still means something (local `main` with unpushed commits against `origin/main`); it is offered whenever the checkout is on a branch.
- Uncommitted edits are not carried (the ticket says so); the choice's text says "what is committed".
- The other surfaces that start a run (`StartAgentButton`, `UpdateTicketsButton`, the scheduler, the bridge and web starts) send no base: they start from the default.
- The default branch's name comes from `originDefaultBranch` (`@gemstack/agent-data`, already a dependency of `framework`), minus `origin/`; the current branch from the read `readGitStatus` already makes (`dashboard/git-status.ts`).
- The launcher is read once per project (`useProjectLauncher`), so the current branch it shows can be stale; the bases are their own small read, asked again when the picker opens.
- The e2e fake start line (`framework/src/e2e/fake-run-bin.ts`) records `PROMPT`, `DRIVER`, `MODEL`: it records `BASE` too, and an e2e story asserts the pick arrives.
- Every changed source has a `LOGIC.md` beside it (and the package `DECISIONS.md` files): read the `logic-driven-development` skill first and update them with the code.

## Implementation

1. **Runner** (`packages/agent-runner`): `run --base <ref>` in `cli.ts` (usage text; refused with `--resume`); `base` through `detachRun`/`spawnRun`/`runProject` in `runner.ts` into `RunOptions.base` in `run.ts`; `createCheckout(repo, { agentId: id, ...(opts.base ? { base: opts.base } : {}) }, git)`; `base` on the run's marker card and record (`records.ts`). `init.ts`: `HOOK_LINES.start` gains `${BASE:+--base "$BASE"}`.
2. **Daemon** (`packages/framework/src`): `StartHookInput.base` → `BASE` in `runStartHook` (`project-hooks.ts`); `StartAgentOptions.base` (`dashboard/types.ts`); `onStart` in `daemon-runtime.ts` checks the branch exists, then passes it; it is dropped from what is forwarded to a device. A new read in `dashboard-rpc/projects.ts`, `onStartBases(projectId)`: `{ default?: string; current?: string; ahead?: number; picks: boolean }`, `picks` being whether the start line reads `BASE`.
3. **Dashboard** (`packages/framework/dashboard`): a `StartFromMenu.tsx` beside `RunOnMenu.tsx` and `DriverModelMenu.tsx`, in the same menu idiom, passed in `StartAgentForm.tsx`'s `launcherControls`: "Starts from `main`" as the trigger, two choices, one checkmark; plain text when `picks` is false or there is one choice; absent for a device. The form holds the pick in state and adds `base` to the start's options when it is the current branch. The run page (`AgentDetails.tsx` or the git status bar, wherever the branch is shown) says "Started from `<base>`" off the record.
4. **Reclaim** (`packages/skill-branches/src/reclaim.ts`), only once a person takes the bullet in Solutions 3: `branchHoldsNothing` also answers true for a tip contained in a local non-`agent-*` branch (`git branch --contains`, filtered with `isAgentBranch`), with a test in `reclaim.test.ts` beside the #1650 ones.
5. **Tests**: `project-hooks.test.ts` (`BASE` set only when given), `daemon-runtime.test.ts` (an unknown branch is refused before the hook runs; a device start carries no base), `agent-runner` `cli.test.ts`/`run.test.ts` (`--base` reaches `createCheckout`, lands on the record), `init.test.ts` (the new line), a component test for the menu (hidden without `picks`, for a device, with no remote), one e2e story.

## Open for a person

- The reclaim bullet (Solutions 3): take it, or accept the push.
- Whether a command that merges its own pull request should refuse, or warn, on a run that started from a local branch. Not planned here: the launcher's text and the run page say it, and the user picked it.
