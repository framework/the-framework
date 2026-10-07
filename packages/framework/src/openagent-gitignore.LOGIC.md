The `.gitignore` written into a project's `.openagent/` directory when the project is activated: everything under `.openagent/` is ignored, the ignore file itself included, so what lives there (an agent's [1] live files in its checkout [2], this machine's hooks file) never turns a checkout dirty, and git shows no trace of the directory. The lasting records live on the `agent-data` branch [3].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. OpenAgent starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.

## Business logic — TL;DR

- **Ignore everything under `.openagent/`** - an agent's card, diary and inbox, the hooks file and anything else placed under it are all ignored.
- **The ignore file hides itself too** - as written at activation, no file under `.openagent/` is offered to git, so nothing of the directory is committed or listed as new (a project's shared presets file is the one exception, un-ignored by name when the user saves one, `project-presets.ts`); the file opens with the comment "OpenAgent: agent state is transient; the lasting records live on the agent-data branch."
- **Written once, at activation** - install writes it and commits nothing; its presence is what marks a project as activated, as `install.ts` and `project.ts` read it.
