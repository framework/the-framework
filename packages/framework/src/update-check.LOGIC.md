Tells the user, after the CLI prints its version, whether a newer version of the `framework` package is published on npm. Display only: nothing is ever updated automatically. The latest published version is read from the npm registry's record of the package (its `latest` tag), with 2.5 seconds to answer; any failure, a non-success answer, or being offline yields "unknown", and unknown prints nothing at all.

## Business logic — TL;DR

- **Comparing versions** - two versions compare numerically part by part, so `1.9.0` is older than `1.10.0`; a prerelease or build suffix (after `-` or `+`) is ignored and a missing part reads as zero.
- **Up to date, or an update available** - a current version equal to or ahead of the published one is up to date, so a local build ahead of the registry never reads as an update being available; only a strictly newer published version is an update available.
- **The printed line** - "✅ Up to date (v<current>)", or "⬆️  Update available: v<latest> (you have v<current>). Run: npm i -g framework"; nothing when the check could not be made.
