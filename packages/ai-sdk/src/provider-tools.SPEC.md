Ready-made web-search, web-fetch, and code-execution tools that use the provider's native capability when it has one and degrade gracefully when it doesn't.

## TLDR

- Web search runs natively on providers that offer it, with optional domain and result-count limits; providers without it fall back to a plain server-side search.
- Web fetch downloads a page and hands the model its plain text, capped in length; fetched HTML is reduced to text with script and style content removed first.
- Code execution deliberately has no fallback — without a provider-native sandbox it returns an error rather than running untrusted code on the server.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
