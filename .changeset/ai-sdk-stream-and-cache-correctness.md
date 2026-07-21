---
'@gemstack/ai-sdk': patch
---

Fix four correctness bugs around streaming, SSE and the embedding cache.

- `Agent.stream()` invoked `conversational()` and `remembers()` twice for any agent that overrides them asynchronously: once in the synchronous fast-path probe (where the returned promise was dropped on the floor) and again on the async path. An override doing a DI or DB lookup ran its side effects twice per call, and a rejection from the first, unhandled promise could abort the process. Both are now called once and the values threaded through.
- `readAgentStream`'s "skip malformed JSON" guard also swallowed every error thrown by the consumer's own SSE callbacks, losing the diagnostic and leaving the turn half-mutated. It now parses inside the guard and applies outside it.
- `parseSseStream` released the reader lock without cancelling the body, so any early exit (a `stopWhen`, an approval pause, a consumer `break`) left the upstream HTTP connection open until the server timed it out.
- `CachedEmbeddingAdapter` reported zero token usage even when it *did* call the provider, so anything aggregating usage undercounted embedding spend entirely; it now reports what the provider charged for cache misses. Its cache is also no longer unbounded (new `maxEntries` option, default 10_000, oldest evicted first).

`CachedEmbeddingAdapter` had no test coverage; it now has a suite.
