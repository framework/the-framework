Talks to Google's Gemini chat models — one-shot or streamed — translating the neutral conversation, tools, and cache markers into Gemini's dialect and Gemini's answers back.

## TLDR

- System messages, attachments, tool calls, and tool results are reshaped to what Gemini expects; PDFs travel as raw documents, other documents as plain text.
- Prompt regions the agent marked cacheable are stored with Google once through the shared cache registry, and later requests send only what the cached copy doesn't already hold; if Google has meanwhile expired that copy, it is forgotten and the request retried once from scratch.
- Web search and file search run as Gemini's own built-in tools instead of ordinary function calls; a native-tool request Gemini doesn't recognize degrades to a plain function tool.
- Truncation and safety stops are reported honestly rather than as a clean finish.

## Rationales

- Gemini gives tool calls no ids, so the adapter invents them — and when sending results back it translates each id to the original function name, without which the model can't pair a result with its call.
- Gemini reports a normal stop even on tool-call turns, so "called a tool" is deduced from the answer's content, not from the reported reason.
- A cached request drops only what the cached copy actually absorbed — caching two messages caches neither instructions nor tools, so both still go on the wire.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
