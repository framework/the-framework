What the tests cover, against a real git repository whose tickets and agent queue sit on the `agent-data` branch, registered as a project in a throwaway registry:

- **Releasing a ticket's claim** - the lock file is removed as a commit on the `agent-data` branch while the ticket itself stays; a ticket holding no claim answers "this ticket holds no lock"; anything but a bare ticket filename is refused with "not a ticket filename" before any project is resolved: a path with a parent segment, a nested path, the ticket's own `.lock.md` or `.plan.md` sibling, and a name that is not `.md`.
