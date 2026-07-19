---
'@gemstack/framework': minor
---

`--browser` now runs against a Chrome the framework launches and stops with the run, instead of letting chrome-devtools-mcp launch its own. The debug port is open, so a second client can attach to the very page the agent is on — the prerequisite for streaming that browser to a human who needs to step in (#609). On a machine with no Chrome, `--browser` falls back to exactly what it did before.
