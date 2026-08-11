Translates Anthropic's live streaming events into the framework's neutral stream chunks; shared by the Anthropic and Bedrock providers.

## TLDR

- Streams text as it arrives, announces tool calls and their incrementally arriving arguments, and ends with a finish chunk carrying the finish reason and complete token usage.
- Anthropic reports prompt and completion token counts at opposite ends of the stream, so the mapper remembers the early prompt count — without it, billing and budget tracking would silently undercount streamed calls.
- A truncated or refused streamed answer is flagged as such instead of looking like a clean stop.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
