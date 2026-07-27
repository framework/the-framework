---
'@gemstack/the-framework': patch
---

A Claude web run no longer deadlocks on an ambiguous prompt. The system prompt tells the agent to show choices and await on ambiguity, and a cloud session obeyed it into a question nobody attached could answer, spending the session for nothing. A hands-off run's system channel now declares the await gates unavailable in that session, right after the await protocol it amends, so the agent takes the most plausible reading, says which assumption it made, and carries the work through. Worded as availability rather than as a rule, so it deletes itself cleanly once choices become a per-session capability.
