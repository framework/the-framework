How The Framework reads a project's pull requests and acts on them: through the git host provider [1], a command one of the project's own packages declares, never through a git host's own tool and never through a package The Framework knows. It also owns the shape of what that command answers: a pull request [2], and the project's page on the git host [3].

## Context

**User story**:
- The user opens a pull request for an ended agent's branch ("Open PR") or merges the one it has ("Merge PR"); the dashboard finds the pull requests a project has. A project on GitHub has the GitHub package installed; a project on another git host installs that git host's package instead, and nothing in The Framework changes.
- A project none of whose packages provides a git host has no pull requests: nothing is opened or landed for it, and an ended agent's last step is the push. The answer is "no git host", never an error.

**Business logic story**: The Framework names no git host. A project picks the package that speaks to its git host by listing it as a dependency; that package says, in its own package.json, which of its commands answers for the git host. The branches provider (`branches.ts`) pushes; this provider opens and lands. Opening a pull request from the dashboard is the two composed: the push, then the open (`../dashboard/agent-handoff.ts`).

**Problem**: "the branch has no pull request" and "the git host could not be asked" are different answers, and a caller that takes the second for the first opens a second pull request or announces every open one as new.

## Glossary

[1] git host provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's git host, in its own package.json under `"framework": { "git-host": "<command>" }` (the `github` skill's package declares its `github` command); it lists the project's pull requests, opens one, lands one, and names the project's page on the git host (`store/git-host.ts`).
[2] pull request: as the provider answers it: its number, its link, its state (`open`, `merged` or `closed`), its title, whether it is a draft, the branch it is from, the commit its head is at, when it was created and, for a merged one, when it merged.
[3] the project's page on the git host: a link to the project where its pull requests live, and the git host's name, for the dashboard to draw a link from without naming any git host itself.

## Business logic — TL;DR

- **Which command provides** - the shared library's rule: the one dependency that declares a git host provider [1] naming one of its own commands, or, when several declare it, the one the project's own package.json names; no dependency declares one, the project has no git host.
- **The command line it answers** - the project's pull requests (all, one branch's, by state, since a time), the opening of a branch's pull request, the landing of one, and the project's page on the git host.
- **The shapes** - a pull request is kept only with a number, a link and a known state, its other fields as printed or empty; a page only with a link and a name; an opened pull request only with its number and link.
- **"None" and "could not tell" are kept apart** - a listing the provider refuses answers with its reason, never as an empty list.
- **The provider is looked up again every five seconds** - so a project that installs, swaps or drops its git host package is read the new way within five seconds; being told the project changed forgets it at once.

## Business logic

### Which command provides

#### Context

See `## Context`.

#### Business logic

The provider is found by the shared library's rule (`agent-data`'s `provided-command.ts`): among the project's installed dependencies, the one whose own package.json declares `"framework": { "git-host": "<command>" }`, where `<command>` is one of that package's own commands, is the git host provider [1]; a declaration naming a command the package does not have is skipped. When two or more declare it, the one the project's own package.json names under the same key provides, and with no such line none does (the daemon says why in the project's error banner). No package.json, no installed dependency, or no declaration: the project has no git host, and every ask below answers nothing.

### The command line it answers

#### Context

**Business logic story**: the command is the same one an agent runs to open its own pull request; The Framework uses the forms a person's click and the dashboard's reads need.

#### Business logic

The provider's command runs with Node, in the project's root, never through a shell, for at most 30 seconds and 16 MB of output. Each call prints one JSON document and exits 0; a refusal exits 1 with its reason on its last line of error output, which is the answer given back:
- `<command> requests`, with `--branch <branch>` for one branch's, `--state open|merged|all` for a state, `--since <time>` for the ones since a time, in any combination: the project's pull requests [2], newest first, as an array. A refusal is answered as the refusal's line, not as an empty list.
- `<command> open --branch <branch> --title <title> [--body <body>] [--draft]`: open the branch's pull request, as a draft when asked; a branch that already has an open pull request is answered with that one. The answer is the pull request's number and link, and whether it was open already; an answer with no pull request is a failure ("<command> opened no pull request"). The branch must already be on the remote: the push is the branches provider's step, and The Framework runs it first.
- `<command> merge <number>`: land the pull request: armed to merge when its checks pass, merged at once, or the provider watching its checks; any other answer is a failure ("<command> did not merge"), a refusal in the provider's words.
- `<command> home`: the project's page on the git host [3], its link and the git host's name; a refusal, or an answer without both, is nothing.

### The shapes

#### Context

See `## Context`.

#### Business logic

A pull request [2] is only a pull request with a number, a string link and a state that is exactly `open`, `merged` or `closed`; its title, branch and head are kept as printed or read as empty, its draft flag as true only when printed true, its creation time as printed or empty, and its merge time only when printed. Anything else is dropped from a list, and an answer that is not a list is no pull requests. An opened pull request is read only with a number and a link. The project's page is read only with both a link and a name.

### The provider is looked up again every five seconds

#### Context

**Problem**: the dashboard asks for the git host on every handoff read, and looking a provider up reads the project's package files each time.

#### Business logic

Per project, the provider found is kept for five seconds and asked again after; when the same command still provides, the same source is kept. Being told the project changed (`provided.ts` says it after any widget command ran there) forgets the project at once, so the next ask looks its provider up again. Each read and each action is one run of the command: nothing a provider answers is cached here.
