Turns the registry's project list into what the dashboard shows in its project sidebar, and resolves a project's id to its repo path so every per-project read runs against the right repo. One daemon serves every registered project.

## Business logic — TL;DR

- **Project summary** - each project is described by its display name (the repo folder's name), whether it is still activated, when it was last active, and the run defaults its `the-framework.yml` commits.
- **Fresh on every read** - the committed config is re-read each time a project is summarized, so an edit to `the-framework.yml` shows up immediately.
- **A broken project still lists** - any read that fails degrades to "not activated, no activity, no committed config" instead of failing the sidebar.
- **Complete versus partial** - a cross-project list also reports which projects it could actually read, so a caller can tell "this project has nothing" apart from "this project could not be read".

## Business logic

### Project summary

#### User story

The user registers several repos and wants the sidebar to show, per project: its name, whether The Framework is still installed in it, when something last happened there, and what an agent launched there will default to.

#### Business logic

A project's display name is the last segment of its repo path. It counts as activated while the repo still carries The Framework's marker directory. Its last activity is the most recent timestamp across all its agents, live and archived alike. Its committed run defaults come from the repo's own `the-framework.yml`, read fresh on every summary; a project that commits nothing, or whose file is malformed, simply carries no defaults rather than erroring. Every one of these reads is forgiving: a failure reads as an inactive project with no activity.

#### Rationale

Last activity is taken from the agents themselves. It used to also consider a committed markdown log that re-narrated the same agents, which by construction could only ever be older than the agent it described.

### Complete versus partial

#### User story

A background job that announces new items (for example a notification) must not re-announce everything the moment one project becomes temporarily unreadable, nor stay silent forever about a project it never managed to read.

#### Business logic

A cross-project list returns both what was found and the ids of the projects whose sources all answered. A project that could not be read contributes no items — indistinguishable, on its own, from a project that genuinely has nothing — so the list of fully read projects is what tells the two apart. Only callers that keep a baseline of what they have already announced need this; panels that just render the list ignore it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
