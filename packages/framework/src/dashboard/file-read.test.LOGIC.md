What the tests cover, against real files on disk:

- **A file's contents** - a file comes back as its text without a trailing blank line; a file longer than the 500-line cap is cut to the cap and flagged as cut; a binary file is reported as binary with no text; an empty file yields an empty text rather than nothing; a file that is not there yields nothing.
- **Containment** - a traversing path, an absolute path and a path into `.git` are refused; a symlink inside the checkout that points to a file outside it is refused, even though the path itself looks plain.
- **Path safety** - the guard accepts a plain repository-relative path and rejects an empty path, traversal, an absolute path, a Windows drive path, a leading dash, `.git/config` and a NUL byte.
