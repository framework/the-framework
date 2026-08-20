Gives a fresh worktree a working dependency tree instantly, by symlinking the parent checkout's installed dependencies instead of copying or reinstalling them.

## Flows

- Whole dependency directories are linked — the root's and each workspace package's; an agent that changes the lockfile needs its own install anyway and runs it itself.
- The links are hidden from git through a repo-level exclude, so the agent's sweeping commit cannot drag dangling links onto its branch and the PR.
- Best-effort throughout: a worktree without dependencies is a worse agent, not a failed one.

## Rationales

- Linking whole directories costs no disk and no wait, and one installed store serves every agent.
- A repo-level exclude is needed because the usual ignore rule matches directories, not symlinks — without it the links would show as untracked in every worktree.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
