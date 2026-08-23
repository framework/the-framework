The overflow menu holding everything the user can do to one agent: open its repo on GitHub, open its checkout in the file manager or an editor, open the driver's own session, copy the command that reopens that session in a terminal, stop it, authorize its merge up front, reclaim its worktree, or delete it for good.

## Business logic — TL;DR

- **One menu instead of a shifting button row** - every action lives behind a single control, so buttons no longer appear and disappear as the agent changes state.
- **Only offer what applies** - Stop and Merge when finished exist only while the agent runs; Remove worktree and Delete only once it has ended; each item is named after what it will actually open or affect.
- **Open where the agent works** - the file manager and editor open the agent's own checkout while it has one, and say so; once the worktree is gone they open the project instead, under a different name.
- **Preferred editor is a user preference** - the editor submenu lists the editors detected on this machine and remembers the chosen one for every project.
- **Take the conversation to a terminal** - the agent's session id is shown, and clicking it copies a command that recreates the working directory and resumes that session in a terminal.
- **A landed request is not re-fired** - Stop reads "Stopping…" until the agent actually ends, and Merge reads "Merge armed" once authorized.
- **Deleting is confirmed and explained** - the dialog names the agent, states its history cannot be recovered, and states its branch and pull request stay in git.

## Business logic

### Open where the agent works

#### User story

The user wants to look at the agent's files — in a file manager or in their editor — or at the project on GitHub.

#### Business logic

The menu opens the project's GitHub page when its remote URL is known. The folder item opens the agent's own checkout while the agent still has one — it does while it runs, and after it ends only for as long as its work has not reached the remote — and is labelled "Open session's folder"; once that checkout is gone the item is labelled "Open project folder" and explains, on hover, that the agent no longer has its own checkout. Outside the context of a specific agent it is simply "Open folder". The editor item behaves the same way and opens the same location in the user's editor.

#### Rationale

The item is named after what it will actually open, because once the worktree is reclaimed the request falls back to the project root: calling that "the session's folder" was a promise the user could not see being broken.

### Preferred editor

#### User story

The user has one editor they always want The Framework to open files in.

#### Business logic

A submenu under the editor item lists the editors detected on this machine, plus "Default", which means the `FRAMEWORK_EDITOR` environment variable or, failing that, `code`. The current choice is ticked, and choosing one saves it to the user's preferences without closing the menu. An editor previously chosen but no longer detected is still listed, so the choice is never silently lost.

### Take the conversation to a terminal

#### User story

Once the user leaves the dashboard, the driver's session id is the only handle on the conversation the agent had — but an id on its own is not actionable.

#### Business logic

When the agent has a session, the menu links out to it, and shows the first characters of its session id as a menu item. Clicking that item copies a shell command that recreates the agent's working directory and resumes that session there, and flashes "Copied" for a beat without closing the menu. The command recreates the directory first because the coding-agent CLI finds a session by the directory it ran in, and that directory is usually gone by the time the user wants it; an empty directory is enough to read the conversation back. When the agent has no working directory recorded the item copies the session id itself.

### Stop and Merge, while it runs

#### User story

The user wants to end an agent early, or to commit up front to merging what it produces so they do not have to come back for it.

#### Business logic

Stop agent is offered only while the agent is live; once the request lands the item reads "Stopping…" and cannot be fired again until the agent actually ends. "Merge when finished" records the user's authorization to merge and then reads "Merge armed". It is not an abort: the agent still runs to its own natural end and merges there. Both report their failure inside the menu.

#### Rationale

The merge otherwise waits for the agent's own ready-for-merge signal; this item supplies the same authorization from the human ahead of time, so it is a pre-commitment with nothing to press twice.

### Reclaim and delete, once it has ended

#### User story

A finished agent can still be holding a checkout on disk, and its record can outlive its usefulness.

#### Business logic

Remove worktree is offered for an ended agent that still has a checkout, and the surrounding view is told once it is gone so the item disappears. Delete session is offered for an ended agent whose caller supports removing it, and asks for confirmation first: the dialog names the agent by its session name, warns that its history cannot be recovered, and states that its branch and any pull request stay in git. On success the surrounding view is told, so it can leave the deleted agent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
