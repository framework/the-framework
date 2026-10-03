Links this package's own command into an agent's [1] checkout [2] that has none, as `node_modules/.bin/branches`, so the `npx branches` the skill tells the agent to run finds the command in the checkout and downloads nothing.

## Context

**User story**: the user adds an empty folder to the dashboard and starts an agent in it. The agent reads the skill and runs `npx branches status`. It gets this package's answer. Nothing is fetched from npm.

**Problem**: `npx <name>` runs the project's installed copy when there is one, and otherwise downloads whatever package holds that name on npm and runs it. The name `branches` on npm is another publisher's package. In a project with nothing installed, an agent following the skill ran that package: a stranger's code, in the user's project, with nothing asked.

## Glossary

[1] agent: one task worked by a coding agent in its own checkout, on its own branch.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory.

## Business logic — TL;DR

- **The link** - `node_modules/.bin/branches` in the checkout [2], a link to this package's own command, made when the checkout is set up.
- **A project's own copy wins** - a command already at that path, the project's installed one linked in with its other tools, is left alone.
- **Hidden from git** - the link's path is added to the repository's exclude file, so it is never the agent's [1] work and never makes the checkout unclean.
- **Best-effort** - a link that cannot be made does not fail the checkout.

## Business logic

### The link

#### Context

See `## Context`.

#### Business logic

When a checkout [2] is created or attached (`checkout.ts`), after the project's own dependencies are linked in, the directory `node_modules/.bin` is made in the checkout when missing and `branches` in it is linked to this package's command. `npx branches`, run anywhere inside the checkout, then runs that command.

### A project's own copy wins

#### Context

**Business logic story**: a project that depends on this package has its `node_modules/.bin` entries linked into every checkout [2] (`worktree-deps.ts`).

#### Business logic

When anything is already at `node_modules/.bin/branches` in the checkout, a link included, nothing is done: the project's installed copy is the one the agent [1] runs.

### Hidden from git

#### Context

**Problem**: a project with nothing installed has no ignore rule for `node_modules`, so the link would show as untracked, ride a sweeping `git add -A` onto the agent's branch, and make the checkout read as unclean.

#### Business logic

Before the link is made, its path, `/node_modules/.bin/branches`, is added to the repository's own exclude file, which no commit carries. The checkout's status stays clean.

### Best-effort

#### Context

See `## Context`.

#### Business logic

A filesystem that refuses the directory or the link is ignored: the checkout is still made, and the agent starts without the link.
