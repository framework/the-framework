GitHub: [#1638](https://github.com/framework/the-framework/issues/1638)

# The catch-all safety commit will commit anything: 7,632 cache files went to main unnoticed

## TLDR

The framework's safety commit — `git add -A` plus a fixed message, run before something could lose pending work — exists in two places: `packages/the-framework/src/install.ts:48-52` (activation, so the install commit lands on a clean tree) and `packages/the-framework/src/store/worktree.ts:152-155` (`commitPendingWork`, before a worktree is folded away). On 2026-08-18 one of them ran in a checkout containing turborepo's local build cache: `118e6cad "[The Framework] uncommitted changes"` — 7,634 files, 7,632 of them `.turbo/cache/`. The repo went to ~664 MB (the actual project is ~115 MB), nobody noticed for four days, and it surfaced as a clone taking minutes. `.turbo/` is ignored now and #1632 removed the instance, but the mechanism is untouched: **a commit path that adds everything it finds is only as safe as `.gitignore` is complete**, and the list of machine-local junk a modern toolchain drops into a working tree is open-ended (`.next/`, `coverage/`, `target/`, `.venv/`, `.cache/`, a stray database dump).

Directions proposed on the issue (not started — this is about what the framework does to a user's repo, so it wants the maintainer's call first):

- **Option A — refuse implausible sweeps** (curator's pick): count what is pending before committing; past a threshold (files or bytes) stop, commit nothing, and report what was seen. A real session adds a handful of files, never thousands, so the threshold separates the cases without knowing which tool made the mess — it catches the next unknown artifact too, and a refusal that reports is strictly more informative than a silent 262 MB commit.
- **Option B — a built-in denylist** of known machine-local directories (`.turbo/`, `.next/`, `coverage/`, …). Fixes the shapes we can name today and ages badly: a list somebody has to keep current, silent about the artifact nobody thought of yet.

## Why it matters

This path runs *unattended*: a human running `git add -A` sees the file count scroll past; this path has no reader. A second, smaller instance already happened — in the 2026-08-23 dogfood (reported on #1204's thread), both drain PRs on the throwaway repo carried `.the-framework/.gitignore` and `.the-framework/LAYOUT`, 12 lines of the framework's own scaffolding that repo's `main` had never committed, and the CI watch merged them. Harmless there; the same sweep would carry anything else sitting in the worktree, at any size, without a word.

## Source

Imported from GitHub issue [framework/the-framework#1638](https://github.com/framework/the-framework/issues/1638), created 2026-08-22, no labels, 1 comment (last folded: 2026-08-22T22:46Z). Found while cleaning up #1632, whose cleanup only removed the instance.
