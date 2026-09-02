Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The checkout
- One checkout per agent, under `.branches/`, named as its branch: agents run in
  parallel, and the user's own checkout is never an agent's workspace.
- A checkout starts as branch `agent-<id>` in folder `.branches/agent-<id>/`. When the
  agent names itself, the branch is renamed to `agent-<name>`; the folder keeps the id.
  A rename, not a new branch, so no empty branch is left behind. The folder is not
  renamed, because the agent is running inside it.
- Branch names are `agent-<name>`, with no `/`: the folder is named after the branch,
  and a folder name cannot hold a slash. The package renames and deletes only `agent-*`
  branches; the user's own branches are never touched.
- A taken name gets `-2`, `-3`, … instead of a refusal: the agent asked for a name and
  reads back the one it got.
- The user's installed dependencies are linked into the checkout, one link per package,
  not copied and not reinstalled: instant and free. One link per package, not one link
  to the whole folder, so a package the agent installs lands in its own checkout.

## Flow: reclaim
Deleting an agent's checkout to free the disk. It goes only once everything in it is
pushed, so deleting it can lose nothing.

- Nothing is committed on the agent's behalf: a checkout with uncommitted work is kept
  until a person commits or deletes it.
- An `agent-*` branch whose commits are already on the remote under another name, as
  after a merge, is deleted with its checkout.
- The package only does git. Anything else it needs to know, like whether it may push, the
  program using it passes in; the package never reads that program's files.

## The skill
- The agent commits and stops: it never pushes, opens a pull request, or merges. Whoever
  started it does that.
- The command runs as `npx branches` after the repository's dependencies are installed,
  so it runs the same from a fresh clone and from a checkout made for the agent.
- An agent reading the skill can be in one of two places: inside a checkout the program
  that started it made for it, already on an `agent-*` branch; or in a plain clone of the
  repository, on `main` or on someone's branch. The skill tells them apart by the branch
  name alone: on `agent-*`, the checkout is the agent's; on anything else, the agent makes
  its own `agent-<name>` branch with git before its first change.
- The skill is linked into every checkout the package makes, where each harness looks for
  skills (`.claude/skills`, `.agents/skills`), hidden from git. Temporary, until skills are
  committed into the repository.
