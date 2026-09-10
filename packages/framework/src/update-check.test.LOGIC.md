What the tests cover:

- **Comparing versions** - equal versions compare equal; parts compare numerically and not as text (`1.9.0` is older than `1.10.0`); a higher major wins over any minor and patch; a prerelease or build suffix is ignored; a missing part reads as zero.
- **The check** - the same version is up to date; a newer published version is an available update naming it; a published version older than the current one, a local build ahead of the registry, is up to date; a lookup that fails is unknown; the lookup is made for the `framework` package unless another package is named.
- **The printed line** - "✅ Up to date (v<current>)"; "⬆️  Update available: v<latest> (you have v<current>). Run: npm i -g framework"; nothing at all when the check is unknown.
