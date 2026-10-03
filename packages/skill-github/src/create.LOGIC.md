Creates a project's repository on GitHub, for a project that lives on one machine only: a private repository under the logged-in account, named after the project's folder, set as the project's `origin` remote and pushed to. One step, through the `gh` command.

## Context

**User story**: the user's project is a folder that was never pushed anywhere. In the dashboard's project menu the user picks "Create a repository on GitHub…", confirms, and the project is on GitHub: private, under their account, with the project's code pushed. From then on the project has pull requests like any other. An agent asked to "put this project on GitHub" runs the same command.

**Problem**: a local project had no way onto a git host short of creating the repository by hand on the host's site and typing git commands.

## Business logic — TL;DR

- **Only for a project with no `origin`** - a project that has an `origin` remote is refused as `has-remote`: it is already somewhere, and is not moved.
- **Which repository** - `<the logged-in account>/<the project folder's name>`, the account asked of `gh`; a `gh` that cannot answer is `not-logged-in`, with `gh`'s own words.
- **The check creates nothing** - it only names the repository the project would become.
- **Creating** - always private; the repository is set as `origin` and the branch the project's folder is on is pushed, in one `gh` step; a failure is `create-failed`, with `gh`'s own words.

## Business logic

### Only for a project with no `origin`

#### Context

See `## Context`.

#### Business logic

The project's remotes are read; when one is named `origin` the answer is `has-remote` and GitHub is not asked anything.

### Which repository

#### Context

See `## Context`.

#### Business logic

The account is the login `gh` answers for the logged-in user. When `gh` fails (not installed, not logged in, no network) or names no account, the answer is `not-logged-in` with `gh`'s own message. The repository is that account, a slash, and the name of the project's folder.

### The check creates nothing

#### Context

**Business logic story**: the dashboard asks before it offers the menu item, to name the repository in the confirmation.

#### Business logic

The check answers the repository's name, or one of the two refusals above. Nothing is created and nothing is pushed.

### Creating

#### Context

**Problem**: making code public is a decision this must never take for the user.

#### Business logic

After the same two checks, `gh` creates the repository as private, from the project's folder, names it `origin` and pushes. The answer is the repository and its address, `https://github.com/<account>/<name>`. When `gh` refuses (the name is taken on the account, the push fails), the answer is `create-failed` with `gh`'s own message.
