Parses `@<slug>` agent mentions out of a chat message and renders an orchestrator routing rule that forces dispatch of the mentioned agents.

## TLDR

- `parseMentions(message, knownSlugs)`: extracts slugs matching `[a-z0-9-]+`, validates against the known set (any iterable), returns lower-cased slugs deduped in first-seen order plus the message with recognized tokens stripped and whitespace collapsed. Unknown mentions stay as plain text.
- `buildMentionRoutingRule(slugs, { toolName, argKey })`: renders a "HARD RULE" system-prompt block instructing the orchestrator to call the dispatch tool (default `run_agent({ agentSlug })`) for each slug in order; returns `null` for empty slugs so callers can `if (rule) systemPrompt += rule`.

## Decisions

- `MENTION_REGEX` requires whitespace/start-of-string before `@` (so `email@host` is not a mention) and a non-word right boundary (so `@seo-assistant.` keeps its punctuation).
- `parseMentions` builds a fresh regex instance per call — the exported constant is global (`g` flag) and a shared `lastIndex` would leak across calls.
