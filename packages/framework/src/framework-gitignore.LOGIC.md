The `.gitignore` written into a project's `.the-framework/` directory when the project is activated: everything under `.the-framework/` is ignored except the ignore file itself, so what lives there (an agent's [1] live files in its checkout [2], this machine's hooks file) never turns a checkout dirty, and a code branch carries nothing of The Framework but that one file. The lasting records live on the `agent-data` branch [3].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.

## Business logic — TL;DR

- **Ignore everything under `.the-framework/`** - an agent's card, diary and inbox, the hooks file and anything else placed under it are all ignored.
- **Except the ignore file itself** - it is the only file under `.the-framework/` git sees; it opens with the comment "The Framework: agent state is transient; the lasting records live on the agent-data branch."
- **Written once, at activation** - install writes it and commits it; its presence is what marks a project as activated, as `install.ts` and `project.ts` read it.
