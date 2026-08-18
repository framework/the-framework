# The data branch

The framework's own data — `tickets/**.md` (plans and locks included), `TODO_AGENTS.md`, the session archives — lives on the dedicated branch `the-framework_data`, never on code branches. Your checkout does not contain these files; the code you ship and the data you edit travel separately.

## Reading

- `$ git fetch origin the-framework_data` first (skip when the repo has no remote)
- `$ git show the-framework_data:TODO_AGENTS.md` / `$ git show the-framework_data:tickets/<FILE>` — use `origin/the-framework_data:` instead when the local branch doesn't exist
- List tickets: `$ git ls-tree --name-only the-framework_data tickets/`

## Writing

Only when the instructions tell you to edit tickets or the queue:

1. `$ git fetch origin the-framework_data` (skip without a remote)
2. `$ git worktree add --detach .tf-data the-framework_data` (or `origin/the-framework_data`)
3. Edit the files inside `.tf-data/`
4. `$ git -C .tf-data add -A && git -C .tf-data commit -m "<what you changed>"`
5. `$ git -C .tf-data push origin HEAD:the-framework_data` — if the push is rejected, `$ git -C .tf-data pull --rebase origin the-framework_data`, then push again
6. `$ git worktree remove --force .tf-data`

Rules:
- Never commit these files to your session branch, and never mix a data commit with code commits — a data change is pushed directly, it does not ride your PR
- With no remote, push is skipped: the commit on the local `the-framework_data` branch is the write
