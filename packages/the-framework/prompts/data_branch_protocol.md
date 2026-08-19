# The data branch

The framework's own data — `tickets/**.md` (plans and locks included), `TODO_AGENTS.md`, the session archives — lives on the dedicated branch `tf-data`, never on code branches. Your checkout does not contain these files; the code you ship and the data you edit travel separately.

## Reading

- `$ git fetch origin tf-data` first (skip when the repo has no remote)
- `$ git show tf-data:TODO_AGENTS.md` / `$ git show tf-data:tickets/<FILE>` — use `origin/tf-data:` instead when the local branch doesn't exist
- List tickets: `$ git ls-tree --name-only tf-data tickets/`

## Writing

Only when the instructions tell you to edit tickets or the queue:

1. `$ git fetch origin tf-data` (skip without a remote)
2. `$ git worktree add --detach .tf-data tf-data` (or `origin/tf-data`)
3. Edit the files inside `.tf-data/`
4. `$ git -C .tf-data add -A && git -C .tf-data commit -m "<what you changed>"`
5. `$ git -C .tf-data push origin HEAD:tf-data` — if the push is rejected, `$ git -C .tf-data pull --rebase origin tf-data`, then push again
6. `$ git worktree remove --force .tf-data`

Rules:
- Never commit these files to your session branch, and never mix a data commit with code commits — a data change is pushed directly, it does not ride your PR
- With no remote, push is skipped: the commit on the local `tf-data` branch is the write
