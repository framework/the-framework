Builds the shell one-liner that reopens an agent's driver session in a terminal, so a conversation can be continued outside the dashboard.

## Business logic

### Picking a session back up outside the dashboard

#### User story

The user wants to carry on an agent's conversation in their own terminal rather than in the dashboard. The dashboard knows the session id but the conversation was previously unreachable: there was no way to name it.

#### Business logic

The command recreates the directory the agent ran in, changes into it, and resumes the session by its id. With no directory recorded — an older agent, or one that never opened a session — the session id alone is handed over instead, so the caller can say which of the two it gave the user. An agent with no session id at all yields nothing to copy.

#### Rationale

The session id alone is not enough: the coding-agent CLI finds a session by the directory it ran in, and that directory is usually gone by the time the user wants it, because an agent that finishes cleanly has its worktree removed. An empty directory at the original path is enough for the CLI to match the session and read the conversation back.

The command deliberately presets no permission mode. It lands in someone's own terminal, and what the reopened agent is allowed to do is that person's call to make at their prompt.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
