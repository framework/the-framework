Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The checkout
- One checkout per agent, a git worktree of the user's repository under `.branches/`,
  branched from the project checkout's head unless the caller names a base: agents run in
  parallel, and the user's own copy is never an agent's workspace. A worktree, not a
  clone, so every checkout shares the repository's objects and refs.
- `.branches/` is hidden from the project's git from the first checkout on, through the
  repository's own exclude file: an untracked folder at the root would ride a sweeping
  `git add -A` onto a code branch, and `.gitignore` is tracked.
- A checkout starts as branch `agent-<id>` in folder `.branches/agent-<id>/`; `<id>` is
  what the program that starts the agent calls it, restricted to `[A-Za-z0-9_-]+` so no id
  can build a path outside `.branches/`. `npx branches name <name>` (`[a-z0-9-]+`) renames
  the branch to `agent-<name>`: a rename, not a new branch, so nothing is left behind; the
  folder keeps the id, since the agent is running inside it. A checkout on no branch is
  neither renamed nor reclaimed.
- When the package runs (a checkout made, named or removed), each checkout whose branch
  differs from its folder name gets a link named as the branch beside the folder, so
  `.branches/<branch>` reaches every checkout by its current branch; a detached checkout
  or a slashed branch gets none. The package makes and removes the links, never replacing
  anything else at that path. `list` and `prune` see directories only, so a link is never
  a checkout.
- Branch names are `agent-<name>` with no `/`: the folder and the link are named after the
  branch, a name on disk cannot hold a slash, and a slashed ref cannot be handed to a
  cloud session as its starting revision. The package renames and deletes only `agent-*`
  branches; the user's own are never touched.
- `agent-data` is not an agent's: it is the data branch of `@gemstack/agent-data`, checked
  out beside the agents' as `.branches/agent-data` by the program that keeps that branch,
  not by this package. Never listed, renamed or deleted; `data` is refused as an id, and
  an agent naming itself `data` gets `agent-data-2`.
- A taken name gets `-2`, `-3`, … instead of a refusal: the agent asked for a name and
  reads back the one it got. Taken means any local or remote-tracking branch, so the later
  push cannot land on someone else's branch; the checkout's own branch is not counted, so
  asking again for its name changes nothing. Two agents naming the same thing at once race
  on the rename; the loser takes the next suffix.
- Continuing an agent puts it back on the branch its work is on; a branch gone locally
  comes back from origin's copy, and one gone everywhere is recreated from the project's
  head, since the only branch the package deletes held nothing past what the remote
  already had.
- The user's installed dependencies are linked into the checkout, not copied or
  reinstalled: one link per entry of the folder, never one link to the whole folder, so an
  install in the checkout writes into the checkout (a scope like `@acme` is one entry, a
  link into the user's folder, so a scoped install still writes there: a known limit).
  Every dependency folder down to two levels under the root (not under `dist`, `build`,
  `coverage` or a dot-directory) is linked, so a workspace package's own dependencies are
  there too. Of the dot-entries only `.bin` is linked: the
  agent runs the project's tools, and the package manager's own state (`.pnpm`,
  `.modules.yaml`) says the tree was installed there, which the checkout's was not; the
  packages still resolve: a link to a link resolves where the target lives.
- Everything after the worktree itself (the dependency links, the skill links, the exclude
  rule, the branch links) is best-effort: a checkout without them is a worse run, not a
  failed one.

## Flow: reclaim
Deleting an agent's checkout to free the disk, only once everything in it is on the
remote, so nothing can be lost; the reclaim pushes the branch the checkout ended on, the
user's own included, when the program allows a push, and deletes only `agent-*` branches.

- Nothing is committed on the agent's behalf: a checkout with uncommitted work is kept
  until a person commits or deletes it.
- An `agent-*` branch whose commits already reached the remote through another branch
  (after a merge) holds nothing of its own and goes with its checkout; its own remote
  copy, under its current name or the name it was pushed as, does not count. "On the
  remote" is read from the local remote-tracking refs, without a fetch: the push that put
  it there wrote them.
- A checkout whose tip is an ancestor of a pushed commit the program names (the commit a
  cloud session pushed on the agent's behalf) goes without a push and keeps its branch,
  even one the merged-branch rule would delete.
- An agent that switched to another branch leaves `agent-<id>` behind; it goes with the
  checkout once the branch the agent ended on contains it.
- A folder under `.branches/` that git no longer knows as a worktree is left alone: a git
  command run inside it would act on the user's own checkout.
- A removal git refuses as unclean after the clean check passed is forced, and says so on
  stderr: an ignored build artifact must not strand a checkout for good.
- `remove` and `prune` push by default; `--no-push` opts out. `remove` of a missing
  checkout is a refusal, `no-checkout`; `prune` lists the checkouts it kept in its result
  and exits 0.
- The package does git and the filesystem only: whether it may push comes in from the
  caller; the package never reads the caller's files.

## The skill
- The agent commits and stops: it never pushes, opens a pull request, or merges. Whoever
  started it does that.
- The skill has the agent name its session before its first change and finish only when
  `npx branches status` reports the checkout clean; an agent that needs anything outside
  its checkout stops and says so.
- The skill says `npm install`, then `npx branches`, never a bare `branches`: on a fresh
  clone no such command exists yet.
- One JSON document on stdout for every command that runs: the result or the refusal. A
  refusal (a rule saying no) adds one line for a person on stderr and exits 1. A malformed
  command line (an unknown flag, the wrong argument count) never gets that far: the usage
  on stderr, nothing on stdout, exit 2. An id the charset rejects is a refusal,
  `invalid-id`, not a usage error.
- A command that throws is reported like a refusal, reason `git-failed`, with the error's
  own line on stderr.
- `list` answers with a bare JSON array; every other result and every refusal is an object
  whose `ok` tells the two apart.
- Run outside a repository, a command that needs one refuses with `not-a-repo`: only git's own "not a git
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
