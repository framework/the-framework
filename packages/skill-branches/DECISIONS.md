Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The checkout
- One checkout per agent, a git worktree of the user's repository under `.branches/`,
  branched from the project's head unless the caller names a base. Agents run in parallel,
  and the user's own copy is never an agent's workspace. A worktree, not a clone, so every
  checkout shares the repository's objects and refs.
- The repository's own exclude file hides `.branches/` from the project's git, from the
  first checkout on: an untracked folder at the root would ride a sweeping `git add -A`
  onto a code branch, and `.gitignore` is tracked.
- A checkout starts as branch `agent-<id>` in folder `.branches/agent-<id>/`; `<id>` comes
  from the program that starts the agent, and must match `[A-Za-z0-9_-]+`, so no id can
  build a path outside `.branches/`. `npx branches name <name>` (`[a-z0-9-]+`; the skill
  asks for a leading letter or digit, which the code does not check) renames the branch to
  `agent-<name>`: a rename, not a new branch, so nothing is left behind; the folder keeps
  the id, since the agent is running inside it. A checkout on no branch is neither renamed
  nor reclaimed; `status` answers it without a `branch`.
- After a checkout is made, named or removed, each checkout whose branch differs from its
  folder name gets a sibling link `.branches/<branch>` to its folder, relative; a detached
  checkout or a slashed branch gets none. A link whose target is an `agent-*` name,
  `agent-data` aside, is the package's to remove, whatever it is called, and whether or
  not the target exists; anything else at a link's path is left alone. `list` and `prune`
  see directories only, so a link is never a checkout; a session name passes as an id, so
  `remove <name>` follows the link `.branches/agent-<name>` to the checkout.
- No name the package mints holds a `/`: a folder and a link are named after a branch, and
  a cloud session (a hosted agent run, started on a branch) cannot start on a slashed ref.
  The package renames and deletes only `agent-*` branches.
- `agent-data` is `@gemstack/agent-data`'s data branch, checked out as
  `.branches/agent-data` by the program that keeps it, not by this package. Never listed,
  renamed or deleted; `data` is refused as an id, and an agent naming itself `data` gets
  `agent-data-2`; `attach` guards the id only, never the branch it is given.
- A taken name gets `-2`, `-3`, … instead of a refusal: the agent asked for a name and
  reads back the one it got. Taken means any local or remote-tracking branch, so the later
  push cannot land on someone else's branch; the branch the checkout carries right now,
  suffix included, is not counted, so a checkout already on `agent-<name>-2` that asks for
  `<name>` again keeps `-2` while `agent-<name>` is still taken, and takes `agent-<name>`
  once it is free. Two agents naming the same thing at once race on the rename; the loser
  takes the next free suffix, in at most three tries, then `git-failed`.
- Continuing an agent puts it back on the branch its work is on, even one the package did
  not make; a branch gone locally comes back from origin's copy, and one gone everywhere
  is recreated from the project's head: every branch the package deletes held nothing the
  remote lacked.
- The user's installed dependencies are linked into the checkout, not copied or
  reinstalled: one link per entry of the folder, absolute, never one link to the whole
  folder, so an install in the checkout writes into the checkout (a scope like `@acme` is
  one entry, so a scoped install still writes into the user's folder: a known limit).
  Every dependency folder down to two levels under the root (not under `node_modules`,
  `dist`, `build`, `coverage` or a dot-directory) is linked, so a workspace package's own
  dependencies are there too; a tree already in the checkout is left alone. Of the
  dot-entries only `.bin` is linked, so the agent runs the project's tools; the others
  (`.pnpm`, `.modules.yaml`) would tell the package manager the checkout's tree was
  installed there, which it was not. The packages still resolve: a link to a link resolves
  where the target lives.
- Everything after the worktree is best-effort: a checkout missing any of it is a worse
  run, not a failed one.
- `create` or `attach` for an id that already has a checkout fails as `git-failed` with
  git's own error, and so does `create` when the branch exists without one: `attach` is
  the way then. `create` and `attach` each answer the path and the branch; `list` answers
  one row per checkout in directory order: the id, the path, the branch and, asked for,
  the size. Only a directory named `agent-<id>` counts as a checkout.

## Flow: reclaim
Deleting an agent's checkout to free disk, only after the remote has everything in it. It
pushes the branch the checkout ended on, the user's own included, when the caller allows a
push.

- Nothing is committed on the agent's behalf: a checkout with uncommitted work, untracked
  files included, is kept until a person commits or deletes it, and nothing of it is
  pushed.
- An `agent-*` branch whose tip is reachable from another name's remote-tracking ref, on
  any remote, holds nothing of its own (the holds-nothing rule): it goes with its checkout
  without being pushed, deleted with `-D`, since git's own merged test asks the wrong
  question. Its own copy, under its current name or its upstream's, does not count. Pushed
  means on `origin`, the only remote the package pushes to. Both reads take the local
  remote-tracking refs, never a fetch: the push that put a tip there wrote them.
- The caller may name a pushed commit through the library, not from the command line: the
  commit a cloud session pushed on the agent's behalf. A checkout whose tip is an ancestor
  of it goes without a push and keeps its branch, even one the holds-nothing rule would
  delete.
- An agent that switched to another branch leaves `agent-<id>` behind; it goes with the
  checkout once the branch the agent ended on contains it.
- A folder under `.branches/` that git no longer knows as a worktree is left alone, and
  `list` still shows it, without a branch: a git command run inside it would act on the
  user's own checkout.
- A removal git refuses as unclean after the clean check passed is forced, and says so on
  stderr: an ignored build artifact must not strand a checkout for good.
- `remove` and `prune` push by default; `--no-push` opts out. `remove` of a missing
  checkout is a refusal, `no-checkout`; a removal judges the birth branch before anything
  goes, removes the checkout first and the branches after, since git will not delete a
  branch a worktree has out, and names the branches that went with it, absent when none;
  `prune` lists the ids it removed and the checkouts it kept, each with its reason, in its
  result, nothing on stderr but the forced-removal line, and exits 0.
- The package reads no configuration and never asks whether an agent still runs: the
  caller says whether it may push, and may pass a hook that runs just before the checkout
  goes, to stop whatever serves the tree; the command line passes none.

## The skill
- The agent commits and stops: it never pushes, opens a pull request, or merges. Whoever
  started it does that.
- The skill has the agent name its session, saying what the work is, before its first
  change, unless its branch already differs from its folder name, as a continued agent's
  does: it is already named. The agent finishes only when `npx branches status` reports
  the checkout clean, or after saying what remains is not its own; an agent that needs
  anything outside its checkout stops and says so.
- The skill says: when `node_modules` is missing, install with the lockfile's package
  manager, then `npx branches`, never a bare `branches`: on a fresh clone no such command
  exists yet.
- Every command that runs prints one JSON document on stdout: the result or the refusal. A
  refusal (a rule saying no) adds one line for a person on stderr and exits 1. A malformed
  command line (an unknown flag, the wrong argument count) never gets that far: the usage
  on stderr, nothing on stdout, exit 2. An id the charset rejects is a refusal,
  `invalid-id`, not a usage error; one starting with `-` reads as a flag, a usage error,
  unless the arguments follow `--`.
- A command that throws is reported like a refusal, reason `git-failed`, the error's own
  line as `detail` on stdout and on stderr.
- `create`, `attach`, `list`, `remove` and `prune` act on the project, found from the
  `.branches/` layout even from inside a checkout; `name` and `status` act on the checkout
  the command runs in, found from anywhere inside it. `status` also takes the path of a
  checkout root. `status` answers the path, the branch, whether the tree is clean, and
  whether the tip is on the remote.
- The keys: `agentId`, `path`, `branch`, `clean`, `onRemote`, `sizeBytes`, `detail`,
  `removed`, `skipped` (each with `agentId`, `reason`, and the person's line as `detail`),
  `branchesDeleted`.
- `list` answers with a bare JSON array; every other result and every refusal is an object
  whose `ok` tells the two apart.
- Outside a repository, a command that needs one refuses with `not-a-repo`: only git's own
  "not a git repository" reads as that; every other failure stays `git-failed`. An id is
  checked before the repository, a name after it, and `status <path>` skips the repository
  check, so outside one it answers `not-a-worktree`.
- A refusal names its subject: `invalid-id` and `no-checkout` the id, `status`'s
  `not-a-worktree` the path, `dirty` and `not-on-remote` the branch, `not-on-remote` also
  git's reason when a push was tried; `name`'s refusals, `not-a-repo`, and
  `not-a-worktree` and `no-branch` from `remove`, carry the reason alone. The refusals:
  `invalid-id`, `invalid-name`, `not-a-worktree`, `no-branch`, `not-an-agent-branch`,
  `no-checkout`, `dirty`, `not-on-remote`, `not-a-repo`, `git-failed`.
- The skill tells the agent where it is: on `agent-*` the checkout is its whole workspace,
  and the dependency files and skill folders in it are links to the user's copies, never
  edited; on any other branch under `.branches/` it was continued on that branch on
  purpose and stays; anywhere else it is a plain clone, and the agent makes its
  `agent-<name>` branch with git before its first change, another name if that one exists
  locally or on origin. `status` and `name` are the agent's commands; the rest are the
  caller's.
- Each agent tool (Claude Code, Codex) looks for skills in its own folder at the checkout
  root: `.claude/skills`, `.agents/skills`. In every checkout it makes, the package links
  its own folder, which holds `SKILL.md`, into both as `branches`, hidden through the
  repository's exclude, whose entry also hides an untracked project file at that path. An
  entry already there, a committed skill say, is left alone. A caller may name further
  skills to link in beside it, each under its own name, not from the command line;
  temporary, until the project commits its own skill files.
