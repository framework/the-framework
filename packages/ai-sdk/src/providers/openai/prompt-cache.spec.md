Builds OpenAI's `prompt_cache_key` routing hint from the agent's `CacheableMarkers` — a cyrb53 hash over canonical JSON of the marked regions.

## Facts

- OpenAI caches prompts automatically above 1024 tokens; the key is only a routing-affinity hint so same-prefix requests land on the backend that already holds the prefix. Stable hashing is the goal, not cryptographic strength.
- Regions in hash order: `instructions` → first system message content; `tools` → serialized tools array; `messages: N` → first N non-system messages. Returns `undefined` when nothing is marked (request still auto-caches, just without affinity).
- Exported for unit testing.
