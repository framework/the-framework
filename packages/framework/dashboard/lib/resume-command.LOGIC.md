Builds the one-line shell command that reopens an agent's [1] driver session [2] in a terminal, which the agent's menu puts on the clipboard as "Copy resume command".

## Context

**User story**: an agent has finished, and the user wants to carry on the same conversation by hand, outside the dashboard. One click copies a command; pasting it into a terminal reopens the coding agent [3] on that exact conversation.

**Problem**: the coding agent finds a driver session [2] by the directory it ran in, and that directory is usually gone by the time the user wants it — an agent whose work reached the remote has its checkout [4] reclaimed. The session id alone therefore cannot reopen anything, and the dashboard knew the id but never showed it, which left a finished conversation unreachable.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Recreate the directory, then resume** - the command creates the agent's [1] old checkout [4] path if it is missing, moves into it, and resumes the coding agent [3] on that session id. An empty directory at the right path is enough for the coding agent to match the conversation and read it back.
- **The path is quoted** - a path containing spaces or quotes survives being pasted into a shell, since the user's repositories live wherever the user keeps them.
- **Nothing is preset about what the agent may do** - the command carries no permission setting: it lands in someone's terminal, and what the reopened coding agent [3] is allowed to do is that person's decision at their own prompt.
- **The id alone when there is no directory** - an agent [1] with a session id but no recorded directory yields just the id, which the menu offers as "Copy session id" instead. An agent that never opened a driver session [2] yields nothing, and the menu offers no such item.
