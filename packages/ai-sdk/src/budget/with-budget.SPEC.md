Middleware that enforces per-user daily and monthly spending caps on model usage.

## TLDR

- Before every model call it estimates the input cost and debits it up front; if that would push the user past any cap, the run is refused before the provider is ever called.
- The up-front debit is a reservation: because storage debits atomically, two concurrent requests can't both squeeze past the check.
- Once real token usage arrives it debits the difference; overestimates stand as a small over-charge, since a response that already streamed can't be unspent.
- The app decides who the user is and what their caps are, per request; requests with no user (unauthenticated paths, admin tooling) bypass enforcement entirely.
- Failed provider calls are not refunded, and a model without a known price fails loudly rather than passing for free.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
