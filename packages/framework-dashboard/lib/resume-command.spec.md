Builds the shell one-liner that resumes a run's agent session in a terminal (#1195): `mkdir -p <workspace> && cd <workspace> && claude --resume <sessionId>`.

## TLDR

- `buildResumeCommand({sessionId, workspace})` → the full command; just the bare `sessionId` when no workspace was recorded (older run, or one without a session); `null` without a session id.

## Problems

- The CLI finds a session by the directory it ran in, and that directory is usually gone (a cleanly finished run has its worktree removed) — so the command recreates the path first; an empty directory is enough for the CLI to match the session.

## Decisions

- Deliberately no permission-mode flag: what a reopened agent may do is the terminal user's call at the prompt, not the dashboard's to preset.
- With no workspace the id alone is still handed over, so the caller can say which of the two it copied.
