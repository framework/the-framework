Lets an app put a custom LLM gateway — its own auth and wire format — behind the SDK's standard provider contract.

## TLDR

- A fill-in-the-blanks template: the base owns the shared lifecycle (sending requests, plain and streaming responses, cancellation, error reporting) while the app describes only what's gateway-specific — auth, request shape, and how to decode responses and stream events.
- Meant only for gateways speaking their own dialect; a gateway compatible with OpenAI or Anthropic just points the built-in driver at a different address.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
