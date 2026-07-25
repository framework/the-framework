---
'@gemstack/the-framework': minor
---

A session's agent id is now visible, and clicking it copies the command that reopens that session in a terminal. The id was recorded all along and shown nowhere, so a conversation you wanted to continue outside the dashboard could not be named. The id on its own is not enough either: the CLI matches a session by the directory it ran in, and that directory is usually gone by then, because a run that finishes cleanly has its worktree removed. The copied command recreates the path first, which is what makes the resume actually find the session.

The same menu's folder item is now named for what it opens. Once a session's worktree is gone the item resolves to the project root, and calling that "the session's folder" was a lie the user had no way to see.
