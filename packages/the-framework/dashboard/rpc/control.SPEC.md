The dashboard's handles for every steering action the user can fire at the daemon: starting an agent, answering it, stopping it, and publishing or discarding its work.

Each handle is declared against the daemon's own implementation of that action, so renaming an action or changing what it takes breaks the dashboard at build time instead of failing as a missing route once a user clicks the button.

## Business logic — TL;DR

- **Start and stop** - start a new agent on a project, and stop a running one (or every agent of the project when none is named).
- **Answer a running agent** - pick an option at a gate, and send a live chat message into the agent's ongoing driver session.
- **Answer the Claude web bridge** - confirm the answer to a cloud session's parked question, or cancel it and leave the question unanswered.
- **Publish the work** - push the agent branch, open a pull request, merge it, and set how far a finished agent publishes itself (its handoff level).
- **Discard the work** - retire a finished agent's worktree, and delete the agent altogether.
- **Open elsewhere** - hand a project or an agent to a local application (editor, terminal, browser preview) on the daemon's machine.
- **Tickets** - queue a ticket as a confirmed task, and release a ticket's claim lock so it can be picked up again.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
