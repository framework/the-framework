Dependency-free SSE framer — async generator turning a `text/event-stream` `ReadableStream` body into `SseEvent`s (`{ event?, data }`).

## TLDR

- Handles `\n` and `\r\n` endings (CRLF normalized before splitting), multi-line `data:` payloads joined with `\n`, events split across network reads (buffered until the blank-line separator), and a trailing event with no final blank line (flushed at stream close).
- Only `event:` and `data:` are surfaced — comments (`:`-prefixed), `id:`, `retry:`, and unknown fields are consumed and ignored; the spec's single leading space after the colon is stripped.
- Abort support: `signal` cancels the reader and ends iteration; the `finally` block cancels (not merely releases) the reader so early consumer exits (a `stopWhen`, approval pause, or `break`) don't pin the upstream socket until server timeout.

## Decisions

- Standalone framing on purpose: every built-in chat provider streams through a vendor SDK, so there is no shared framer for the gateway template to reuse.

## Facts

- A frame with neither `data:` nor `event:` parses to `null` and is skipped.
