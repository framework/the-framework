Reads and writes the two Discord credentials in the user's registry file, and tells the running daemon when they change so a pasted token works without a restart.

## Flows

- A credential set in the daemon's environment cannot be edited here: the save is refused with an explanation instead.
- A save validates first and applies all-or-nothing; the reload runs only after the write has landed, and a reload that fails never fails the save — the credential is stored and the next daemon start uses it.

## Rationales

- A save over an env-owned credential is refused because the write would be silently shadowed on the next read.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
