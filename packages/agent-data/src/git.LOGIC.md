Runs git for the whole product: one runner executes `git` in a directory, resolves its output, fails on a non-zero exit, and gives every invocation a time budget chosen by its subcommand, so a hung git never holds the daemon for long and a push killed on its budget is never mistaken for a push git rejected. It also fixes the two readings of a failed invocation every caller wants: whether it was a timeout, and which line is worth showing.

## Context

**User story**: the dashboard stays responsive and the daemon keeps starting agents [1] on a large repository: a `git worktree add` that writes every tracked file, or a `git push` that uploads a packfile, gets the minutes it needs, while a stuck read fails within seconds instead of freezing a sweep [2]; when a push fails, the user sees git's own reason ("fatal: …") rather than an echoed command line.

**Problem**: one flat budget for every git call is wrong in both directions. A read that hangs holds its caller for the whole budget, so the budget must stay short; a whole-checkout [3] write or an upload killed on a short budget may have half happened, so those must get far longer.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".

## Business logic — TL;DR

- **A time budget per subcommand** - reads get 10 seconds, local mutations 30 seconds, and the network or a whole checkout 120 seconds; the subcommand decides, whatever global options precede it.
- **A timeout is its own kind of failure** - a git killed for outrunning its budget fails as a timeout, recognizable across packages, distinct from a git that rejected the operation.
- **The line worth showing** - a failed invocation is summarized by git's own `fatal:`, `error:` or `remote:` line, else its first line, else "git failed".
- **Inside a repository, and where its checkout starts** - whether a directory is inside a git working tree, answered "no" whenever git cannot say, and the root of the checkout a directory is in.
- **Pushing a branch to origin** - one push that sets the branch's upstream, whose failure is reported as git's reason rather than thrown.

## Business logic

### A time budget per subcommand

#### Context

See `## Context`.

#### Business logic

Every invocation runs under a budget chosen from its subcommand:

- Reads get 10 seconds: `branch` in its listing and query forms, `cat-file`, `diff`, `for-each-ref`, `log`, `ls-files`, `merge-base`, `remote`, `rev-list`, `rev-parse`, `show`, `show-ref`, `status`, `symbolic-ref`, and `worktree list`.
- The network and a whole checkout [3] get 120 seconds: `clone`, `fetch`, `pull`, `push`, `ls-remote`, and `worktree add`.
- Every other subcommand is a local mutation and gets 30 seconds, `worktree remove` and `worktree prune` among them, and so does any subcommand the runner does not know: an unknown operation is treated as a mutation, never as slow.
- `branch` reads when it is bare, or when every flag it carries lists or queries (`--list`, `--contains`, `--no-contains`, `--merged`, `--no-merged`, `--points-at`, `--show-current`, `--remotes`, `--all`, `--verbose`, `--format=…`, and their short forms); a `-D`, a `-m`, any other flag, or the `branch <new> [start]` form writes a ref and gets the mutation budget.
- Global options placed before the subcommand (`--no-pager`, `-C <dir>`, `-c <key=value>`, `--git-dir`, `--work-tree`, `--namespace`, `--exec-path`, in both their separate and their `--option=value` forms) are skipped, so the subcommand itself is what is classified: `git -C /repo push` is a push, not a read of `/repo`.

### A timeout is its own kind of failure

#### Context

**Problem**: a push killed on its budget usually writes nothing to stderr, so without a distinct failure kind it surfaces as a bare failed push, and a caller cannot tell "the network was slow, the commit may have landed" from "git refused".

#### Business logic

A git killed for outrunning its budget fails with the message "git <command line> timed out after <budget>ms", and the failure carries a mark any caller in any package can check to recognize a timeout, as opposed to a git that exited with an error of its own. An invocation killed for printing more than the runner holds is an ordinary failure, not a timeout.

### The line worth showing

#### Context

**Problem**: the process runner buries git's useful line under its own "Command failed: git …" preamble, which is what the user would otherwise see.

#### Business logic

The summary of a failed invocation is git's own line beginning with `fatal:`, `error:` or `remote:` (in any letter case) when there is one, else the first non-empty line of the message, else the placeholder "git failed".

### Inside a repository, and where its checkout starts

#### Context

**Problem**: "this project cannot host a checkout at all" and "git was there and the operation failed" are the same rejection out of `git worktree add`, but call for opposite handling.

#### Business logic

Whether a directory sits inside a git working tree is answered by git, and only a clear "yes" counts: a missing or unreadable git reads as "no repository", the conservative answer for a caller that treats a repository's failure as fatal. The root of the checkout [3] a directory is in (an agent's [1] own, from anywhere under it) is git's top-level directory for that directory; outside a repository the question fails.

### Pushing a branch to origin

#### Context

**Business logic story**: the product pushes an agent's [1] branch to `origin` when the agent ends, and tells the user why when it cannot.

#### Business logic

A branch is pushed to `origin` with its upstream set. The result is success, or failure carrying the line worth showing; nothing is thrown. A push killed on its budget reports the timeout line, which names the command and the budget.
