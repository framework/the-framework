Builds the shell one-liner that picks a dashboard session back up in a terminal, so a conversation is reachable outside the dashboard.

## TLDR

- The command recreates the run's working directory first — usually already deleted by cleanup — because that directory is how the agent CLI finds the session; an empty folder is enough.
- With no directory on record, only the bare session id is offered.
- Deliberately no permission preset: what a reopened agent may do is the call of the person at the terminal.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
