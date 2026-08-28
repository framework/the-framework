What the tests cover: the daemon coming up, starting agents, steering them, retiring them, and shutting down.

Reading an agent's event log: each pull dispatches only the events appended since the last one; a half-written trailing line is held back until its newline arrives; and a log rewritten from the start by a fresh agent is re-read from the beginning rather than skipped, even when the rewrite happens to be the same length.

The daemon serves the dashboard's page, reports the address it bound to (the only way a caller learns it, since there is no liveness file), and on shutdown frees the port. It comes up in a workspace that has no framework directory yet.

Starting agents on a git project: two agents run concurrently on the same project, each in its own checkout named by its own branch, each containing the repository's content, each on its own `agent-<agent id>` branch — and the user's own checkout is never moved off the branch it was sitting on. A project that cannot be given a worktree keeps the one-at-a-time rule: the first start succeeds, a second while that agent is alive is refused as busy, and once it exits starting works again. Each spawned agent is handed its prompt, the kind of task, and the checkout to work in.

The kinds of start: a research task travels as its own kind, and is allowed an empty subject that the agent itself defaults; a preset the user reviewed in the composer runs verbatim rather than being re-rendered.

Retiring an agent: a finished agent's history is copied into the project, the branch its work ended on is recorded while the checkout still exists, that work reaches the remote, and only then is the checkout removed. A failed agent goes exactly the same way — how the agent ended is not what decides this, whether its work is recoverable is. An agent that committed nothing, whose tip the remote already holds under another agent's branch, has nothing pushed and loses its branch along with its checkout.

Steering: Stop and a choice pick sent from the dashboard land as entries in that project's control channel.

Safety: a start refuses to re-invoke a test entry as the agent, which would otherwise re-run the whole test suite and spawn agents from it endlessly.

Registering the home workspace: an activated workspace is added to the projects list, but one nested inside an already-registered project is not added as a duplicate. Nesting means strictly inside — the same path, a parent path, a sibling tree, and a path that merely shares a name prefix all do not count.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
