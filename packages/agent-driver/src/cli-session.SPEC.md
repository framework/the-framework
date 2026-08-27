Runs one turn of a wrapped coding-agent CLI: start it, stream its output live, and decide whether the turn succeeded. This is the part that is the same for every driver — only reading the CLI's own output dialect differs, so Claude Code and Codex share all of it rather than each carrying a copy.

## Business logic — TL;DR

- **The prompt goes in through the CLI's input, never as a command-line argument** - a task description, a plan, or a pasted stack trace can be arbitrarily long, and an argument would eventually be truncated by the operating system.
- **Output is streamed, not collected** - each line the CLI prints is turned into framework events as it arrives, so the dashboard shows the agent's prose and tool calls while the turn is still running.
- **Stopping stops the whole tree** - the CLI is started as the leader of its own process group and the whole group is signalled at once, so the agent's own workers, searches, and shell commands go down with it instead of being left running.
- **A hung agent is forced down** - a stop first asks politely, giving the agent five seconds to finish what it is doing, then kills it outright if it has not exited.
- **A failed exit is a failed turn, even after the agent spoke** - The Framework gates on outcomes, so an agent that streamed text and then crashed mid-build must not pass as a completed turn. The failure carries the CLI's own error output as its explanation, falling back to whatever text the agent had produced, and then to the bare exit status.
- **Each turn is reported exactly once** - a turn already ended by the user stopping it, or by the CLI failing to start at all, is not reported a second time when the process finally closes.
- **A CLI that dies before reading its input does not take the daemon down** - the failed turn is reported through the normal path instead.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
