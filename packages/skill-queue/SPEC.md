The agent queue for coding agents, as an npm package: the priority-banded list of what agents work on next, `TODO_AGENTS.md`, on the `agent-data` branch of the project's own repository, never on a code branch; the `queue` command that reads and changes it from any clone; and the instructions an agent follows to use it (`SKILL.md`).

The package knows git, the filesystem and the queue's markdown, nothing else: an entry is text, and what the text means — a task, a link to a ticket elsewhere — is the writer's. The same functions serve every caller: a long-lived process (a daemon that drains the queue into agents, a dashboard that shows it) that keeps a checkout of the branch, and an agent's own shell, through the `queue` command a caller puts on the PATH of every agent it starts on its machine.

The branch is a file store, the primitive `@gemstack/agent-data` provides: a branch nobody edits in a working tree, safe to push and pull eagerly. It gives this package two writers over one rule. A long-lived process writes through its persistent checkout, `.branches/agent-data`, in one serialized cycle per branch — sync with origin, apply, commit, push — and pulls the same way so it reads what other machines pushed. The `queue` command writes as a one-shot remote writer instead: a throwaway checkout of origin's tip, one commit, pushed straight to the branch, gone afterwards — so a command an agent runs never touches a checkout that belongs to another process. Both treat a change as an intent: a push that loses a race is re-applied against the fresher state rather than forced.

## Glossary

- **the funnel** - a caller's write cycle over the branch: apply a change to a checkout of it, commit, push. A long-lived process passes its own; the package's default is the persistent checkout's cycle.

## Business logic — TL;DR

- **The name** (`names`) - the queue file, `TODO_AGENTS.md`, at the root of the shared data branch `agent-data` (`@gemstack/agent-data` names the branch).
- **The queue** (`queue`) - the open entries in order of work, an entry added into its `## Priority N` section, an entry taken off by deletion — done means gone, not checked off; read from anywhere in the repository, edited through the funnel.
- **Where it lives** (`store`) - the branch bound to a project: the seams every operation is injected with, and the sync that makes the branch, seeds the queue, and converges with origin.
- **The command line** (`cli`, `bin/`) - the same operations as commands for a shell: JSON on stdout, a reason on stderr, an exit code that tells a refusal from a usage error; the executable's directory and the skill's own directory are exported (`bin-dir`) for a caller that spawns agents.
- **The skill** (`SKILL.md`) - what the agent is told: the queue is on a branch and not in its checkout, the `queue` command is how it reads and changes it, and the format.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
