Node-only helpers loading attachments from local file paths: `documentFromPath()` / `imageFromPath()` read the file, base64-encode it, and construct `DocumentAttachment` / `ImageAttachment` via their `fromBase64` factories.

## Facts

- MIME type is sniffed from the file extension against a small static map (png/jpg/jpeg/gif/webp/svg/pdf/txt/md/json/csv/html/xml); unknown extensions fall back to `application/octet-stream`.
- `documentFromPath` passes the basename as the attachment filename.
