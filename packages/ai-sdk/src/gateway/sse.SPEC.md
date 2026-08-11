Splits a streaming gateway response into discrete server-sent events for the adapter to decode.

## TLDR

- Buffers across network reads, so an event split mid-frame is reassembled and a final event missing its terminator still arrives when the stream closes.
- Keep-alive comments and irrelevant fields are consumed and ignored rather than treated as data.
- Cancelling — or a consumer stopping early — closes the underlying connection instead of leaving it pinned open until the server times out.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
