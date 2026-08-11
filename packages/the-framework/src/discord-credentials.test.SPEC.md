Covers the Discord credential rules: the environment wins over a stored value (and a blank one shadows nothing), status reports presence and origin but never the value itself, validation rejects only what could not possibly work, and the store saves, clears, applies changes to the running daemon after the write, and refuses env-owned or invalid values without half-applying anything.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
