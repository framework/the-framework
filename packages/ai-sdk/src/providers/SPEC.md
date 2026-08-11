The vendor layer of the AI SDK — one module per vendor translating the framework's neutral chat, embedding, reranking, speech, image, and file contracts onto that vendor's own protocol.

## TLDR

- Apps name a model as "provider/model"; the matching factory here builds the adapter, and each vendor offers only the capabilities it really has — asking for a missing one fails with a message naming providers that do have it.
- Whatever a vendor answers is normalized to one shape — the same token-usage accounting and finish reasons everywhere — so billing, budgets, and failover treat all vendors alike.
- The two biggest vendors, OpenAI and Google, have full multi-capability suites in their own subdirectories.
- Claude is reachable directly through Anthropic or through AWS Bedrock, sharing one translation; Azure, DeepSeek, Groq, Ollama, xAI, OpenRouter, and Mistral all speak OpenAI's protocol and share the one OpenAI chat adapter.
- Specialists round out the roster: Cohere, Jina, and Voyage for embeddings and reranking, ElevenLabs for speech — none of them offer chat.
- Prompt caching is asked for once, in neutral terms, and mapped onto each vendor's idiom: Anthropic's in-request markers, OpenAI's routing hint, Google's explicitly managed cache resources.

## Rationales

- Vendor SDKs load only when a provider is first used, so every vendor stays an optional install; vendors with small web APIs are called directly with no SDK at all.
- Tools can carry a provider hint to unlock vendor-native abilities (computer use, web search) that far outperform generic function-calling.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
