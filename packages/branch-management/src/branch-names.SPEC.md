The naming rules for everything The Framework mints in git, and the layout they imply on disk — the `.the-framework` directory at a project's root, the `branches` directory under it where every checkout lives, and the charset an agent id may use, so no id can build a path outside that directory — kept in one place so every surface names branches identically. Every framework-minted branch starts with `tf-` — slash-free on purpose: a `/` in a ref name never resolves as a cloud session's revision, and slash-free names are what let each checkout directory under `.the-framework/branches/` be named exactly as its branch. The data branch is `tf-data`. An agent branch is born `tf-agent-<agent id>` — created from the agent id because the id exists before the session name does — and renamed to `tf-<session name>` once the agent picks a name.

The same rules answer the filesystem questions around `.the-framework/branches/`: an agent's worktree directory carries its birth branch's name, so the flat listing reads as branch names; the agent id is recoverable from a directory name (a name without the minted prefix is a legacy layout's bare agent id, returned as-is so old checkouts stay addressable); and only names in the minted `tf-agent-` spelling count as framework checkouts, since the same directory also holds the rename links and possibly a user's own entries.

They also answer which branches The Framework may ever delete on its own: those it minted for an agent — the `tf-agent-<agent id>` spelling, a session-named `tf-<session name>`, or the retired slashed form — and never the data branch, which shares the prefix but is not an agent's. A branch of the user's own is out of scope by name alone, so no cleanup can reach it however empty it looks.

The retired `the-framework/` prefix is never minted anymore, but branches under it still exist on remotes and in archives, so classifiers and sweeps keep recognizing that spelling until those die out. It is never used to create anything.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
