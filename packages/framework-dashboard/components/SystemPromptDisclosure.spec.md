The "Enhanced System Prompt" dropdown (#863, was "See actual prompt sent" #520): shows the full system prompt a run will send, composed by the very function the run uses, with the two axes as checkboxes.

## TLDR

- Renders `composeRunSystem(...)` — the same composer the run itself uses, so the preview cannot drift from reality; since #547 nothing is read off disk and appended at run time, so this is the WHOLE prompt for every run kind (footer states the character count and "nothing else is appended").
- Two checkbox rows, the composer's existing axes rather than new settings: the #326 built-in block (`vanilla` pref, inverted as "Anti-laziness and improved large-scope planning") and the framework integration as a whole (`transparent` pref, inverted, #625 — off means empty channel, raw `claude -p`). They write the same preferences the session-options gear does.
- Transparent is the master off-switch: it shows anti-laziness as off+locked whatever `vanilla` says — the row must read the way the run will actually behave; with an empty channel the body says "No extra system prompt: only the built-in system prompt of your AI model provider."
- Status dot lit only when *completely* enabled (both axes on), with sr-only "(fully enabled)" text — even though a run with only the built-in block off still sends the emit protocols.
- Inputs (`prompt`, `browser`, `autopilot`, `eco`, `context`, `user` SYSTEM.md #872) all shape the composed text so the preview matches the run exactly.

## Decisions

- Popover dropdown matching the Context/preset menus on the "In play" row (#1046); the dot replaced a ✅/❌ emoji pair that matched nothing else on the page.
- `onTransparentChange` omitted ⇒ the integration row renders read-only ("not the caller's to switch").
