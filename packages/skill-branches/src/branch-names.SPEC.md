The naming rules for everything the package mints in git, and the layout they imply on disk under `.branches/`, the directory at a project's root where every checkout lives (the `@gemstack/agent-data` package's convention) — and the charset an agent id may use, so no id can build a path outside that directory — kept in one place so every surface names branches identically. Every branch the package mints starts with `agent-` — slash-free on purpose: a `/` in a ref name never resolves as a cloud session's revision, and slash-free names are what let each checkout directory under `.branches/` be named exactly as its branch. An agent's checkout is created on `agent-<agent id>` — from the agent id, because the id exists before the session name does — and the branch is renamed to `agent-<session name>` once the agent picks a name. The session name is read off the branch, never recorded beside it: `agent-<session name>` minus the prefix. A branch carries no name while it is still the one the checkout was created on — the agent is unnamed until it renames its branch — and neither does a branch the package did not mint.

The same rules answer the filesystem questions around `.branches/`: an agent's checkout directory carries the name of the branch it was created on, so the flat listing reads as branch names, and the agent id is recoverable from a directory name.

They also answer which branches the package may ever rename or delete on its own: those it minted for an agent, `agent-<agent id>` or `agent-<session name>`. A branch of the user's own is out of scope by name alone, so no cleanup can reach it however empty it looks.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
