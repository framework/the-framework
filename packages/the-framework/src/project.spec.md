Project-level repo helpers (#380): the `.the-framework/` activation check, the git runner with per-subcommand timeouts, a repo check, a `git ls-files` crawl, and package.json detection signals.

## TLDR

- `readProjectSignals(cwd)`: dependency names (deps + devDeps union) from `package.json` for preset detection; no package.json (from-scratch build) yields empty signals rather than throwing.
- `isActivated(cwd)`: a repo is installed for The Framework when `.the-framework/` exists (#314: the dir is the activation marker); read-only — install itself is a separate concern.
- `nodeGitRunner()`: `execFile('git', ...)` with a timeout picked per subcommand (`gitTimeoutMs`) and a 16MB buffer (a `ls-files` crawl on a large checkout overruns the default).
- `isGitRepo(cwd)` (#997): `rev-parse --is-inside-work-tree`, forgiving toward "no repo".
- `crawlRepoFiles(cwd)`: tracked + untracked honoring .gitignore via `ls-files -z --cached --others --exclude-standard` (the Vike approach); deduped, sorted, `[]` on any failure.

## Problems

- One flat 10s git timeout covered ~20 call sites, so the slowest ops ran under a read's budget (#997): a SIGTERM'd `worktree add` drops a run into the user's main checkout, a SIGTERM'd `push` may have half-landed. Fixed with three tiers: `GIT_READ_TIMEOUT_MS` 10s (index/ref/local objects), `GIT_WRITE_TIMEOUT_MS` 30s (an index write on a large repo outlives a read), `GIT_SLOW_TIMEOUT_MS` 120s (network / whole-checkout: clone, fetch, pull, push, `worktree add`).
- Subcommand parsing: a bare flag filter would read `git -C /repo push` as subcommand `/repo` — `gitWords` drops leading global options, knowing which ones (`-C`, `-c`, `--git-dir`, ...) eat the next word (the `--opt=value` form carries its value inline).

## Decisions

- Everything unlisted in `GIT_READ_OPS` is treated as a mutation (the conservative bucket).
- `worktree` is split by second word: `add` writes a whole checkout (slow), `list` is a read, remove/prune are ordinary mutations.
- The read/write timeout split mirrors what `gh` already has (dashboard/gh.ts); git's slow tier is well past gh's 60s because those are API calls and these move packfiles/checkouts.
- `isGitRepo` exists to distinguish "this project cannot host a worktree at all" from "git was there and the operation failed" — the same rejection out of `git worktree add`, calling for opposite handling. Forgiving in one direction only: unreadable/missing git reads as "no repo".

## Facts

- `GitRunner` is `CliRunner` (from `cli-exec.ts`); rejections carry `CliTimeoutError` when the budget is outrun.
