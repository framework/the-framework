`framework/module-server`: the contract between the daemon and a module's [1] server part, as types only, published for module authors. A server part imports nothing from The Framework at run time; its file default-exports a plain object of named reads, and each read is given the project's folder and what the core knows about the project's agents [2], and answers JSON.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **What a server part exports** - an object whose `reads` maps each read's name to a function.
- **What a read is given** - the project's folder; the facts about one agent on request: its checkout [3] while it has one, its record (status, machine, branch, pull request number, the commit its own work begins at for an agent started from a branch other than the default one, which its changes are measured from, and the last commit of its work once its main agent landed it, where its work is read once its branch is gone) and whether it ended on this machine without a pull request and was not landed, so that a branch it no longer has held nothing; and the commit a branch's pull request merged as, or that the git host is still being asked.
- **What a read is sent** - a JSON object from the module's browser part; its `agentId`, when present, names the agent the read is about, and a read about an agent relayed to a connected device is made on that device.
- **Facts, not verdicts** - the core says what it knows about an agent; what a module makes of it (where an agent's files are, for the Files module) is the module's own.
