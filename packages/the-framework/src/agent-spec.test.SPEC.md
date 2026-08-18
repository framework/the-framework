Covers the session spec as a process API: a round-trip that keeps every value, an explicit `false` surviving where argv could only say present-or-absent, the file and its private directory being consumed as they are read so a device token does not outlive its agent and nothing accumulates per session, a hand-written spec losing only the file and never the user's directory (even one named like ours outside the spec home), a spec whose child never ran being removable by the spawner, a malformed or absent file being refused rather than half-run, a spec with no options reading as empty rather than undefined, and two concurrent starts never sharing a file.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
