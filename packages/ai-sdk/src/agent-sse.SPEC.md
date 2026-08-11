Streams a live agent run to the browser as named server-sent events and decodes them back into a renderable turn — both directions live together so the wire vocabulary can never drift.

## TLDR

- The server maps each loop event onto a self-describing named event — text, tool call, tool progress, tool result, the two pause kinds, handoff — then ends with a completion event saying how the run finished and what, if anything, it awaits.
- Failures become an error event and a clean close, never a broken connection.
- The browser folds events into one accumulated turn — the text, tool calls, results, and any pending pause — exactly what a UI needs to render the turn and build the next request.
- Events outside the vocabulary pass through to the app untouched, so apps can ride their own events on the same stream.

## Rationales

- This is the readable alternative to the numeric-prefix data-stream wire the SDK also ships; apps pick either.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
