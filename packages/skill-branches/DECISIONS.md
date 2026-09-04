Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The checkout
- One checkout per agent, a git worktree of the user's repository under `.branches/`:
  agents run in parallel, and the user's own copy is never an agent's workspace. A
  worktree, not a clone, so every checkout shares the repository's objects and refs.
- `.branches/` is hidden from the project's git from the first checkout on, through the
  repository's own exclude file, never `.gitignore`: an untracked folder at the root would
  ride a sweeping `git add -A` onto a code branch, and no tracked file may change.
- A checkout starts as branch `agent-<id>` in folder `.branches/agent-<id>/`; `<id>` is
  what the program that starts the agent calls it, restricted to `[A-Za-z0-9_-]+` so no id
  can build a path outside `.branches/`. `npx branches name <name>` renames the branch to
  `agent-<name>`: a rename, not a new branch, so nothing is left behind; the folder keeps
  the id, since the agent is running inside it.
- After a rename, a link named as the new branch is put beside the folder, so
  `.branches/agent-<name>` reaches every checkout by its current branch; the package makes
  and removes it.
- Branch names are `agent-<name>` with no `/`: the folder and the link are named after the
  branch, a name on disk cannot hold a slash, and a slashed ref cannot be handed to a
  hosted run as its starting revision. The package renames and deletes only `agent-*`
  branches; the user's own are never touched.
- `agent-data` is not an agent's: it is the data branch of `@gemstack/agent-data`, checked
  out beside the agents' as `.branches/agent-data`. Never listed, renamed or deleted;
  `data` is refused as an id, and an agent naming itself `data` gets `agent-data-2`.
- A taken name gets `-2`, `-3`, … instead of a refusal: the agent asked for a name and
  reads back the one it got. Taken means any local or remote-tracking branch, so the later
  push cannot land on someone else's branch; never the checkout's own, so asking again for
  its own name changes nothing. Two agents naming the same thing at once race on the
  rename; the loser takes the next suffix.
- Continuing an agent puts it back on the branch its work is on; a branch that is gone is
  recreated from the project's head, since the only branch the package deletes held
  nothing past what the remote already had.
- The user's installed dependencies are linked into the checkout, not copied or
  reinstalled: one link per entry of the folder, never one link to the whole folder, so an
  install in the checkout writes into the checkout (a scope like `@acme` is one entry, so
  a scoped install still reaches the user's folder). Every dependency folder down to two
  levels under the root is linked, so a workspace package's own dependencies are there
  too. Of the dot-entries only `.bin` is linked: the agent runs the project's tools, and
  the package manager's own state (`.pnpm`, `.modules.yaml`) says the tree was installed
  there, which the checkout's was not; the packages resolve without it, a link to a link
  resolving where the target lives.

## Flow: reclaim
Deleting an agent's checkout to free the disk, only once everything in it is on the
remote, so nothing can be lost; the reclaim pushes the branch itself when the program
allows a push.

- Nothing is committed on the agent's behalf: a checkout with uncommitted work is kept
  until a person commits or deletes it.
- An `agent-*` branch whose commits already reached the remote through another branch
  (after a merge) holds nothing of its own and goes with its checkout.
- A checkout whose tip is inside a pushed commit the program names (the commit a cloud
  session pushed on the agent's behalf) goes without a push and keeps its branch.
- An agent that switched to another branch leaves `agent-<id>` behind; it goes with the
  checkout once the branch the agent ended on contains it.
- A folder under `.branches/` that git no longer knows as a worktree is left alone: git
  run inside it would act on the user's own checkout.
- The package does git and the filesystem, nothing else: whether it may push, and the
  like, the program using it passes in; the package never reads that program's files.

## The skill
- The agent commits and stops: it never pushes, opens a pull request, or merges. Whoever
  started it does that.
- The skill says `npm install`, then `npx branches`, never a bare `branches`: on a fresh
  clone no such command exists yet.
- One JSON document on stdout for every command that runs: the result or the refusal. A
  refusal (a rule saying no) adds one line for a person on stderr and exits 1. A malformed
  command line (an unknown flag, the wrong argument count) never gets that far: the usage
  on stderr, nothing on stdout, exit 2. An id that parses but is not an agent id is an
  ordinary refusal, `invalid-id`.
- Anything a command throws is reported like a refusal, reason `git-failed`, the error's
  own line on stderr: a caller parsing stdout never meets a command that printed nothing.
- `list` answers with a bare JSON array when it runs; every other result, and every
  refusal, is an object whose `ok` tells the two apart.
- Run outside a repository, a command refuses with `not-a-repo`: only git's own "not a git
  repository" reads as that, every other git failure stays `git-failed`.
- An agent reading the skill is in one of two places: a checkout the program that started
  it made, already on an `agent-*` branch; or a plain clone, on `main` or someone's
  branch. The skill tells them apart by the branch name alone: on `agent-*` the checkout
  is the agent's; on anything else the agent makes its own `agent-<name>` branch with git
  before its first change.
- Each agent tool (Claude Code, Codex) looks for skills in its own folder at the checkout
  root: `.claude/skills`, `.agents/skills`. The package links its own folder, where
  `SKILL.md` sits, into each as `branches` in every checkout it makes, hidden from git. A
  caller may name further skills to link in beside it, each under its own name: temporary,
  until the project commits its own skill files.
