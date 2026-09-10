The "Branch management" section given to an agent [1] that runs outside a checkout [2] The Framework created, such as a terminal run in the user's own checkout, a GitHub Actions runner or a cloud session: there the `branches` command of the `branches` skill [4] is not on the agent's PATH, so the agent is told to create and check out its branch `agent-<session name>` with git itself and to commit its work to it as it goes. It follows the built-in system prompt in the agent's system channel by the composition rule in `src/system-prompt.ts`, which is also what gives an agent in its own checkout the `branches` skill instead.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the user's checkout.
[3] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[4] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **Branch with git itself** - the agent creates and checks out `agent-<session name>` with `git checkout -b`, the same branch name the `branches` skill would give it, so the session name [3] can still be read off the branch.
- **Commit as you go** - the agent commits its own work to that branch as it works: only what it committed is ever published, and nothing is committed on its behalf.
