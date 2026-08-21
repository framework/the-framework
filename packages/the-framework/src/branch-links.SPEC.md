Keeps every session checkout reachable by its branch name: new checkouts live in `.the-framework/branches/` in a folder named as their branch, a symlink appears beside them whenever a branch gets renamed, and a `branches` shortcut at the repo root points there.

## User Stories

- The user opens any session's checkout from the repo root — `cd branches/<name>` — by the branch name the dashboard shows.

## Flows

- A new checkout's folder is already named as its branch, so most need nothing extra. When a session renames its branch (most do, early on), the background pass adds a link under the new name — a rename costs a link, never moving a checkout under a running session.
- Only the framework's own links are ever created, replaced, or removed: a user's own file, folder, or symlink at any of these paths is left alone.
- A session on a branch whose name cannot be a folder name (old slashed names) simply gets no link.
- The `branches` shortcut at the repo root is hidden from git the moment it is made — it is the framework's, and left visible it would ride any sweeping commit onto a work branch. A user's own `branches` folder is never hidden.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
