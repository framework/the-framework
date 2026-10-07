Removes what this package left in a project: the settings file under `.orchestration/`, then the directory once it is empty, then the rule hiding it from git once no checkout of the repository has one. What `orchestration cleanup` runs. It is the command a dashboard asks for by the declared `cleanup` kind when a project is removed with its files: the package declares `"openagent": { "cleanup": "orchestration" }` in its `package.json`.

## Context

**User story**: the user removes a project from the dashboard and asks for the tools' files in the folder to go too. The directory with the subagent settings disappears. A user who wants the same by hand runs `orchestration cleanup` in the project.

**Business logic story**: a dashboard holds no list of any tool's files, so the package removes its own. The removal itself is the shared library's (`removeOwnDirectory` in `@openagt/agent-data`), handed this package's directory and its one file name. The plans and the subagents' records live on the records' branch, which is not this package's to remove. The refs `refs/landed/<id>` stay too: each keeps a landed subagent's last commit, and a commit is never this clean-up's to drop.

## Business logic — TL;DR

- **The settings file goes** - `settings.json`, and a half-written `settings.json.<pid>.<uuid>` a killed save left beside it, each when it is a regular file git does not track. Anything else in the directory is kept, named with `not made by orchestration`; a file git tracks is kept with `git tracks it`.
- **The directory and its rule** - `.orchestration/` goes only when nothing was kept, and the line `/.orchestration` leaves the repository's exclude file only when no checkout of the repository still has such a directory (`own-directory.ts` in `@openagt/agent-data`).
- **The answer** - `{"ok":true,"removed":[<paths>],"kept":[{"path":…,"reason":…}]}`, paths from the project's root; a second clean-up answers `{"ok":true,"removed":[],"kept":[]}`. The clean-up itself never refuses, since nothing of this package's runs in the background; outside a repository the command refuses `not-a-repo` like every other.
