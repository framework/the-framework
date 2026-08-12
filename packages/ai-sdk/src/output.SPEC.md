Structured output helper — asks the model for a JSON object, an array, or one of a fixed set of choices, then validates the reply.

## TLDR

- Each wrapper produces both the instruction text telling the model exactly what shape to answer with, and the matching parser for the reply.
- Parsing tolerates the model wrapping its JSON in markdown fences, but a reply that doesn't match the declared shape throws — nothing retries automatically.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
