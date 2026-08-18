Lets the dashboard watch and steer an agent's live browser by relaying the screen stream and the clicks through the daemon.

## TLDR

- The dashboard cannot reach an agent's browser directly (wrong origin), so the pane talks to the daemon and the daemon talks to the agent's own preview channel on the same machine.
- The client never names the port: it comes from the agent's own live record, so the relay cannot be pointed at anything else on the machine, and a finished agent's port is never reused.
- Frames stream straight through, stop the moment the viewer leaves, and are never cached; an agent with no preview answers "not found", one that just died answers with an error instead of hanging the pane.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
