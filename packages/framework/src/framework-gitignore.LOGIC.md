The `.gitignore` written into a project's `.the-framework/` directory when the project is activated: everything under `.the-framework/` is ignored except the ignore file itself and the layout marker `LAYOUT`, so an agent's [1] live state never turns the project into a dirty checkout [2] and a code branch carries nothing of The Framework but those two files. The lasting records live on the `agent-data` branch [3] instead.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[5] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.

## Business logic — TL;DR

- **Ignore everything under `.the-framework/`** - the event stream [4], the agent's status file, the archive [5] under `agents/`, the materialized presets under `presets/` and anything else placed under it are all ignored, so no agent turns the project into a dirty checkout.
- **Except the two tracked files** - the ignore file itself and the layout marker `LAYOUT` are the only files under `.the-framework/` git sees; the file opens with the comment "The Framework: agent state is transient; the lasting records live on the agent-data branch."
- **Written once, at activation** - install writes it, with the layout marker, and commits it; its presence is what marks a project as activated, as `install.ts` and `project.ts` read it.
