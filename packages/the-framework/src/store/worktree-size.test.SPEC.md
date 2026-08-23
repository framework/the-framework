What the tests cover: reading a worktree's size on disk, which only ever labels a "remove this" button, so every failure must come back as unknown rather than as a throw or a wrong number.

- The measured size is reported in bytes.
- A real directory reads back as a plausible size, or as unknown on a platform that cannot measure it.
- A measurement that fails, and output that cannot be understood, both report unknown.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
