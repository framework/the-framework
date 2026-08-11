Hosted document stores: an application hands documents to its AI provider, which chunks, embeds, and indexes them on its own servers so agents can later search them.

## TLDR

- The surface here is store management — create, list, and delete stores, attach and remove documents — with the provider picked per call or defaulting to the registered one.
- The real work happens in each provider's adapter; this directory only dispatches and wraps answers in a convenient object.
- Providers without hosted stores fail with advice to use local similarity search over the app's own database instead.
- These stores feed the file-search agent tool, which is how agents actually consult them.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
