Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The checkout
- One checkout per agent: a git worktree under `.branches/`, named as its branch. Agents
  run in parallel, so each gets its own copy; the user's own checkout is never an agent's
  workspace.
- The checkout is born on the branch `agent-<id>`, and its directory keeps that name for
  life. Naming the session renames the branch, never the directory, and never makes a new
  branch: a rename leaves nothing behind to clean up.
- Every branch this package makes starts with `agent-` and has no `/` in it: a slash-free
  name is what lets the directory be named exactly as the branch. Only `agent-*` branches
  are ever renamed or deleted; the user's own branches are out of reach by name.
- A taken name gets `-2`, `-3`, … instead of a refusal: the agent asked for a name and
  reads back the one it got.
- The parent checkout's installed dependencies are linked into the new checkout, not copied
  and not reinstalled: a directory of links per dependency directory, so an install inside
  the checkout writes into the checkout.

## Flow: reclaim
A checkout goes only once everything it holds is on the remote.

- Nothing is committed on the agent's behalf: a checkout with uncommitted work is kept
  until a person commits or deletes it.
- A clean checkout whose commits the remote already has goes without a push; an `agent-*`
  branch that holds nothing new is deleted with its checkout.
- Whether a push is allowed is the caller's decision, passed in. The package never reads
  an agent's record; what it cannot see, it is told.

## The skill
- The agent never publishes itself: whoever started it pushes, opens the pull request,
  merges.
- The command runs as `npx branches` after the repository's dependencies are installed,
  so it runs the same from a fresh clone and from a checkout made for the agent.
- Where it is, the agent reads off its branch: `agent-*` means a checkout was made for it;
  anything else means a plain clone, where it makes its own `agent-<name>` branch with git.
- The skill is linked into every checkout the package makes, where each harness looks for
  skills (`.claude/skills`, `.agents/skills`), hidden from git. Temporary, until skills are
  committed into the repository.
