---
'@gemstack/the-framework': patch
---

Fable can now be picked in the dashboard's model menu. The Claude list offered only Default, Opus, Sonnet and Haiku, so the strongest tier silently couldn't be routed to; `fable` is a documented `--model` alias of the Claude CLI and passes straight through like the others.
