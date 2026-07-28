JSON reporter — flattens a `SuiteReport` into the stable machine-readable `SuiteJson` shape for CI (`ai:eval --json`).

## TLDR

- Per case, `metric.pass`/`score`/`reason` are flattened to top-level fields so CI scripts don't reach through nested objects; for skipped cases the skip reason wins over any metric reason.
- Shape stability is contractual: adding fields is a minor bump for `@gemstack/ai-sdk`, removing/renaming is a major.
- Envelope deliberately mirrors the `command_run` MCP tool shape so the boost agent surface and the eval CLI feel like one family.
