How The Framework reads a project's checkouts [1] and acts on its branches: through the branches provider [2], a command one of the project's own packages declares, never through a package The Framework knows. It also owns the shape of what that command answers: a checkout, and a branch's state [3].

## Context

**User story**:
- The user sees every agent that is working in the project, each in its own checkout, opens one and sees which checkout it has and how much disk it takes once ended; removes a kept checkout or deletes an agent; opens a pull request for an ended agent's branch, or merges the one it has; sees in the Human Queue the agents whose work was never pushed.
- A project none of whose packages provides its checkouts shows no working agent, offers nothing to remove, and has no branch to hand off: the answer is "none", never an error.

**Business logic story**: The Framework names no skill. A project picks the package that keeps its checkouts by listing it as a dependency; that package says, in its own package.json, which of its commands answers for them. Swap it for another package that answers the same command line and prints the same shapes, and nothing in The Framework changes. What a checkout is, where it lives, how a branch is pushed, opened and landed is that package's business.

**Problem**: the dashboard reads the checkouts many times per poll, and every read of the provider is a process; a caller looking for a checkout that may have appeared a moment ago must not turn every look into a process either.

## Glossary

[1] checkout: an agent's own working copy of the project, where it works: the branches provider [2] says where it is and which branch it is on.
[2] branches provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's checkouts, in its own package.json under `"framework": { "branches": "<command>" }` (the `branches` skill's package declares its `branches` command); it lists the checkouts, tells what a branch holds, pushes and opens a branch's pull request, lands one, and reclaims a checkout (`store/branches.ts`).
[3] a branch's state: what a branch holds and where it stands, as the provider answers it: whether the branch exists on this machine, what it is measured against (the project's default branch), its own commits beyond that base (newest first), the files it changed against the base with their line counts, whether the project has a remote, whether the remote has the branch at the same tip, whether the base already contains it, and, when a checkout is on the branch, the paths uncommitted in it. Git facts only: the branch's pull request is The Framework's own read, as every pull request is.

## Business logic — TL;DR

- **Which command provides** - the first of the project's dependencies, in its package.json's order, that declares a branches provider [2] naming one of its own commands; no dependency declares one, the project has no checkouts.
- **The command line it answers** - the checkouts (with sizes on request), the state of one or several branches, a publish of a branch, a merge of a pull request, and the removal of a checkout (with its uncommitted work discarded on request); reads touch this machine only.
- **The shapes** - a checkout is kept only with a safe id and a path; a branch's state only with its name and its three verdicts; every other field only with the right type; anything that fails to answer is read as "nothing", never an error.
- **Reads are shared for five seconds** - the same list or the same branches asked again within five seconds reuse the answer; a write drops every read; a caller looking for a checkout that just appeared asks fresh, but a list read less than a second ago still answers.

## Business logic

### Which command provides

#### Context

See `## Context`.

#### Business logic

The project's own package.json is read; its `dependencies` then `devDependencies` are taken in their order, a name listed twice read once. Each is looked up in the project's `node_modules`, links followed. The first whose own package.json declares `"framework": { "branches": "<command>" }`, where `<command>` is one of that package's own commands, is the branches provider [2]. A declaration naming a command the package does not have is skipped. No package.json, no installed dependency, or no declaration: the project has no branches provider, and every read below answers "no checkouts". The provider is looked up again at most every five seconds, so a project that installs, swaps or drops its provider is read the new way within five seconds.

### The command line it answers

#### Context

**Business logic story**: the command is the same one an agent and the tool that runs it use for the checkouts; The Framework uses the forms a person's click needs.

#### Business logic

The provider's command runs with Node, in the project's root, never through a shell, for at most 30 seconds and 16 MB of output. Each call prints one JSON document and exits 0; a refusal exits 1 with its reason on its last line of error output, which is the answer a write gives back; a failure of a read is read as "nothing":
- `<command> list`, or `<command> list --sizes` when sizes are wanted: every checkout [1] as an array, each with the agent's id, its path, the branch it is on when it is on one, and its size in bytes when asked.
- `<command> show <branch> [<branch>...]`: the state [3] of each branch named, as an array in the order asked; a branch the provider did not answer for is simply missing. Nothing is run when no branch is named.
- `<command> publish --branch <branch> --title <title> [--body <body>] [--draft]`: push the branch and open its pull request, as a draft when asked; a branch that already has an open pull request is answered with that one. The answer is the pull request's number and link, and whether it was open already; an answer with no pull request is a failure ("<command> opened no pull request").
- `<command> merge <number>`: land the pull request: armed on GitHub to merge when its checks pass, merged at once, or this machine watching its checks; any other answer is a failure, in the provider's words when it gave any.
- `<command> remove <id>`, or `<command> remove <id> --discard`: reclaim the agent's checkout once the remote has everything in it, or, with `--discard`, whatever it holds, its uncommitted work gone with it. The answer carries the branches that went with the checkout, when any did. An id that is not letters, digits, `-` and `_` never reaches the command.
`list` and `show` read this machine only, no network: The Framework polls them.

### The shapes

#### Context

See `## Context`.

#### Business logic

A checkout [1] is only a checkout with a string id made of letters, digits, `-` and `_` (the provider may print it as `agentId` or `id`) and a non-empty string path; a branch and a size are kept only as a non-empty string and a number. A branch's state [3] is only a state with a non-empty string branch and boolean `exists`, `pushed` and `merged`; its commits are kept only with a non-empty sha (a missing subject reads as empty), its files only with a non-empty path (missing counts read as zero, a missing binary flag as not binary), its base only as a non-empty string, its remote flag as true only when printed true, and its pending paths only when printed as a list, the strings among them. Anything else is dropped from a list.

### Reads are shared for five seconds

#### Context

**Problem**: see `## Context`.

#### Business logic

Per project, each distinct list (with sizes, or without) and each distinct set of branches asked is read once and the same answer reused for five seconds; reads made while a read is still running wait for it instead of starting another. A read that failed is not kept, so the next read tries again. A publish, a merge or a removal drops everything kept for the project, so the next read sees the change; so does being told the project changed (`provided.ts` says it after any widget command ran there, `../daemon-runtime.ts` after a Start). A caller looking for a checkout that may have just appeared asks the list fresh: the last read is reused only when it is less than one second old, so a reader asking every second for an agent that has no checkout costs one process a second at most.
