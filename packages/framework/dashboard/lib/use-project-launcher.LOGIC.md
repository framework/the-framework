What the launcher offers for one project, read once per project: its commands [1], whether it has a start hook [2], whether it has a git host provider [3], whether its repository has a remote, and the two branches an agent can start from.

## Context

**Problem**: two surfaces need the same answer — the launcher's Start form, for its "no start hook" message, and the composer, for its `/` list and its Commands menu — and both must tell "not read yet" from "read, and the project has none", or the "no start hook" message would flash on every project while the read is in flight.

## Glossary

[1] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[2] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`, which starts an agent and answers its id.
[3] git host provider: the package of the project that declares it provides the git host; The Framework opens and lands pull requests through the command that package declares. A project with none has no git host: no pull request can be opened for it.

## Business logic

The read asks the daemon for the project's commands [1], whether the project has a start hook [2], whether it has a git host provider [3] and whether its repository has a remote, which decide the options the launcher's publish menu offers, and the two branches an agent can start from (the name of the project's main branch and the name of the branch the project's folder is on), which the daemon names only where the launcher's "start from" chip is to be shown (`dashboard-rpc/projects.ts`). The branches are as they were when the read was made: a branch the user checks out afterwards is seen when the launcher is opened again. Its answer is nothing until the daemon has answered, nothing when no project is open, and nothing for a project the daemon does not know. It is asked again when the project changes. A surface therefore says "this project has no start hook" only once it holds an answer that says so.
