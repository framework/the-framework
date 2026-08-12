Runs the SDK's hosted document stores on Gemini — create and manage stores, add and remove documents — with Google chunking, embedding, and indexing everything server-side.

## TLDR

- A document arrives either by pointing at a file already in Google's file storage or by direct upload; ingestion is a background job on Google's side, so adding by default waits until indexing finishes or a time budget runs out — or returns immediately on request.
- Per-document attributes round-trip through Gemini's metadata form; booleans travel as the words "true" and "false" (Gemini has no boolean) and are recognized again on the way back.
- Store-level metadata and expiry don't exist on Gemini, so asking for them fails loudly rather than silently losing data.
- Deleting a store drops its documents with it, matching OpenAI's behavior.
- This is a Gemini-only offering — not available through Vertex AI.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
