The daemon's side of a module's [1] server part: the host a read is given, the project's folder and the facts about its agents [2], and the one way a read is called. The facts are the core's; what a module makes of them is its own.

## Context

**Problem**: a module that shows agents' files must know where an agent works, what its record says and what became of its pull request, without reaching into the daemon's own stores, and a module's code runs inside the daemon, so nothing it does may stop the daemon.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **An agent's facts** - its checkout [3] while the project's branches provider lists one, its record (status, machine, branch, pull request number, the commit its own work begins at, the last commit of its work once its main agent landed it), and whether it finished on this machine having changed nothing; nothing for an id that is not an agent id, or for an agent with neither a checkout nor a record.
- **A pull request's merge commit** - asked of the git host through the dashboard's shared cache: "still asking" only while the git host has not answered at all, else the commit when that pull request of the branch merged, else none.
- **Calling a read** - the server part is imported once per daemon; a read gets the host and the input; a missing or broken part, an unknown read, an input that is not an object or is over 16 KB, a read that throws and a read that takes over 20 seconds each answer an error in words.

## Business logic

### An agent's facts

#### Context

See `## Context`.

#### Business logic

The id must look like an agent id (letters, digits, `-` and `_`); anything else is never looked up. The checkout is the one the project's branches provider lists for the agent, asked afresh on a miss; the project's root is never given in its place. The record is the agent's as the project keeps it: its status, its machine, its branch, its pull request's number, and, each when the record has it, `baseCommit`, the commit the agent's own work begins at (an agent started from a branch other than the default one, as a subagent is from its main agent's: its changes are measured from that commit), and `landed`, the last commit of the agent's work once its main agent landed it (its branch is gone, and its work is read at that commit). "Changed nothing" is the dashboard's one rule, the same the handoff read uses (`agent-handoff.ts`): the agent ended `done`, `failed` or `stopped` on this machine, by its record's machine, has no pull request, and was not landed. An agent with neither a checkout nor a record has no facts.

### A pull request's merge commit

#### Context

**Problem**: the first read of a branch's pull requests is a git host call that may take longer than a poll waits; a module must be able to tell "not known yet" from "no merge commit".

#### Business logic

The branch's pull requests are read through the cache every pull request read of the dashboard shares. While that read has no answer at all, the lookup says it is still asking; once it has one (even while a refresh is out), the answer is the merge commit of the pull request with that number, or none. A failed read answers none.

### Calling a read

#### Context

**Problem**: the browser names the read and sends its input; the daemon must stay up whatever the module's code does.

#### Business logic

The server part's file is imported once and kept for the daemon's life; a file whose default export has no `reads` object did not load ("the module’s server part did not load"). The read must be one of the part's own reads, never a name every object carries such as `toString` ("the module has no read <name>"). The input must be an object ("a read takes an object") of at most 16 KB as JSON ("the read input is too large"). The read is given the host and the input; its answer is returned, nothing as an empty answer. A read that throws answers its error's message, and one that has not answered after 20 seconds answers "the read <name> took too long".
