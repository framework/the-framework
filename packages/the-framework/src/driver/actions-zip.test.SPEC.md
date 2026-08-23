What the tests cover: an artifact downloaded from a GitHub Actions run yields every file it contains, in order and with its exact contents, whether the files were compressed or stored uncompressed; a transcript far larger than one compression block comes back whole; an archive carrying a trailing comment is still read correctly; and bytes that are not an archive at all are rejected outright rather than read as an empty or partial transcript.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
