Talks to OpenAI's chat models — one-shot or streamed — translating the neutral conversation, tools, and cache markers into OpenAI's dialect and the answers back; every OpenAI-compatible vendor reuses this one translation.

## TLDR

- Attachments reshape to the wire: images travel inline, PDFs as documents, other document types as their plain text.
- Before sending, the transcript is repaired to OpenAI's strict rule that every tool call be answered in place: stray results move next to their calls, missing ones get a stub, and results whose call no longer exists anywhere are dropped.
- Prompt regions marked cacheable become a stable cache key that steers repeat requests to a server already holding the prefix.
- File search runs as OpenAI's own built-in tool instead of a wrapped function call.
- Truncation and content-filter stops are reported honestly rather than as a clean finish.

## Rationales

- The answered-in-place rule breaks exactly when a run pauses and resumes (browser tools, approval round-trips) — repairing beats rejecting, and already-clean transcripts pass through untouched.
- When streaming, OpenAI sends token usage only on request and only after the finish signal, so the finish is held back until usage lands — streamed calls still count against budgets.
- Streamed tool-call fragments carry a position marker so several tools called at once each reassemble from their own fragments.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
