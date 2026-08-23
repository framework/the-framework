Tells the user whether the version of The Framework they are running is the newest one published, printed under the version footer of the bare `the-framework` command. Display only — nothing is ever updated automatically.

## Business logic — TL;DR

- **The published version is the reference** - the npm registry's latest release of the `framework` package is what the running version is compared against.
- **A newer release is announced with the command to get it** - the message names the newer version, the version in use, and the global install command to run.
- **Being ahead is being up to date** - a version equal to or newer than the published one reports as up to date, so running a local build ahead of the registry never reads as an available update.
- **Never in the way** - the lookup gives up after 2.5 seconds, and being offline or hitting any registry failure prints nothing at all rather than an error.
- **Version comparison without a library** - versions are compared number by number across major, minor and patch; a prerelease or build suffix is ignored, and a missing part counts as zero.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
