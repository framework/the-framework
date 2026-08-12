One static entry point for one-line AI actions — quick prompts, anonymous agents, images, speech, transcription, reranking, provider files, and embeddings.

## TLDR

- A quick prompt runs a throwaway helpful-assistant agent; every other capability hands off to its dedicated builder.
- Embedding many texts at once is split into batches behind the scenes and returned as if it were one call, with usage summed.
- Embeddings can optionally be cached in memory, so asking for the same text twice doesn't pay twice.

## Rationales

- The embedding cache is remembered per provider-and-model pair — the only identity stable across calls — so repeated texts genuinely hit the cache; it is wiped whenever the provider registry resets so tests never reuse a stale fake.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
