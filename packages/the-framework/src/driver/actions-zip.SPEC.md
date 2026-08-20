Reads the archive a GitHub Actions run uploads — the only channel the transcript can come back through — and refuses anything it does not fully understand.

## Rationales

- A refused read beats a partial one: a silently-short transcript would read as an agent that said less than it did.
- The reader is internal to the driver, deliberately off the package's public surface: an accidental export is a one-way door once released.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
