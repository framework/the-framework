Fixes how far a run [1] publishes its work when its agent finishes: the three publish levels [2] (`branch`, `pr`, `merge`), the four options of the publish menu [3] ("Nothing", then one per level) with the label each reads as, the check that a value names a level or an option at all, which options a project is offered, which option is in force in a project, and the level an option hands the project's start hook. It depends on nothing, so the registry's preference check, the daemon's Start and the dashboard all read this one copy.

## Context

**User story**: the user picks in the launcher, before Start, what the agent publishes when it finishes: nothing, its branch, its pull request, or its pull request set to merge once its checks pass. The pick is saved and holds for every next run. In a project with no git host provider [4], where no pull request can be opened, the user is offered "Nothing" and "Publish branch" only.

**Business logic story**: The Framework publishes nothing itself. A publish level [2] is a word handed to the project's start hook as `PUBLISH`; the three words are the ones `agent-runner run --publish` takes, and the tool the hook names tells the agent, in one sentence after its prompt, how far to publish. "Nothing" hands the hook no level: the run then publishes nothing unless its prompt asks.

## Glossary

[1] run: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it.
[2] publish level: how far a run publishes its work when its agent finishes: `branch` (push the branch and open no pull request), `pr` (push the branch and open its pull request) or `merge` (push the branch and open its pull request, set to merge on its own once its checks pass). A run given none publishes only what its prompt asks.
[3] the publish menu: the launcher's menu labelled "Publish", with the options "Nothing", "Publish branch", "Open PR" and "Merge on green" (`../dashboard/components/StartAgentForm.tsx`). The option the user picked is saved in the preferences as `publish`.
[4] git host provider: the package of the project that declares it provides the git host; The Framework opens and lands pull requests through the command that package declares (`store/git-host.ts`). A project with none has no git host: no pull request can be opened for it.

## Business logic — TL;DR

- **Three publish levels, in one order** - `branch`, then `pr`, then `merge`, each going further than the one before.
- **Four options, in one order** - `nothing`, then the three levels, labelled "Nothing", "Publish branch", "Open PR" and "Merge on green"; the publish menu [3] lists them in that order.
- **Only a known word counts** - a value is a publish level [2] only when it is one of the three words, and an option only when it is one of the four.
- **What a project is offered** - all four options; "Nothing" and "Publish branch" only for a project with no git host provider [4].
- **The option in force** - the saved option, "Nothing" when none is saved; an option the project is not offered is "Publish branch".
- **The level an option hands over** - none for "Nothing"; for any other option, the publish level of the same word.

## Business logic

### Three publish levels, in one order

#### Context

See `## Context`.

#### Business logic

The publish levels [2] are exactly `branch`, `pr` and `merge`, in that order, each going further than the one before: the branch pushed, its pull request opened, the pull request set to merge on its own once its checks pass.

### Four options, in one order

#### Context

See `## Context`.

#### Business logic

The options of the publish menu [3] are exactly `nothing`, `branch`, `pr` and `merge`, in that order: nothing first, then each publish level [2]. Each has one label: "Nothing", "Publish branch", "Open PR" and "Merge on green". The publish menu is drawn from this list.

### Only a known word counts

#### Context

**Problem**: the saved option travels through a file the user can edit (the registry's preferences), and the scheduler's state file, which the dashboard reads a scheduled command's publish level from, is written by another tool. An arbitrary string must not be taken for a level or an option.

#### Business logic

A value names a publish level [2] only when it is one of the three words above, and names an option only when it is one of the four; anything else, an absent value included, names neither. What happens to a value that names neither is the caller's: the registry drops a saved `publish` that is no option (`registry.ts`), and the scheduler card's read leaves out a scheduled command's `publish` that is no level (`dashboard/scheduler-state.ts`).

### What a project is offered

#### Context

**Problem**: "Open PR" and "Merge on green" both need a pull request, and a project with no git host provider [4] can open none.

#### Business logic

A project with a git host provider [4] is offered all four options. A project with none is offered "Nothing" and "Publish branch" only.

### The option in force

#### Context

**Problem**: the saved option is one setting for every project, so an option saved in a project that has a git host provider [4] can be one another project is not offered.

#### Business logic

The option in force in a project is the saved one, or "Nothing" when none is saved. When the project is not offered that option ("Open PR" or "Merge on green" in a project with no git host provider), the option in force is "Publish branch", the furthest that project goes. The saved option itself is not changed. The publish menu [3] shows the option in force, and the daemon's Start applies the same rule to the publish level it was sent (`daemon-runtime.ts`), so a start that asks for a pull request in such a project is started at `branch`.

### The level an option hands over

#### Context

See `## Context`.

#### Business logic

"Nothing" hands the start hook no publish level [2]. Each other option hands the level of the same word: "Publish branch" `branch`, "Open PR" `pr`, "Merge on green" `merge`.
