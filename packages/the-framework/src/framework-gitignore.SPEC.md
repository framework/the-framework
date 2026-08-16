The `.the-framework/.gitignore`: what a project commits out of its framework directory, and what stays transient.

## TLDR

- An agent's live state is transient and must never make a checkout dirty; its archive is committed, because `git clean -fdx` is an ordinary thing to do to a repo and it used to delete every agent a project had ever run.
- An allow-list, so every directory on the way down to a committed file has to be re-included — git never descends into an ignored one.
- The archive rules name no user: a rule per person meant everyone who ever ran an agent appended their own lines to a tracked file, so their checkout went dirty, the next safety commit swept the edit into a branch, and two machines doing it near each other conflicted.
- Both names the archive directory has had are re-included. A repo whose history predates the rename would otherwise have it ignored the moment this file is rewritten — still tracked, since git does not un-track what it already knows, but invisible to everything after.
- One content, written once at install. It grew a rule per record while there were several, each added lazily by whichever feature needed it and each with its own "is this a file we wrote" check; with one record left, the only question is whether the file is already there.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
