What the tests cover:

- **No link is offered without one that opens the session** - an agent with no link, an agent with a session id but no link, an agent whose link is the generic Claude Code entry address, an agent whose link is some fixed address that does not carry its session id, and an agent whose session id has not been reported yet all get no link.
- **A link that opens the session** - an address containing the agent's session id is offered, reading "Open session (<session id>) ↗".
