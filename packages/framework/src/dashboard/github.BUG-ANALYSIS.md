# Bug analysis: packages/framework/src/dashboard/github.ts

## Business logic (high-level)

Turns a repo's `origin` remote into either an `https://github.com/<owner>/<repo>` URL (the panel's
"Open on GitHub", #489) or an `{ owner, repo }` pair (#1050). Four functions: a pure normalizer, a
pure slug splitter built on it, and the two `git remote get-url origin` wrappers.

**Design.** Everything is derived from one regex trio plus one validity check, so the URL form and
the slug form can never disagree: `githubSlugFromRemote` calls `githubUrlFromRemote` and splits its
output rather than re-parsing the remote. That is the right shape — two parsers here would be exactly
the drift this codebase avoids elsewhere.

**Failure stance.** Non-GitHub remotes, junk, no remote at all, and a failing `git` all resolve
`undefined`. The panel simply does not render the link. Nothing throws, which matters because both
async forms sit on a poll path.

**What the three forms cover:**
- scp-style `git@github.com:owner/repo(.git)`
- ssh `ssh://git@github.com/owner/repo(.git)`
- https `https://[user@]github.com/owner/repo(.git)`, with the credential dropped by `[^@/]+@`

**The validity check is what makes it safe.** After stripping, `^[^/]+\/[^/]+$` requires exactly one
slash with non-empty sides, so `https://github.com/` (empty), `https://github.com/only-owner` (no
slash) and `https://github.com/o/r/tree/main` (two slashes) all yield `undefined` rather than a
half-formed link. Without it the lazy `(.+?)$` capture would happily hand back anything.

**Non-bugs worth naming:**
- The host match is case-sensitive, so `git@GitHub.com:o/r.git` is not recognised. Git normalises
  hostnames nowhere, but no tooling in this repo writes a mixed-case remote.
- `ssh://git@github.com:22/o/r.git` (an explicit port) is not recognised — the regex requires `/`
  directly after the host. Rare, and the consequence is only a missing link.
- The strip order is `.git` then trailing `/`, so the pathological `https://github.com/o/r.git/`
  yields `https://github.com/o/r.git`. git does not write that form.
- `git://github.com/o/r.git` and `github.com/o/r` are not recognised. Same consequence.

All four degrade to "no link", never to a wrong link, which is the property that matters for
something the user clicks.

## Functions (low-level)

### `githubUrlFromRemote(remote)` (L13-24)

*Input:* a raw remote string (possibly with a trailing newline from `git`). *Output:* a canonical URL
or `undefined`.

- `remote.trim()` handles the newline `git remote get-url` emits — pinned at `github.test.ts:12`.
- The three alternatives are tried in order; each is fully anchored (`^`…`$`), so no partial match can
  slip through. The lazy `(.+?)` with a `$` anchor behaves identically to a greedy one; harmless.
- `''` → no match → `undefined`.
- `'git@gitlab.com:o/r.git'`, `'https://example.com/o/r.git'` → `undefined`.
- `'https://github.com/'` → captures `''`? No — `(.+?)` needs at least one character, so the match
  fails outright → `undefined`. Pinned at `github.test.ts:18`.
- `'https://github.com/only-owner'` → captures `only-owner` → fails `^[^/]+\/[^/]+$` → `undefined`.
- `'https://user@github.com/o/r.git'` → the credential group consumes `user@` → `o/r`. Note the group
  is `[^@/]+@`, so a credential containing `@` (a `user:p@ss@host` form) would not match; git does not
  store passwords in remotes here.
- Trailing `.git` and trailing `/` both stripped.
- `match[1]` is re-checked for truthiness at L19 even though `(.+?)` guarantees it — dead but harmless.

*Verdict:* correct.

### `githubUrlFor(cwd, git)` (L27-33)

Wraps `git remote get-url origin` in try/catch. A repo with no `origin` makes git exit non-zero →
`undefined`. A non-repo → same. *Verdict:* correct.

### `githubSlugFromRemote(remote)` (L36-41)

Slices off the fixed `https://github.com/` prefix (safe: the value was just constructed with it) and
splits on `/`. Because `githubUrlFromRemote` already enforced exactly one slash with non-empty sides,
the destructuring cannot produce an empty part — the `owner && repo` guard is belt-and-braces.
Extra elements are impossible for the same reason. *Verdict:* correct.

### `githubSlugFor(cwd, git)` (L44-49)

Same wrapper as `githubUrlFor`, over the slug form. Duplicated try/catch rather than
`githubSlugFromRemote(await githubUrlFor(...))` — a deliberate five-line duplication that keeps each
entry point one call deep. *Verdict:* correct.

## Bugs found

None found.
