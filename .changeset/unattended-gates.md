---
'@gemstack/framework': patch
---

Auto PM runs no longer hang on their first choice gate (#846)

A daemon-spawned run parks each choice gate waiting for a human, and autopilot's
auto-accept countdown runs in the browser — so a run started while nobody was
watching waited forever. Runs the daemon starts on its own are now marked
unattended and take the recommended option, the same fallback a headless run
already uses. Stop is unaffected.
