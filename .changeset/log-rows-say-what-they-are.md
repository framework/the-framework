---
'@gemstack/framework-dashboard': patch
---

The session log now says what a row is by its colour, and opens with the line you wrote. A failure renders red (#1199): both the agent erroring mid-run and the run settling badly, though a stopped run stays neutral because stopping was asked for and is not a fault. Your own turn renders blue (#1170), so it reads apart from the agent's work.

The prompt is also hoisted to the top of the log (#1170). It is emitted after the session and system-prompt events, so the one line you wrote used to open three rows down, underneath a char-count summary of a prompt you did not write. Only the first prompt moves; a later turn is part of the conversation and stays where it happened.
