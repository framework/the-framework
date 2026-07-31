---
'@gemstack/the-framework': patch
---

The "Copy resume command" action survives a mid-turn Stop (#1322): the session id was only surfaced when a turn's `result` arrived, so a run stopped (or dying) during a turn — most visibly during its first — never recorded the id and lost its `claude --resume` handle, making the button appear on some sessions and not others. The Claude driver now announces the id the moment the stream states it (its very first line), and telemetry emits the `session-update` right then — so the handle exists seconds after launch and no ending can take it away.
