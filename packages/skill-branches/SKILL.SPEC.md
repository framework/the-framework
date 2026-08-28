The skill's instructions: what an agent is told about living inside its own checkout, under the package's conventions. Given to every agent a caller starts in a checkout it created, and installable by a skills catalogue as `skills/branches.md`.

## User story

- The user starts an agent from the dashboard and expects its work on a branch named after what it did, reviewable as a pull request, with nothing touched in the user's own checkout.

## Business logic — TL;DR

- **The workspace is the checkout** - the agent was started inside its own checkout under `.branches/`; every file it reads or writes is under its working directory, the repository around it is the user's own working tree and never the agent's to edit, and anything it genuinely needs from outside is a reason to say so and stop.
- **Name the session with the command** - before the first change the agent picks an `[a-z0-9-]+` name and runs `branches name <name>`; the command renames the branch to `agent-<name>` — a rename, so the commits stay — and prints the name the branch got, suffixed when the wanted one was taken. The printed name is the session name from then on; there is nothing else to report.
- **Commit as you go** - only what the agent committed is ever published; nothing is committed on its behalf, and uncommitted work stays in the checkout.
- **Leave a clean tree** - before finishing, `branches status` must report a clean tree: uncommitted work blocks the checkout from being reclaimed and is not part of what gets published.
- **Never publish yourself** - the agent neither pushes nor opens the pull request; push, pull request and merge are done for it, as the user configured.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
