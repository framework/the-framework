---
'@gemstack/framework': minor
---

feat(framework): turn an agent's showMultiSelect()+AWAIT into a live checklist gate (#339)

The multi twin of the single-select turn-boundary gate (#337). When a build turn ends on an `await-multiselect` block, the framework shows a checklist on the dashboard (via `requestMultiSelect`, with the agent-marked defaults pre-checked), waits for the selection, and re-prompts the agent to continue from it. This is what the research preset needs to let the user pick which problems to deep-dive. Same safety as #337: a no-op when headless and when the agent just finishes.
