On-demand app preview: serve a project so the user can look at it in the browser with one click, no agent run involved — the "show it" twin of the run's "verify it" gate.

## TLDR

- Runs the project's own dev script and hands back the local URL the server announces; a plain static page is served by a built-in file server instead; with neither, there is nothing to preview.
- In a multi-package repo, every servable app is listed (the root first) so the dashboard can offer a pick.
- Stopping kills the whole server process tree and frees the port; a preview that dies on its own reports itself gone so the next open restarts it.
- The built-in file server refuses to serve anything outside the project directory.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
