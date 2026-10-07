Fixes how far a run [1] takes its work when its agent finishes: the four publish levels [2] (`commit`, `branch`, `pr`, `merge`), the five options of the publish menu [3] ("Nothing", then one per level) with the label each reads as, the check that a value names an option at all, which options a project is offered, which option is in force in a project, and the level an option hands the project's start hook. It depends on nothing, so the registry's preference check, the daemon's Start and the dashboard all read this one copy.

## Context

**User story**: the user picks in the launcher, before Start, how far the agent takes its work when it finishes: nothing, a commit, its branch pushed, its pull request, or its pull request set to merge once its checks pass. The pick is saved and holds for every next run; until the user picks, the agent commits its work and pushes nothing. In a project with no git host provider [4], where no pull request can be opened, the user is offered "Nothing", "Commit" and "Publish branch" only. In a project whose repository has no remote, where nothing can be pushed, the user is offered "Nothing" and "Commit".

**Business logic story**: OpenAgent publishes nothing itself. A publish level [2] is a word handed to the project's start hook as `PUBLISH`; the four words are the ones `agent-runner run --publish` takes, and the tool the hook names tells the agent, in one sentence after its prompt, to commit its work and how far to publish it. "Nothing" hands the hook no level: the run then commits and publishes nothing unless its prompt asks.

## Glossary

[1] run: one task worked by a coding agent in its own checkout, on its own branch. OpenAgent starts none itself: the tool the project's start hook names runs it.
[2] publish level: how far a run publishes its work when its agent finishes: `commit` (commit the work and push nothing), `branch` (commit it, push the branch and open no pull request), `pr` (commit it, push the branch and open its pull request) or `merge` (commit it, push the branch and open its pull request, set to merge on its own once its checks pass). A run given none commits and publishes only what its prompt asks.
[3] the publish menu: the part of the launcher's "Auto" menu that lists the options "Nothing", "Commit", "Publish branch", "Open PR" and "Merge on green" (`../dashboard/components/StartAgentForm.tsx`, `../dashboard/components/AutoMenu.tsx`). The option the user picked is saved in the preferences as `publish`.
[4] git host provider: the package of the project that declares it provides the git host; OpenAgent opens and lands pull requests through the command that package declares (`store/git-host.ts`). A project with none has no git host: no pull request can be opened for it.

## Business logic — TL;DR

- **Four publish levels, in one order** - `commit`, then `branch`, then `pr`, then `merge`, each going further than the one before.
- **Five options, in one order** - `nothing`, then the four levels, labelled "Nothing", "Commit", "Publish branch", "Open PR" and "Merge on green"; the publish menu [3] lists them in that order.
- **Only a known word counts** - a value is a publish level [2] an option only when it is one of the five words.
- **What a project is offered** - all five options; "Nothing", "Commit" and "Publish branch" only for a project with no git host provider [4]; "Nothing" and "Commit" only for a project whose repository has no remote, since nothing can be published from it.
- **The option in force** - "Commit" until the user saves one; then the saved option when the project is offered it, and otherwise "Publish branch", or "Commit" in a project whose repository has no remote.
- **The level an option hands over** - none for "Nothing"; for any other option, the publish level of the same word.

## Business logic

### Four publish levels, in one order

#### Context

See `## Context`.

#### Business logic

The publish levels [2] are exactly `commit`, `branch`, `pr` and `merge`, in that order, each going further than the one before: the work committed, the branch pushed, its pull request opened, the pull request set to merge on its own once its checks pass.

### Five options, in one order

#### Context

See `## Context`.

#### Business logic

The options of the publish menu [3] are exactly `nothing`, `commit`, `branch`, `pr` and `merge`, in that order: nothing first, then each publish level [2]. Each has one label: "Nothing", "Commit", "Publish branch", "Open PR" and "Merge on green". The publish menu is drawn from this list.

### Only a known word counts

#### Context

**Problem**: the saved option travels through a file the user can edit (the registry's preferences). An arbitrary string must not be taken for a level or an option.

#### Business logic

A value names an option only when it is one of the five words above; anything else, an absent value included, names none. What happens to a value that names none is the caller's: the registry drops a saved `publish` that is no option (`registry.ts`).

### What a project is offered

#### Context

**Problem**: "Open PR" and "Merge on green" both need a pull request, and a project with no git host provider [4] can open none. "Publish branch" needs a remote to push to, and a repository that was never shared has none.

#### Business logic

A project with a git host provider [4] is offered all five options. A project with none is offered "Nothing", "Commit" and "Publish branch" only. A project whose repository has no `origin` remote is offered "Nothing" and "Commit" only, whatever its git host provider: there is nowhere to push a branch to, and a commit needs no remote.

### The option in force

#### Context

**Problem**: the saved option is one setting for every project, so an option saved in a project that has a git host provider [4] can be one another project is not offered. And a user who never opened the menu has saved none: an agent that then committed nothing would leave its work only in its checkout, and one that then pushed its branch would put on the remote what nobody asked to publish.

#### Business logic

Until the user saves an option, "Commit" is in force in every project: the agent commits its work on its own branch and nothing leaves the machine. Once one is saved, the option in force in a project is the saved one when the project is offered it. When the project is not offered that option ("Open PR" or "Merge on green" in a project with no git host provider, or any of those and "Publish branch" in a project whose repository has no remote), the option in force is the furthest that project goes with no pull request: "Publish branch", or "Commit" where the repository has no remote. A saved "Nothing" is in force in every project. The saved option itself is not changed. The publish menu [3] shows the option in force, and the daemon's Start applies the same rule to the saved option it was sent, or to none (`daemon-runtime.ts`), so every Start goes as the menu reads: a start that names no option is started at `commit`, a start that asks for a pull request in a project with no git host provider is started at `branch`, and one that asks for anything past the commit in a project with no remote is started at `commit`.

### The level an option hands over

#### Context

See `## Context`.

#### Business logic

"Nothing" hands the start hook no publish level [2]. Each other option hands the level of the same word: "Commit" `commit`, "Publish branch" `branch`, "Open PR" `pr`, "Merge on green" `merge`.
