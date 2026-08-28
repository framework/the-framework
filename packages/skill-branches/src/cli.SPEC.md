The package's command line: the same operations a daemon calls, for an agent (or a person) in a shell inside a project — so an agent names its session, checks its tree and reclaims checkouts through the one implementation the daemon uses, and a second surface is never a second behaviour.

## User story

- An agent, started inside its own checkout, names its session and learns the branch name it got.
- An agent checks, before it finishes, that it has left nothing uncommitted.
- The user, in a terminal, lists and reclaims the checkouts under a project without opening the dashboard.

## Glossary

- **refusal** - a rule saying no to a command: a dirty tree that may not be removed, a name that is not a session name, a directory that is not a checkout. Not a failure: the command ran, and the answer is "not this one".

## Business logic — TL;DR

- **Seven commands over the package** - `create`, `attach`, `name`, `status`, `list`, `remove`, `prune`; each is the corresponding package operation and nothing more.
- **JSON out, a reason for a person, an exit code that says which** - every result is one JSON document on stdout; a refusal or a git failure also puts one line on stderr and exits 1; a command that cannot be read gets the usage on stderr and exits 2.
- **The project is found from where the command runs** - commands acting on the project find it by the checkout layout, from anywhere inside it, an agent's checkout included; commands acting on a checkout act on the one they run in.
- **What the package does not know is not decided here** - whether an agent is still running is not read; whether its branch may be pushed is `--no-push`, the caller's fact.

## Business logic

### Seven commands over the package

#### User story

See `## User story`.

#### Business logic

- `create <id> [--base <ref>]` - a checkout for the agent, on a fresh `agent-<id>` branch from the stated base or the project's current head; `.branches/` is hidden from the project's git, the parent checkout's dependency directories are linked in and the `.branches/` links are refreshed. Reports the checkout's path and branch.
- `attach <id> <branch>` - a checkout for a continued agent on an existing branch, with the same linking. An id that is not path-safe is refused by both, before git runs.
- `name <name>` - renames the branch of the checkout the command runs in to `agent-<name>`, refreshes the `.branches/` links, and reports the name the branch ended up with — suffixed when the wanted one was taken. Refused for a name that is not `[a-z0-9-]+`, and for a checkout on a branch the package did not mint, so the user's own branch is never renamed. The rules are the checkout lifecycle's (`worktree`).
- `status [path]` - the branch, whether the tree is clean, and whether the branch tip is on the remote, for the checkout the command runs in or the one at the stated path. A path that is not a checkout of its own is refused.
- `list [--sizes]` - every agent checkout under `.branches/`: the agent id, the path, the branch it is on now, and, on request, its size on disk.
- `remove <id> [--no-push]` - reclaims one agent's checkout under the reclaim rule (`reclaim`): a dirty tree is kept, the branch is pushed unless `--no-push`, the checkout goes only once the remote has it, and a branch that holds nothing goes with it. The `.branches/` links are refreshed afterwards, so a link named after a branch that just went is dropped. An id that is not path-safe is refused before anything is looked up; an id with no checkout is refused as such.
- `prune [--no-push]` - `remove` for every checkout, with the links refreshed once at the end rather than after each; reports which were removed and, for each kept, the reason. Exits 0: a checkout kept under the rule is the rule working, not a refusal of the command.

### JSON out, a reason for a person, an exit code that says which

#### User story

An agent parses what it is told; a person reads it; a script branches on the exit code.

#### Business logic

Every command writes exactly one JSON document to stdout. A result is the operation's outcome. A refusal is `{ ok: false, reason }` — the reason a short fixed word (`dirty`, `not-on-remote`, `invalid-name`, `not-an-agent-branch`, `not-a-worktree`, `no-checkout`, `invalid-id`, `not-a-repo`, …) plus what identifies the case (the branch, the path, the id) — and one sentence on stderr says the same for a person; the exit code is 1. A git failure past the decision is reported the same way, reason `git-failed`, with git's own line. A command that cannot be read — unknown command, an argument missing or extra, an unknown option — gets the usage on stderr, no JSON, and exit code 2.

### The project is found from where the command runs

#### User story

An agent runs the commands from inside its own checkout, from whichever subdirectory it happens to be in.

#### Business logic

`create`, `attach`, `list`, `remove` and `prune` act on the project: the checkout whose `.branches/` the working directory is under, else the checkout the working directory is in (the checkout lifecycle's rule, `worktree`). So the same command names the same project from the project's own checkout and from any agent checkout under it — including when the project is itself a linked worktree of some other repository. `name` and `status` act on a checkout: the root of the one the working directory is in, or, for `status`, the directory named on the command line. Outside any repository every command that looks for the project or the checkout is refused as `not-a-repo` rather than failing on git — only git's own "not a repository" reads as that; a timeout or a broken git stays the failure it is. `status <path>` answers about the named directory, which outside a repository is simply not a checkout.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
