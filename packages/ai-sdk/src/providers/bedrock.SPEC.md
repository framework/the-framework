Serves Anthropic's Claude models through AWS Bedrock, for teams that keep their AI traffic on AWS.

## TLDR

- Shares the Anthropic provider's translation and stream mapping, so conversations, tools, caching, and answers behave exactly as with Anthropic directly — only the transport and sign-in differ.
- Signs in through the standard AWS credential chain (environment, roles, config files) rather than an API key, so the same code works across dev and prod; explicit credentials are a niche escape hatch.
- Only Claude models are supported for now; any other model family on Bedrock is rejected up front with an error saying so.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
