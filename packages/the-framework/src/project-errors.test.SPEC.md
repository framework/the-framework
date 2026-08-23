What the tests cover: a project with nothing recorded reports no errors; a recorded error keeps its kind, its detail message and the time it was first seen; re-reporting the same kind for the same project replaces the detail message but keeps the original timestamp, so a condition re-checked every minute still shows its true age; clearing removes the error and clearing something never recorded does nothing; once cleared, a later report of the same kind starts a fresh timestamp; errors recorded against one project never show up on another.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
