Says what kind of file a browser is being handed, from the file's extension, for both places The Framework serves files from: the dashboard app itself and a project's preview. Unknown extensions are served as plain bytes.

## Rationales

The two servers share this one lookup so their answers cannot drift apart — they had each grown a list the other was missing entries from. Everything else about how those two serve files stays their own.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
