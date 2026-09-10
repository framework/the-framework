What the tests cover, for the "Enhanced System Prompt" disclosure:

- **The prompt shown is the composed one** - with the built-in system prompt [1] on, the panel shows a real, non-empty system prompt and states that it is the whole of it; with the integration off the panel says instead that there is no extra system prompt, only the model provider's own.
- **The summary says whether anything is off** - the closed control reads as fully enabled only when both levels are on; dropping the built-in system prompt [1] reads as not fully enabled even though the turn signals [2] are still sent, and so does turning the integration off.
- **The state is not carried by color alone** - the fully-enabled or not-fully-enabled state is spelled out in words on the closed control, not left to the status dot.
- **Both rows read as on by default** - with nothing turned off, the built-in system prompt row and the integration row are both ticked.
- **Each row switches its own level** - unticking the built-in system prompt row makes the next agent [3] vanilla [4]; unticking the integration row makes it transparent [5].
- **The integration is the master off-switch** - with it off, the built-in system prompt row reads as off and cannot be changed, whatever is stored for it.
- **A row nobody can switch reads as fixed** - where the surface does not own the integration setting, that row is shown but not changeable.
- **The browser section is part of what is shown** - an agent [3] started with a browser previews a longer prompt than the same agent without one, because the section telling the agent about its browser is part of what it is sent.

## Glossary

[1] the built-in system prompt: the standing instructions every agent starts with; `SYSTEM.md` is the project's own instructions added on top.
[2] turn signals: what The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[5] transparent: an agent started with nothing of The Framework's — the raw coding agent.
