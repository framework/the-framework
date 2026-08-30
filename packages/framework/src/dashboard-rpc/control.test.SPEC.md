What the tests cover: starting an agent from the dashboard, and releasing a ticket's claim.

- A drain started by hand from the dashboard carries the agent queue entry's ticket, exactly as the scheduled drain does, so the ticket shows as being worked.
- Any other prompt starts with no ticket attached, however full the agent queue is — an agent that never touched a ticket must not make that ticket look like it is being implemented.
- A ticket explicitly named by the caller is kept, and not overwritten by the queue lookup.
- Releasing a ticket's claim deletes the claim file and lands as a commit on the `tickets` branch, leaving the ticket itself untouched.
- A ticket that holds no claim is reported as such rather than as a success.
- Anything that is not a bare ticket filename — a path segment, an escape out of the tickets directory, a claim file, a plan file, a non-ticket name — is refused before any project is resolved.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
