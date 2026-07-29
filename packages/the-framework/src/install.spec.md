Installs/activates a repo for The Framework (#391) — creates the `.the-framework/` marker with a seeded `LOGS.md` — and enumerates git repos for the repos-directory auto-registration.

## TLDR

- `installProject(cwd, deps)` — activate: commit any pre-existing dirty changes first (so the install commit is clean), `git init` when the folder isn't a repo yet, create `.the-framework/` + `LOGS.md`, seed `.the-framework/.gitignore`, materialize the quality presets, commit as `[The Framework] install The Framework`.
- Failures are values, never throws: `{ ok: true, alreadyActivated?, initialized? } | { ok: false, error }`; a repo whose `LOGS.md` already exists is a no-op.
- `enumerateGitRepos(dir, deps)` — the immediate child directories that are their own git repo roots, deduped and sorted; used by the repos-directory scan.
- Pure core over injectable `GitRunner` + `StoreFs` + `DirLister` seams (`nodeDirLister` dynamic-imports `node:fs/promises`).

## Decisions

- Auto-`git init` non-repos instead of erroring: The Framework treats git as the source of truth.
- Repo-root detection uses `git rev-parse --show-prefix` (empty = root) rather than comparing `--show-toplevel` paths, which breaks across symlinks (e.g. macOS `/var` → `/private/var`).
- Presets are materialized into `.the-framework/` but kept out of git so they track the installed framework version instead of going stale in repo history (#326); the ticket-format spec is deliberately NOT materialized — it ships inside the package and is referenced via its `node_modules` path (#674, #683).

## Facts

- The committed database is `LOGS.md` (#313) plus conversations (#908); transient run state (`events.jsonl` / `run.json` / `runs/`) is gitignored via the seeded `.gitignore`.
