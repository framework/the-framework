What the tests cover:

- **An output that fits** - it is kept whole, without its blank end, up to exactly the size limit.
- **An output past the limit** - its first half-limit and its last half-limit are kept, with one line between them saying how many characters were cut.
- **A call's argument** - a missing or blank one gives nothing; a short one-line one gives the detail alone; one of several lines, or a long one, gives the detail and the argument whole; the whole argument has the size limit of an output.
- **The lines of a text** - an empty text holds none; a last line counts with or without its line break; an empty line in the middle counts.
- **The lines of a patch** - the added and the removed lines are counted; a context line and the "no newline at end of file" line are not; a removed line and an added line whose own text starts with `--` or `++` are counted; an empty patch adds and removes nothing.
- **The lines of a diff's hunks** - a unified diff gives its lines from its first hunk on, without its file headers, with or without a `diff` and an `index` line first; a file's own content, one holding a line like a hunk's, a header with no hunk and an empty text are no diff.
