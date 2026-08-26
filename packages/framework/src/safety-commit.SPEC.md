The safety commit: what The Framework commits, under one fixed message, before it does something to a checkout that could lose the work sitting in it — and when it refuses to.

## User story

- The user activates a repository that has uncommitted edits, and finds them preserved in a commit of their own rather than mixed into the activation commit or lost.
- An agent stops without committing; its checkout is torn down, and the diff it held is on the agent's branch.
- The user's checkout happens to hold a build tool's cache with thousands of files. They do not find those files in their git history four days later.

## Business logic — TL;DR

- **One message, two callers** - activation (so the install commit lands on a clean tree) and the teardown of an agent's checkout (so its uncommitted work outlives the checkout) both commit everything pending under the same message, so the user sees one vocabulary.
- **An implausible sweep is refused** - past 200 pending files or 20 MB of them, nothing is committed and the step fails with a report: how many files and how much, which top-level directories hold most of them, and that the user should commit or ignore them themselves and retry. A real session leaves a handful of files behind; a cache directory leaves thousands. The limit tells the two apart without knowing which tool made the mess, so no list of cache directories has to be kept current.
- **Counted the way git would stage it** - every untracked file is counted individually rather than an untracked directory as one entry, paths are read raw so a space or a non-ASCII name cannot break the count, and a rename counts once. Sizes are read from disk (a deleted file weighs nothing), and only while the file count is within its limit — past it the count alone refuses, and a checkout with thousands of pending files is exactly where thousands of size reads would cost.

## Rationales

- **Why a limit, not a denylist** - 7,632 turborepo cache files reached the main branch through this commit on 2026-08-18, unnoticed for four days, and the repository grew to 664 MB of which the project itself was 115 MB. Ignoring that one directory fixes that one instance; the set of things a toolchain drops into a working tree is open-ended. A commit path that adds everything it finds is only as safe as the ignore file is complete, and this path runs unattended, with no person watching the file count scroll past.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
