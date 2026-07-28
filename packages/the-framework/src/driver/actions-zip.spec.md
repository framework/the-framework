Minimal dependency-free zip reader used to unpack GitHub Actions artifact downloads, which the artifact API always returns as a zip (#610).

## TLDR

- `readZip(buf)` returns every `{name, data}` entry; walks the central directory (authoritative — local headers may defer sizes to data descriptors), then reads each entry via its local header.
- Supports only what `upload-artifact` writes: stored (method 0) and deflated (method 8) entries; no zip64, no encryption.
- Throws on anything unrecognized rather than returning a partial archive — a silently-short transcript would read as an agent that said less than it did.

## Decisions

- Hand-rolled (~60 lines) because Node ships deflate but no zip, and the framework has no runtime dependencies worth adding for this one job.
- EOCD located at the exact end first (common case), then scanned backwards at most 0xffff bytes (max zip comment length).
