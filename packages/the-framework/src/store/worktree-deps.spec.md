Gives a fresh run worktree a dependency tree (#736) by symlinking the parent checkout's `node_modules` directories in, and makes git ignore those links (#738).

## TLDR

- `findDependencyDirs`: every `node_modules` down to depth 2 from the repo root (covers `packages/<pkg>/node_modules` in a pnpm/npm workspace without walking the world), skipping `.git`, `.the-framework`, `dist`, `build`, `coverage`, dot-dirs; sorted for stable order.
- `linkDependencies`: symlink each at the same relative path into the worktree; best-effort throughout (a worktree with no deps is a worse run, not a failed one); existing entries left alone (the run may have installed already).
- `excludeDependencyLinks`: append a slash-free `node_modules` rule to the repository's `info/exclude`.

## Decisions

- Symlink over copy (gigabytes per run) or per-worktree install (real latency every start): instant, no extra disk, one store shared by N runs. The one case it is wrong for — a run changing the lockfile — needs its own install regardless, which the agent runs itself.
- Directory-level symlinks are what make pnpm work: linking `packages/foo/node_modules` whole keeps the `.pnpm` symlinks inside it resolving against their real location in the parent checkout.
- Windows uses `junction` links (the only directory-link type granted without elevation; ignored on POSIX).

## Problems

- A repo's `.gitignore` says `node_modules/` and the trailing slash matches directories only — the created symlinks are not covered, show up untracked, and the agent's `git add -A` would commit dangling absolute symlinks onto the PR (#738). Fix: a slash-free rule.
- The rule must go in the *common* git dir's `info/exclude`: git resolves excludes from there, so a per-worktree copy looks right and is silently never read.
