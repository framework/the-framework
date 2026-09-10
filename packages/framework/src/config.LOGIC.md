Reads the repo file [1]: the per-repository defaults a project carries in `the-framework.yml` at its root, so that vanilla [2], transparent [3] and the handoff [4] level are decided once for the repository and travel with the code instead of being chosen again at every start. A missing file means no defaults; a broken one is a warning and no defaults, never a failed agent [5].

## Context

**User story**: the user commits `the-framework.yml` with, say, `handoff: merge` or `transparent: true`, and every agent started on that project, from the dashboard or by the daemon, follows it unless the start says otherwise. A typo in the file is reported at the agent's start rather than quietly changing what the repository publishes.

## Glossary

[1] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[2] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[3] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[4] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Which file is read** - `the-framework.yml` at the given directory's root, else `the-framework.yaml`; the first that exists is the only one read.
- **What the file may say** - three keys: `vanilla` and `transparent` as booleans, and `handoff` as one of the four rungs; every other key is ignored.
- **A wrong value is an error, not a guess** - a document that is not a map, a `handoff` that is not a rung name (a leftover `handoff: true` included), or a mode that is not a boolean is refused as a whole.
- **A broken file never fails an agent** - the refusal is reported as a warning starting with "ignoring", and the agent runs as if the file were empty; an empty document is simply no defaults.

## Business logic

### Which file is read

#### Context

See `## Context`.

#### Business logic

The file is looked for in the directory given, which is the agent [5]'s checkout, under two names in precedence order: `the-framework.yml`, then `the-framework.yaml`. The first name that can be read is the file; the other is not consulted, even when the first turns out to be broken. Neither present means no defaults.

### What the file may say

#### Context

**Problem**: a repository's publish level is a fact about the repository: publishing a branch is reversible, landing it on the default branch is not, so `merge` has to be asked for in writing, and is meant for work whose review already happened before the agent, such as what a routine merges after a plan the user could veto.

#### Business logic

The file is a YAML map with up to three keys. `vanilla` (default off) removes the built-in system prompt while keeping the signal protocols. `transparent` (default off) makes every agent [5] in the project the raw coding agent: no system prompt of The Framework's, no signals, no dashboard steering, no backlog loop. `handoff` names how far a finished agent publishes itself, one of `local`, `push`, `pr` or `merge`, with `pr` as the default when the file says nothing (the ladder is `handoff-level.ts`'s). Keys the file may carry beyond these three are ignored. What the file says is one layer of an agent's configuration, and the start's own values beat it (`config-layers.ts`).

### A wrong value is an error, not a guess

#### Context

**Problem**: a handoff level silently ignored would leave the repository publishing more than its file says.

#### Business logic

A document whose top level is not a map (a list, a bare scalar) is refused with "<file> must be a YAML map of settings". A `handoff` value that is not one of the four rung names, a `true` or a misspelling for instance, is refused with "<file>: "handoff" must be one of local | push | pr | merge". A `vanilla` or `transparent` that is not a boolean is refused with "<file>: "<key>" must be a boolean". A refusal discards the whole file, not just the bad key. An empty document, or one with none of the keys, yields no defaults.

### A broken file never fails an agent

#### Context

**User story**: a user who mistyped the file still gets their agent [5]; they see why the file was ignored in the agent's output.

#### Business logic

When the file cannot be parsed or is refused, the reason is passed to the caller's warning channel prefixed with "ignoring " (the agent's process prints it), and the file counts as empty. Reading the file never throws to the agent.
