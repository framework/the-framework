What the tests cover, against archives assembled byte for byte as the upload-artifact action writes them:

- **Deflated entries** - the transcript and the branch metadata come out of a deflated archive by name and with their exact contents, including a transcript large enough to span more than one deflate block.
- **Stored entries** - a tiny file the action stores uncompressed is read as is.
- **Not an archive** - bytes that are not a zip archive, or too short to be one, fail the read instead of being read short.
- **A trailing comment** - an archive carrying a comment after its closing record is still read.
