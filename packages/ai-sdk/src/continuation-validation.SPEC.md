Defends resumed conversations against a client that sends back a forged history.

## TLDR

- A continuation round-trip carries prior messages back from the browser, so a malicious caller could rewrite history (or replay another user's thread), smuggle in a tool result the server never requested, or claim approval for a call that was never made.
- Validation demands that the incoming messages faithfully extend the server-persisted thread, that every tool result answers a tool call the model actually issued, and that every approval or rejection references a real call.
- A rejection names the first divergence and carries a machine-readable code.

## Rationales

- Comparison ignores object key order, so data reloaded from a database or rebuilt client-side is not mistaken for a forgery.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
