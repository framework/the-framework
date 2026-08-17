Gives a fresh worktree a working dependency tree instantly, by symlinking the parent checkout's installed dependencies instead of copying or reinstalling them.

## TLDR

- Linking whole dependency directories (the root's and each workspace package's) costs no disk and no wait, and one installed store serves every agent; an agent that changes the lockfile needs its own install anyway and runs it itself.
- The links are hidden from git through a repo-level exclude, because the usual ignore rule matches directories, not symlinks — without it the agent's sweeping commit would drag dangling links onto its branch and the PR.
- Best-effort throughout: a worktree without dependencies is a worse agent, not a failed one.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
