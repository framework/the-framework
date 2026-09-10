What the tests cover:

- **The directory is recreated first** - the command creates the agent's old checkout path, moves into it, and only then resumes the coding agent on that session id, because the conversation is matched by the directory it ran in and that directory is usually gone.
- **Paths survive the shell** - a path containing spaces or a quote is quoted so that pasting the command does not split it.
- **No directory recorded** - an agent with a session id but no directory yields the bare session id, which is still worth handing to the user.
- **No session** - an agent with no session id yields no command at all, as does an agent that is not there.
