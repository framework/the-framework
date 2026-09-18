What the tests cover, against real files:

- **A fresh file** - a project with the dashboard's directory and no hooks file gets all six keys, and the file reads back as exactly this tool's lines.
- **A person's file** - a comment, an `open` list with another line and a `start` line of their own: the comment stays first, the list gains this tool's line after theirs, their `start` is kept and named in `kept`, the missing keys are added; a second `init` adds nothing and leaves the file byte for byte.
- **Refusals** - no dashboard directory answers `no-dashboard` and creates no file; a file YAML cannot parse answers `unreadable` and is left unchanged.
