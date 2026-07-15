---
'@gemstack/framework': minor
---

Sync the built-in system prompt with the #326 doc (#555). The shipped prompt was the 11-Jul draft: the doc was rewritten on 13-Jul and never synced, so every run since has been driven by a stale prompt. `prompts/system_prompt.md` is now byte-identical to the doc again.

What the agent gets that it did not before: `## Analyze the user prompt`, which analyzes the prompt up front and records the results in an `ANLYSIS_RESULT.md`; `## Before starting changes` -> `### Session name`, which commits any dirty tree, then creates and checks out a `the-framework/<session>` branch before the first change and calls setSessionName(); and `## After applying changes`, which calls setReadyForMerge() once the session has no work left. `## Unclear scope` is now `### Ambiguous prompt`, `## Large scope` is now `### Scope`, and `## Alternatives` moves under `## Before applying changes`. The branch step is the notable one: it previously reached the agent only as an aside in the signal protocol, so the doc's own instruction never shipped.

`showMarkdownSecondary()` is emitted as the same `show-markdown` block as `showMarkdown()`, per the doc: for the MVP the two are equivalent.

Also fixes the eco flags, which the sync would otherwise have broken silently (#314). They drop sections from the prompt by exact heading string, and the rewrite renames or moves every heading they matched; a missing heading is a no-op, so `--eco-auto-planning` and `--eco-auto-research` would have quietly stopped trimming anything, with no test failure to catch it. They are retargeted at `### Scope` and `### Alternatives`, the drop is now level-aware so removing a `###` stops at its sibling instead of swallowing the next `##`, and the tests assert a flag actually shortens the prompt rather than asserting a heading is absent (which passes for free once that heading is gone).

`--eco-auto-maintenance` now drops nothing and is inert: the maintenance section left the system prompt for the post-merge prompt, so those tokens are already saved for every run. The flag stays parsed and persisted, and re-points at the post-merge prompt when that lands (#556).
