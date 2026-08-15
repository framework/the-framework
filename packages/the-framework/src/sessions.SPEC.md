Archives finished sessions inside the repo, per user, so a project's run history survives repo cleaning and two people on one repo never conflict.

## TLDR

- Session history used to live only in untracked state, so an ordinary `git clean` erased every session a project had ever run; keeping the archive in tracked files is the fix.
- Each person's history files under a directory named after the git email they already commit with — nothing new to set up. A hostile or unusable value can never escape the archive path; it falls back to an "anonymous" directory rather than dropping history.
- The state directory's ignore rules name no user, just a glob covering everyone — naming each user made every newcomer dirty a tracked file. Install writes them, so the repair here only ever fires for a repo activated before the archive existed, and it adds what is missing rather than rewriting what is there.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
