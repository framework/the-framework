# Bug analysis: packages/framework/src/update-check.ts

## Business logic (high-level)

A display-only "are you running the newest published version?" check for the bare CLI's version
footer (#312). Four pieces: the registry key, a network seam, a dependency-free version comparison,
and the message formatter. Nothing here ever updates anything.

Invariants, against `update-check.SPEC.md`:

- **The published version is the reference.** `PACKAGE_NAME = 'framework'` matches
  `packages/framework/package.json`'s `"name": "framework"`, so the packument URL and the
  `npm i -g framework` line in the message both address the package this CLI actually ships as.
  (Worth checking explicitly, because the repo also refers to `@gemstack/the-framework` in older
  comments; the manifest is the authority and it says `framework`.)
- **Being ahead is being up to date.** `checkForUpdate` only reports an update when
  `compareVersions(latest, current) > 0`, so a local build ahead of the registry reads as
  up-to-date rather than as a downgrade prompt.
- **Never in the way.** A 2.5s `AbortSignal.timeout`, a `try/catch` around the whole fetch, a
  non-`ok` response, a non-string `dist-tags.latest`, and a falsy fetch result all funnel to
  `unknown`, whose message is `undefined` — i.e. nothing is printed. `cli.ts` L1369 is the single
  caller and passes the node fetcher by default with a test seam.
- **No semver dependency.** Numeric component-wise comparison with suffix stripping.

There is no state, no concurrency, and the only external effect is one GET.

## Functions (low-level)

### `PACKAGE_NAME` (L9)

Constant, matches the manifest. Correct.

### `nodeVersionFetcher()` (L19)

Returns a `VersionFetcher` that GETs `https://registry.npmjs.org/<pkg>` with a 2.5s timeout signal
and reads `dist-tags.latest`.

- `pkg` is interpolated into the URL unescaped, but the only values are the module's own constant
  and, in the test seam, a literal — no injection surface.
- The timeout signal also aborts the body read, so a stalled `res.json()` cannot hang past 2.5s.
- Any throw (offline, DNS, abort, invalid JSON), a non-`ok` status, and a non-string `latest` all
  yield `undefined`.
- It downloads the full packument rather than `/<pkg>/latest`; wasteful but bounded by the timeout,
  and not a correctness issue.
- Verdict: correct.

### `compareVersions(a, b)` (L44)

Splits off anything from the first `-` or `+`, splits on `.`, maps each part with
`parseInt(n, 10) || 0`, then compares component-wise up to the longer length with missing parts as
0.

- `'1.9.0'` vs `'1.10.0'` → numeric, not lexicographic. Correct.
- `'1.2'` vs `'1.2.0'` → 0. Correct per SPEC ("a missing part counts as zero").
- `'1.2.3-beta.1'` vs `'1.2.3'` → 0. Per SPEC the suffix is ignored, so a prerelease of the *same*
  release reads as up-to-date. Semver would call the prerelease older, but the SPEC is explicit and
  the test pins it — intended, not a defect.
- `parseInt('') || 0` and `parseInt('x') || 0` are both 0, so garbage compares as 0 rather than
  producing `NaN` (which would make every comparison return `1` via the `na !== nb` branch). The
  `|| 0` is load-bearing.
- `parseInt('01', 10)` → 1; `parseInt('1abc', 10)` → 1. Lenient, harmless.
- Verdict: correct.

### `checkForUpdate(current, fetchLatest, pkg)` (L63)

Awaits the fetcher, maps a falsy result to `unknown`, otherwise compares. Note the guard is
`if (!latest)`, so an empty-string version also degrades to `unknown` rather than comparing as
`0.0.0` — the right call. `pkg` defaults to `PACKAGE_NAME` and is forwarded to the fetcher. Never
throws as long as the injected fetcher does not; `nodeVersionFetcher` never does, and `cli.ts`
documents that this call is already forgiving. Verdict: correct.

### `formatUpdateStatus(status)` (L76)

Exhaustive switch over the three kinds; `unknown` → `undefined` so nothing prints. The
update-available line names the new version, the current one, and the exact install command, as the
SPEC requires. Verdict: correct.

## Bugs found

None found.
