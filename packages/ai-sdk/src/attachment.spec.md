Builders for document/image attachments plus message-content helpers.

## TLDR

- `DocumentAttachment` / `ImageAttachment`: private constructors with `fromString` (documents only, base64-encodes as `text/plain`), `fromBase64`, and async `fromUrl` (fetches, infers mimeType from `content-type` header, defaults `application/octet-stream` / `image/png`); both convert via `toAttachment()` / `toContentPart()`.
- `attachmentsToContentParts()` maps `Attachment[]` to `ContentPart[]` for building user messages (used by `agent.ts`).
- `getMessageText()` extracts text from `string | ContentPart[]` content (concatenates `text` parts) — used to build `AgentResponse.text`.

## Facts

- Data is always stored base64-encoded; `fromUrl` derives the document name from the URL's last path segment (query stripped).
