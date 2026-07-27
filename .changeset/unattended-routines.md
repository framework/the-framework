---
'@gemstack/the-framework': patch
---

Routine and preset runs fired from the dashboard now run unattended, exactly as the auto-PM sweep runs the same routines: choice gates take the recommended option, the run ends at settle, and its armed push+PR handoff fires. Previously a card-fired routine did its work and then parked forever in the stay-open chat loop as "running", its PR never opened and the queue never filled. The stay-open conversation is unchanged for hand-typed prompts, which is what it was built for.
