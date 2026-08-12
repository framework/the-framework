The global directory that resolves plain "provider/model" names to registered provider implementations, per capability, plus a simple try-in-order failover helper for one-shot media calls.

## TLDR

- Providers register themselves once at startup; agents and builders then resolve chat, reranking, file, and vector-store capabilities by name, with a clear error when a provider lacks the asked-for capability.
- The default model and the user-selectable model list live here too.
- The directory sits in a process-global slot so that when the package gets loaded twice (bundled and externalized copies), both copies still see the same registrations — otherwise every agent call would fail with "unknown provider".
- The failover helper tries candidate models in order and surfaces only the last error; the agent loop has its own richer failover, this one serves image, audio, and transcription calls.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
