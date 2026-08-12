A scriptable stand-in for every AI provider, so applications test agent behavior without network calls or spending a token.

## TLDR

- Installing the fake replaces all registered providers with one in-process impostor covering every capability: chat, streaming, embeddings, images, speech in and out, reranking, and files.
- Tests script what the "model" says: a single canned reply, a step-by-step sequence that drives a whole tool-calling loop, or a forced failure at a chosen step to exercise failover and error handling.
- A strict mode makes any unscripted prompt fail loudly, catching tests that accidentally trigger prompts they never asserted on.
- Every interaction is recorded, with assertion helpers to check what was prompted, generated, embedded, or uploaded.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
