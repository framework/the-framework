Committed session history (#1179): archives a project's finished runs under `.the-framework/<user>/sessions/` so they survive the repo being cleaned.

## TLDR

- `userDirName(email)`: git `user.email` as a safe directory name (lowercased, conservative charset, must start alphanumeric, ≤ 64 chars); anything unfittable falls back to `anonymous` rather than a guess.
- `sessionsDir(cwd, user)` / `sessionsGitignore(user)`: the archive path and the three-line un-ignore rules for it.
- `ensureSessionsIgnored()`: lazily upgrades `.the-framework/.gitignore` to track this user's sessions; `resolveUserDir()` reads and caches `git config user.email` per repo for the process's life.

## Problems

- The bug this exists for: run state lived in untracked `.the-framework/runs/`, so an ordinary `git clean -fdx` deleted every session a project had ever run, unrecoverably.
- The seeded allow-list gitignore starts with `*`, and git never descends into an ignored directory — so each directory on the way down must be re-included before files under it can be (hence three rules, not one; same shape as the conversations rules, #908).
- The email comes from repo configuration and is joined onto a path, so a name that could climb out of the directory (`.`, `..`, dotfiles) is the one thing that must be impossible — enforced by the must-start-alphanumeric rule.

## Decisions

- Scoped per user rather than one shared directory: two people on the same repo would write the same paths from different machines and conflict on every merge; side-by-side directories don't. Team-visible history is the intended outcome, not a leak.
- Identity is the git `user.email` already configured — nothing new to set up, and the directory matches the name on the commits.
- Gitignore upgrade happens lazily on archive, not install: the ignore file is seeded once and only when absent, so pre-feature repos and second users joining need an existing file amended. Only a recognized file (containing `!LOGS.md`) is upgraded; anything hand-edited beyond recognition is left alone.
- Missing/unreadable identity archives under `anonymous` — filing under a placeholder is strictly better than dropping history. `forgetUserDirs()` clears the cache for tests and daemons outliving a config change.
