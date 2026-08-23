Keeps a project's `.the-framework/branches/` directory navigable by branch name. Every checkout there is a directory named as its birth branch (`tf-agent-<agent id>`), but an agent renames its branch to `tf-<session name>` early — so this pass maintains a symlink named as the branch each checkout is on *now*, whenever that differs from the directory's own name, plus a `branches` shortcut at the repo root. `cd branches/<name>` then reaches any agent's checkout by the name the dashboard shows, and a rename costs a link — a checkout is never moved under a live agent.

## Business logic — TL;DR

- **Reconcile, don't track** - each pass derives the wanted links from the checkouts actually on disk (one link per worktree whose current branch differs from its directory name), creates what is missing, and drops the framework's own links that are stale — no longer wanted, or now belonging to a newer checkout that reuses the name. A detached worktree, or one on a legacy slash-named branch, gets no link.
- **Touch only what is provably ours** - a link is created, replaced, or removed only when it points (or would point) at a sibling checkout directory; a user's own file, directory, or foreign symlink at the same path is left alone, and nothing is ever created over it. The pass never throws.
- **The repo-root `branches` shortcut** - created once, as a relative link into `.the-framework/branches/` (so a checkout that moves keeps working), and only when nothing already sits at that path. Being framework state, it is hidden from git the moment it is made — uncommitted at the root, it would otherwise ride any sweeping `git add -A` onto a code branch. The exclude comes as a pair (`/branches`, then `!/branches/`) shaped so a user's own `branches` *directory* keeps committing while the symlink stays hidden, because a trailing slash never matches a symlink.
- **The daemon's pass** - reconciles every registered project, one pass per call on the daemon's clock, and again right after each worktree allocation so a fresh checkout gets its link immediately. Overlapping calls join the pass in flight, a stopped pass does nothing, and nothing is logged: links are presentation, and narrating every rename would drown the log.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
