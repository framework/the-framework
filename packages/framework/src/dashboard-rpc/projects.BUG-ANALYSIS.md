# Bug analysis: packages/framework/src/dashboard-rpc/projects.ts

## Business logic (high-level)

The Projects sidebar plus the launcher's two pre-flight facts. Five RPCs, each a thin adapter over
something the daemon owns: the global registry (`contextProjects()` → `defaultProjectsProvider()`),
the per-project error store the background jobs write (`contextProjectErrors()`), the daemon's own
`addProject` closure, the OS folder picker, and `preflight`/`gh`.

Per `projects.SPEC.md`:

- **The list carries its own problems (#1500).** Every project is annotated with whatever the
  daemon's background jobs last recorded for it, and a healthy project carries *no* `errors` field
  at all rather than an empty array — that distinction is load-bearing for the sidebar dot, and
  `onProjects` implements it with the `found.length > 0 ?` branch instead of always spreading.
  Riding the list rather than a second read is deliberate: the list is what every project surface
  already polls.
- **Adding goes through the daemon.** The dashboard cannot install a repo or write the shared
  registry, so `sendAddProject` calls the wired closure. An empty path is refused *before* the
  closure sees it, with a typed error rather than a rejection.
- **The picker is the daemon's.** A browser cannot learn an absolute path, so `sendPickProjectDirectory`
  opens the OS dialog on the daemon's machine; dismissal is `path: null`, an unsupported platform
  says so — all of that is `pickDirectory`'s, and this module adds nothing.
- **Onboarding offers the daemon's cwd.** `onOnboarding` reports `process.cwd()` and whether a
  project is already registered for it.
- **The launcher warns before the Start.** `onDriverReady` reports only failures the user can act
  on plus warnings, never the version string or the logged-in account. `onRepoAutoMerge` answers
  `null` for an unknown project and an explicit `known:false` when `gh` cannot say — "no crying
  wolf".

**Trust boundary.** All five take browser-supplied arguments over a POST whose only guard is the
loopback/token check in the mount. `projectId` is only ever used as a lookup key against the
registry list (never joined into a path here), and `path` in `sendAddProject` is handed to the
daemon's own installer, which owns the validation. `driver` is narrowed by `isDriverName` before it
reaches `preflight`, so no arbitrary string can pick a binary to spawn — that is the one place where
an unnarrowed value would have been a command-injection-shaped hole, and it is closed.

**Cost.** `onDriverReady` runs real `execFile` probes (`<driver> --version`, the auth probe, and
with `publish` two `gh` probes), each with a 10 s timeout and no cache and no de-duplication, on
every call. The launcher form calls it as the user types/toggles. Not a correctness bug, and the
project's stance is against speculative hardening, so it is recorded here rather than reported.

## Functions (low-level)

### `onProjects()`
Reads the error store once (a closure, `projectErrors.list`), lists the projects, and annotates.
Edge cases: an empty registry → `[]`; a project the error store has never heard of →
`errors(path)` returns `[]` → the project is returned untouched (`'errors' in project === false`,
which is exactly what the test asserts). `contextProjectErrors()` throws when unwired (D3 stance),
and `contextProjects().list()` may reject on a corrupt registry — that rejection propagates to the
mount as a 500. Every other read on this surface degrades to empty instead; this one does not.
Given the registry is also what serves the whole dashboard, a corrupt registry is a hard failure
anyway. Correct.

### `sendAddProject(path)`
Captures the closure first (so an unwired context throws before any work), trims, refuses an empty
or whitespace-only path with the advertised typed error, and otherwise delegates. Note the trimmed
value is what is passed on, so a path pasted with a trailing newline works. Correct.

### `sendPickProjectDirectory()`
Pure delegation to `pickDirectory()`. Any rejection propagates rather than becoming a typed answer —
`pickDirectory` is documented to answer with a result type for dismissal and for an unsupported
platform, so a rejection here would be an unexpected fault. Correct.

### `onOnboarding()`
`process.cwd()` plus a lookup for a registered project with exactly that `path`. The comparison is
string equality against the stored path, which `addProject` normalises with `resolve()` (not
`realpath`) — but `process.cwd()` on POSIX already answers the resolved physical path, and both
sides are produced on the same machine by the same process, so the two agree. A daemon whose cwd was
deleted would make `process.cwd()` throw; that is a dead process either way. Correct.

### `onRepoAutoMerge(projectId)`
Unknown project → `null`. Otherwise the cached `gh api repos/{owner}/{repo}` read; `cached.value`
is `undefined` while the first read is still in flight, which is mapped to `{known:false,
allowed:false}` — "could not say", rendering nothing, which is the right answer for "not yet". The
5-minute TTL means a repo whose setting was just changed keeps answering the old value for up to
five minutes; the SPEC explicitly accepts the cache. Correct.

### `onDriverReady(driver, publish?)`
Narrows `driver` with `isDriverName`, silently substituting `'claude'` for anything unrecognised —
so a typo'd driver name is answered with *claude's* readiness rather than an error. The dashboard
only ever sends real driver names (they come from the same `driver-names` table), so this is a
reliance on the caller rather than a live defect; worth stating because the answer is confidently
wrong if that ever stops holding. `problems` is the failing checks (`preflightProblems`), `warnings`
is every check with `warn: true` — and since every `warn` check is constructed with `ok: true`
(`preflight.ts` L119–152), the two lists are disjoint by construction. The passing `node`/version
and `auth: 'logged in'` details never leave the daemon, as the SPEC requires. One exception to that
stance: the root warning's detail embeds `SUDO_USER` (or "your own user"), so a daemon started under
`sudo` reports the invoking OS account name to whatever browser is asking — including a relay guest.
See bug 1.

## Bugs found

1. **L97 (`warnings: result.checks.filter(c => c.warn).map(c => c.detail)`; the detail is built in
   `packages/framework/src/preflight.ts` L148–151): the root warning leaks the machine's user name
   to the browser.** `onDriverReady`'s own contract (L84–86) is that details of passing checks
   "have no business reaching a browser that may be a relay guest, so they stay on this side" — but
   the root check *is* a passing check (`ok: true, warn: true`), and its detail reads "Restart the
   daemon as `alice`, without `sudo`", where `alice` is `process.env.SUDO_USER`. Scenario: a user
   runs the daemon under `sudo` (the exact #1323 situation this warning exists for) and shares the
   dashboard over the relay; the guest's launcher renders the local account name of the host
   machine. Severity: minor (a user name, not a credential; and only under sudo). Confidence: low
   (the warning is meant to be shown, so this may be considered acceptable). Fix: keep the actionable
   sentence and drop the identity — either name the user only in the daemon's own log line and send
   "restart the daemon without `sudo`" to the browser, or have `onDriverReady` map the `root` check
   to a fixed browser-safe string.

2. **(fix belongs in `packages/framework/src/dashboard-rpc/test-context.ts` L25): the sibling test's
   `provideTestContext()` spawns the real `claude` CLI.** Recorded once, in full, in
   `preferences.BUG-ANALYSIS.md` — `projects.test.ts` is one of the callers that pays it.
