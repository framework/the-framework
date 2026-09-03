Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The checkout
- One checkout per agent: a git worktree of the user's repository under `.branches/`, in a
  folder named after the agent's branch. A worktree, not a clone, so every checkout
  shares the repository's objects and refs. Agents run in parallel, and the user's own
  copy is never an agent's workspace.
- A checkout starts as branch `agent-<id>` in folder `.branches/agent-<id>/`, `<id>` being
  what the program that starts the agent calls it. When the agent names itself, through
  the command (`npx branches name <name>`), the branch is renamed to `agent-<name>`; the
  folder keeps the id. A rename, not a new branch, so no empty branch is left behind. The
  folder is not renamed, because the agent is running inside it.
- After a rename, a link named as the new branch is put beside the folder, so
  `.branches/agent-<name>` reaches every checkout by its current branch; the package makes
  the link and removes it when the checkout goes.
- Branch names are `agent-<name>`, with no `/`: the folder is named after the branch,
  and a folder name cannot hold a slash. The package renames and deletes only `agent-*`
  branches; the user's own branches are never touched.
- `agent-data` is not an agent's: it is the data branch of `@gemstack/agent-data`, checked
  out beside the agent checkouts as `.branches/agent-data`. The package never lists,
  renames or deletes it, `data` is refused as an agent id, and an agent naming itself
  `data` gets `agent-data-2`.
- A taken name gets `-2`, `-3`, … instead of a refusal: the agent asked for a name and
  reads back the one it got. Two agents naming the same thing at once race on the rename;
  the loser takes the next suffix.
- The user's installed dependencies are linked into the checkout, not copied and not
  reinstalled. One link per package, not one link to the whole folder, so a package the
  agent installs lands in its own checkout.

## Flow: reclaim
Deleting an agent's checkout to free the disk. It goes only once everything in it is on
the remote, so deleting it can lose nothing; the reclaim pushes the branch itself when the
program allows a push.

- Nothing is committed on the agent's behalf: a checkout with uncommitted work is kept
  until a person commits or deletes it.
- An `agent-*` branch whose commits have already reached the remote through another branch,
  as after a merge, holds nothing of its own and is deleted with its checkout.
- The package only does git. Anything else it needs to know, like whether it may push, the
  program using it passes in; the package never reads that program's files.

## The skill
- The agent commits and stops: it never pushes, opens a pull request, or merges. Whoever
  started it does that.
- The skill says `npm install`, then `npx branches`, never a bare `branches`: on a fresh
  clone no such command exists yet.
- An agent reading the skill can be in one of two places: inside a checkout the program
  that started it made for it, already on an `agent-*` branch; or in a plain clone of the
  repository, on `main` or on someone's branch. The skill tells them apart by the branch
  name alone: on `agent-*`, the checkout is the agent's; on anything else, the agent makes
  its own `agent-<name>` branch with git before its first change.
- Each agent tool (Claude Code, Codex) looks for skills in its own folder at the root of
  the checkout: `.claude/skills`, `.agents/skills`. The package links its own folder, where
  `SKILL.md` sits, into each of those as `branches` in every checkout it makes, and hides
  the links from git. Temporary, until the project commits the skill files itself.
