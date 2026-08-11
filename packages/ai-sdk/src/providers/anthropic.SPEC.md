Connects the framework to Anthropic's Claude models: chat with tools and streaming, prompt caching, and file storage.

## TLDR

- Translates the neutral conversation into Anthropic's shape: system messages move into the dedicated system instruction, tool calls and tool results become Anthropic's message blocks, and images and PDFs are attached natively.
- On request, marks the instructions, the tools, and/or the leading messages for Anthropic's prompt cache, so repeated context is billed at cheap cache rates on later calls.
- Tools hinted as computer-use or web-search become Anthropic's purpose-built tool kinds — Claude performs far better with those than with generic function-calling, and web search runs entirely on Anthropic's side.
- Answers are normalized back to neutral text, tool calls, and token usage, with a finish reason that tells a complete answer apart from a truncated or refused one.
- Also uploads, lists, downloads, and deletes files in Anthropic's file storage.

## Rationales

- The translation logic is shared with the Bedrock provider, which serves the same Claude models through AWS.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
