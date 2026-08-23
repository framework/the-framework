What the tests cover: the menu gathers every per-agent action in one place (open on GitHub, open the folder, open in editor, delete); the folder item is named for what it will actually open — the agent's own checkout while one is retained, the project folder once it is gone — and always addresses that agent; the agent's session id is shown once it has one and copying it yields the command that recreates the working directory and resumes that session in a terminal, confirmed with "Copied", while an agent that never reported a session offers nothing to copy; deleting asks for confirmation first and only then removes the agent; a live agent offers Stop and "Merge when finished", the merge authorization is recorded once, and an ended agent offers neither.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
