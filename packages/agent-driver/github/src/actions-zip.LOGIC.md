Reads every file out of the zip archive GitHub hands back when a run's artifact is downloaded, since the artifact download is the one channel out of a GitHub Actions run that the `github-actions` driver can read and GitHub always answers with a zip, even for a single file. It reads only what the upload-artifact action writes, stored or deflated entries, and refuses anything else rather than returning a partial archive: a transcript silently cut short would read as an agent that said less than it did. It is an implementation detail of the driver in `actions.ts`, not product API.

## Business logic — TL;DR

- **Every entry, by the authoritative listing** - the archive's central directory names every file with its size and compression, so each entry is read from there, never by scanning for file headers whose sizes may be deferred.
- **Stored or deflated, nothing else** - an entry stored as is, or compressed with deflate, is decompressed; any other compression method fails the read, naming the file, as does a header that is not where the listing says.
- **Not an archive is refused** - bytes too short to be an archive, or without the record that closes an archive, fail the read outright; an archive ending in a comment is still read, since the closing record is searched backwards past the comment.
