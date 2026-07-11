---
"@gemstack/framework": minor
---

Add the "Add project(s)" install flow to the dashboard. A `POST /api/projects` (guarded like the other state-changing routes) installs The Framework into a repo, or every git repo directly under a folder, then registers each so it shows up in the Projects list; the daemon wires it to install-core. The Projects sidebar gains an "Add" control with a small path form (single repo or "folder of repos"), shown only when the server enables adding. Also fixes `enumerateGitRepos` to detect repo roots via `git rev-parse --show-prefix` instead of comparing `--show-toplevel` to the path, which failed across a symlink (e.g. macOS `/var` -> `/private/var`) and returned no repos.
