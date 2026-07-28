Tests for `memory-inject.ts` — covers `withMemoryInject` standalone and via the `Agent.remembers()` auto-cascade.

## TLDR

- Prepends a `<user-memory>` block with recall-matched facts to the system prompt; only facts matching the LATEST user message (not older history) are injected; spec `tags` scope recall; `injectLimit` caps count.
- `injectTokenBudget` drops lowest-score facts first (incremental render accounting for wrapper overhead); skips entirely when even the top fact won't fit, when no store is registered, or when recall is empty.
- Auto-cascade: `inject:'auto'` installs automatically (prompt + streaming); `'manual'` and `remembers() => false` leave the loop untouched; per-call `memory:false` disables and a per-call spec replaces the class spec; async `remembers()` awaited; continuation calls (`options.messages`) skip injection to avoid duplicate blocks.
