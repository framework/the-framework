Lets the user watch and steer an agent's live browser from the dashboard, by relaying the screen stream and the clicks through the daemon.

## User Stories

- The user watches an agent's live browser inside the dashboard pane and clicks and types into it.

## Flows

- The dashboard cannot reach an agent's browser directly (wrong origin), so the pane talks to the daemon and the daemon talks to the agent's own preview channel on the same machine.
- The client never names the port: it comes from the agent's own live record, so the relay cannot be pointed at anything else on the machine. A finished agent's recorded port is never followed — by then the OS may have handed that number to anything.
- Frames stream straight through, stop the moment the viewer leaves, and are never cached; an agent with no preview answers "not found", one that just died answers with an error instead of hanging the pane.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
