# Agent schedule

One line per command. The command is the project's `.claude/skills/<command>`. `when` is a check, run at the repository root: the command is due while the check prints a JSON value that is not empty. `cap` is how many runs of the command may be in flight at once, across every machine that shares this repository.

- work-queue: when `npx queue`, cap 1
