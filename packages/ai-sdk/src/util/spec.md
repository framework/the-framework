Small runtime-agnostic helpers shared across the SDK.

## TLDR

- `content.ts` (+ `content.test.ts`) — flatten message content to text; separator semantics are load-bearing (#573).
- `hash.ts` — cyrb53 stable hash for provider cache keys (no `node:crypto`, isomorphic).
- `sleep.ts` — promise `setTimeout`.
