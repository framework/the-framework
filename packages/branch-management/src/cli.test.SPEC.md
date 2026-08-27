What the tests cover: every command of the command line against real git, and the contract around them.

- **`create`** - makes the checkout on `tf-agent-<id>`, links the parent's dependency directory in, creates the repo-root `branches` shortcut; works from inside another checkout; `--base` puts the branch on the stated commit.
- **Ids** - an id that could escape the branches directory is refused by `create` and `remove` with nothing created.
- **`name`** - renames from a subdirectory of the checkout, leaves no second branch, moves the `branches/` link to the new name without moving the checkout; the same name again is a no-op and another name renames again, dropping the old link; a name taken locally or only on the remote gets a numeric suffix that the caller reads back; a name outside `[a-z0-9-]+` is refused with the branch untouched; the project's main checkout is refused and keeps its branch.
- **`status`** - reads dirty before the agent commits, clean after, on the remote after a push; accepts an absolute or a relative path; refuses a leftover directory that is not a checkout.
- **`list`** - empty for a project with no checkouts; each checkout with the branch it is on now, renamed or not; a number per checkout with `--sizes`.
- **`remove`** - a dirty checkout is kept with the reason on stderr; a committed one is pushed, removed, and its link dropped; a second removal reports no checkout; with `--no-push` an unpushed checkout is kept and nothing reaches the remote, until someone pushes it by hand.
- **`attach`** - a continued agent gets its checkout back on the named branch, with its previous commit, dependencies and link.
- **`prune`** - removes what the rule allows, lists each kept checkout with its reason, exits 0.
- **Outside a repository** - every command is refused as such.
- **Usage** - no command, an unknown command, a missing or extra argument, an unknown option: the usage on stderr, no JSON, exit code 2.
- **A git failure** - reported with git's own line, exit code 1.
- **The executable** - runs by name from the exported bin directory: JSON on stdout, the reason on stderr, the exit codes 0, 1 and 2.
- **Naming again** - asking again for the name the checkout already carries changes nothing, whether it got the plain name or a suffixed one, and whether or not its own branch has been pushed.
- **Reserved names** - `data` and any `agent-…` name are refused, the branch stays, and no phantom checkout appears in the listing.
- **The project from its layout** - a project that is itself a linked worktree gets its checkouts under its own directory, lists them from inside one of them, and its links follow a rename; the main checkout it was made from sees none of them.
- **Before the project is looked for** - a bad id is refused even outside a repository; `status <path>` on a directory outside a repository answers "not a checkout"; `attach` outside a repository is refused as such.
- **Not commands** - names of built-in object properties are not commands.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
