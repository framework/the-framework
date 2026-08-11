The OpenAI wing of the vendor layer — the broadest capability roster in the SDK: chat, embeddings, image generation, speech in both directions, hosted files, and hosted document stores, one file per capability behind one factory.

## TLDR

- The chat translation is written once here and reused by every OpenAI-compatible vendor — Ollama, DeepSeek, Groq, xAI, Azure, Mistral, OpenRouter — which differ only in address, key, and extra headers.
- OpenAI's strict conversation rules are enforced before sending: every tool call must be answered in place, so imperfect transcripts are repaired rather than rejected.
- Prompt caching is a routing hint — a stable fingerprint of the cacheable prompt regions steers repeat requests to a server already holding the prefix.
- Document stores index files server-side; attaching a local file uploads it first and by default waits until indexing completes.
- OpenAI's SDK loads only when first used, so it stays an optional install for apps that never talk to OpenAI.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
