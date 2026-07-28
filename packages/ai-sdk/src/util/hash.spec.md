`cyrb53Hex()` — public-domain cyrb53 non-cryptographic 53-bit hash returning a 14-hex-char string.

## Facts

- Pure JS (no `node:crypto`) because the main entry must stay runtime-agnostic (see `src/isomorphic-check.test.ts`).
- Used by provider adapters to derive stable cache keys from request payloads: OpenAI's `prompt_cache_key` and Google's `cachedContents/*` registry. Stability, not cryptographic strength, is the goal.
