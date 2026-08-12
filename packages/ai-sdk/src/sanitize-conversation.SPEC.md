Repairs a loaded conversation history so any provider will accept a replay: every tool call the assistant made must be followed by exactly one matching result, in order.

## TLDR

- Complete tool turns are kept, with results re-emitted in the order the calls were made and duplicates or strays dropped.
- Turns with unanswered tool calls are treated as abandoned: the calls and partial results are dropped, any text the assistant wrote is kept.
- Results whose parent call is missing are dropped.
- The repair is idempotent and applied automatically when persisted conversations load.

## Rationales

- Providers reject conversations where a tool call has no result, and an interrupted turn (a crash mid-turn, a browser that never replied) leaves exactly that in the store — so histories must be repaired at load time.
- The wire-level normalizer fabricates stub results to keep an in-flight request valid; loading instead drops the incomplete turn, because a fake "result missing" message would pollute the model's future context.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
