The `Agent` base class and the run loop — both modes (prompt/stream), failover, sub-agent tools, and auto-persistence.

## TLDR

- One mutable loop context threads through initialize → per-iteration prelude (abort check, hooks, config middleware) → provider call → tool phase → stop-condition check. Streaming and non-streaming share every helper; the non-streaming loop drains the same generators and discards chunks.
- Failover re-resolves the adapter per attempt over `[current, ...failover()]`; attempts are counted for observers; a caller abort short-circuits the chain before burning fallbacks.
- `asTool` turns an agent into a call-and-return sub-agent tool (zero-config, typed-schema, or streaming variants). Declaring it suspendable **without** streaming throws at build time — a silent suspend would leave the parent UI with no progress signal. On a pause, the sub-run snapshots itself to the run store and yields a structural pause chunk upward.

## Decisions

- Auto-persist (conversation) and memory specs are each resolved exactly once per call, with a synchronous fast path when both are provably no-ops — so a DI/database lookup in an override never fires twice and never leaves an unhandled rejection.
- Auto-installed memory middleware rides a `Symbol.for`-keyed side channel on the options object, keeping the public options type clean and appending after the user's own middleware.
- Observers are read lazily off the `globalThis` singleton — no import-time coupling.

## Facts

- Legacy identifiers (`__rudderjs_*` globals, `rudderjs.*` symbols, the pause chunks' discriminator field) are load-bearing cross-bundle contracts, not cosmetic debt.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
