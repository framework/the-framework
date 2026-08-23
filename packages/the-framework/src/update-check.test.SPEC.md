What the tests cover: comparing the running version of The Framework against the newest published one, and what the user is told about it.

- **Version comparison** - versions compare number by number rather than as text, so 1.9.0 ranks below 1.10.0; a higher major wins over any lower one; a prerelease or build suffix is ignored; and a missing part counts as zero.
- **The verdict** - the same version as published is up to date, a higher published version is an available update and names it, and a running version ahead of the published one still reports as up to date. A lookup that comes back with nothing reports the state as unknown. The `framework` package is the one looked up by default.
- **The message** - up to date and update-available each print one line, the latter naming the newer version, the version in use and the global install command; an unknown state prints nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
