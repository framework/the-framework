Status: open
Topics: [system-prompt]
GitHub: [#1416](https://github.com/gemstack-land/the-framework/issues/1416)

# New gate: let agent gauge self-confidence

## TLDR

Add a gate where the agent gauges its own confidence and the framework branches on it. Example from the OP: CI red → agent fixes → if the agent is confident, auto-merge; otherwise ask the user for choices and/or a review.

## Why it matters

Confidence-conditional gating is the middle ground between full autonomy and always-ask: sure-footed fixes land unattended while genuinely uncertain work routes to a human. Extends the system prompt's gate family (#326), in the same spirit as the existing ambiguity/scope/alternatives gates.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1416](https://github.com/gemstack-land/the-framework/issues/1416), created 2026-07-31, label: `system-prompt 📋`, 0 comments.
