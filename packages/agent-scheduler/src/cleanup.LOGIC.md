Removes what this tool left in a project: the state file and the scheduler's log under `.agent-scheduler/`, then the directory once it is empty, then the rule hiding it from git once no checkout of the repository has one. What `agent-scheduler cleanup` runs. It is the command a dashboard asks for by the declared `cleanup` kind when a project is removed with its files: the package declares `"openagent": { "cleanup": "agent-scheduler" }` in its `package.json`.

## Context

**User story**: the user removes a project from the dashboard and asks for the tools' files in the folder to go too. The scheduler's directory disappears; the project's skills, which hold what the project schedules, stay as they are. A user who wants the same by hand runs `agent-scheduler cleanup` in the project.

**Business logic story**: a dashboard holds no list of any tool's files, so the tool removes its own. The removal itself is the shared library's (`removeOwnDirectory` in `@openagt/agent-data`), handed this tool's directory and its two file names. It never touches the remote, a commit, a branch, the working tree outside its directory, a file git tracks, or another tool's files.

**Problem**: a scheduler that is still running writes its state back on its next tick, a minute later at most, so removing its files under it removes nothing for long. A dashboard that closes stops the scheduler, except one the user set to keep running. A scheduler that `stop` ended is off the state at once, while its tick in flight may still be ending: that tick records nothing more (`scheduler.ts`), so it does not put the files back.

## Business logic — TL;DR

- **Refused while the scheduler runs** - when the state names a pid, a whole number above 0, that is a live process on this machine, the whole clean-up is refused, `{"ok":false,"reason":"running","pid":<pid>}`, with nothing removed. The command says `the scheduler is running here (pid <pid>): stop it first with agent-scheduler stop` and exits 1.
- **The tool's two files go** - `state.json` and `scheduler.log`, each when it is a regular file git does not track. Anything else in the directory is kept, named with `not made by agent-scheduler`; a file git tracks is kept with `git tracks it`.
- **The directory and its rule** - `.agent-scheduler/` goes only when nothing was kept, and the line `/.agent-scheduler` leaves the repository's exclude file only when no checkout of the repository still has such a directory (`own-directory.ts` in `@openagt/agent-data`).
- **The skills stay** - what the project schedules is in its skill files, which are the project's own: never read here, never touched.
- **The answer** - `{"ok":true,"removed":[<paths>],"kept":[{"path":…,"reason":…}]}`, paths from the project's root; a second clean-up answers `{"ok":true,"removed":[],"kept":[]}`.
