Gives every agent checkout a human-reachable name: `.the-framework/branches/` holds one symlink per session checkout, named as the branch it is on, with a `branches` shortcut at the repo root — so `cd branches/<name>` opens any session's work by the name the dashboard shows.

## TLDR

- The checkouts themselves stay where they always were; the branches folder is a view over them, made of links. Renaming a session's branch therefore costs a link rename, never moving a checkout under a running agent.
- The daemon keeps the view current in the background, and a freshly-started session appears immediately. A link is dropped once its checkout is reclaimed or its branch renamed.
- Only the framework's own links are ever created, replaced, or removed: a user's own file, folder, or symlink at any of these paths is left alone.
- A session on a branch whose name cannot be a folder name (old slashed names) simply gets no link.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
