---
"@gemstack/the-framework": patch
---

The sessions rail is honest about cloud runs (#1263, #1264): a finished `Run on: Claude web` session reads "in cloud" instead of "done" (its local process ended at the hand-off; the cloud session keeps working and opens its own PR), rows carry a cloud glyph for web sessions, and a web run's row names its agent again (claude-web is still Claude).
