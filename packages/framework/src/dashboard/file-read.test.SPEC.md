What the tests cover: an unchanged file's preview returns its text without turning the trailing newline into a blank line; a long file is cut at the preview limit and marked; a binary file is flagged instead of rendered; an empty file yields an empty preview rather than nothing; traversing, absolute, and `.git` paths are refused; a repo-relative symlink pointing out of the checkout is refused even though it passes the textual guard — the reason the confined read re-checks after resolving; a missing file yields nothing; and the shared path guard rejects every shape that is not a plain repo-relative path.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
