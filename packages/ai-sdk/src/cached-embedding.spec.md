In-memory caching wrapper for any `EmbeddingAdapter`, keyed by `model:text`.

## TLDR

- Splits a batch into cached hits and misses, calls the inner adapter only for the misses, and re-slots fresh vectors back at their original indices.
- Usage reflects what the provider actually charged: zero on a full cache hit, else the miss-call's usage — zeroing it would make aggregating consumers undercount embedding spend.
- FIFO eviction (oldest-first) once `maxEntries` (default 10,000) is exceeded — each entry is a full vector, so an unbounded map would grow forever in a long-lived process.
