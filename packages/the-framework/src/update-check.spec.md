The CLI's "up-to-date?" check (#312): after the bare-`framework` version footer, tell the user whether a newer `@gemstack/the-framework` is on npm. Display only; auto-update is deferred.

## TLDR

- `nodeVersionFetcher()`: GETs the npm packument, reads `dist-tags.latest`, capped by a 2.5s `AbortSignal.timeout`; any error/non-ok/offline yields `undefined` (silently degrades to `unknown`, which `formatUpdateStatus` prints as nothing).
- `compareVersions()`: numeric `major.minor.patch` compare, prerelease/build suffix stripped, missing parts read as 0 — no semver dependency.
- `checkForUpdate()`: `current >= latest` is `up-to-date`, so running a local build ahead of the registry never reads as "update available". Same seam + node-adapter + forgiving-on-error convention as `project.ts` (#380).
