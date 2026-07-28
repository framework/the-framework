Shared storage machinery behind the two run-store families (`AgentRunStore` for top-level `stream()` pauses, `SubAgentRunStore` for `asTool` pauses) — not exported from the entrypoint; the concrete subclasses pin snapshot type, key prefix, and docs.

## TLDR

- `InMemoryRunStoreBase<S>`: Map-backed `store`/`load`/`consume` (read+delete) plus a test-only `clear()`; single-process, lossy across restarts.
- `CachedRunStoreBase<S>`: wraps a caller-supplied `CacheAdapter` with `keyPrefix + id` keys and a TTL (default 300s); constructor throws a store-name-specific error without a cache.

## Facts

- `load()` normalizes an off-contract adapter's `undefined` miss to `null` (`?? null`).
- Subclasses pass `CachedRunStoreDefaults` (`keyPrefix`, `storeName`) so error messages and namespaces stay per-family while the mechanics live once.
