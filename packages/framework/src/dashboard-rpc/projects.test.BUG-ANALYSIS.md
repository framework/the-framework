# Bug analysis: packages/framework/src/dashboard-rpc/projects.test.ts

## Business logic (high-level)

One test over `onProjects`, run against the **real** registry rather than a fake: the case points
`XDG_CONFIG_HOME` at a temp directory, registers a real project through `registry.addProject`, and
then calls the RPC. That is the right call here, because `onProjects` reads its project list through
`contextProjects()` → `defaultProjectsProvider()`, which is *not* part of the wired dashboard
context and therefore cannot be faked through `provideTestContext` — only the error store can.

Per `projects.test.SPEC.md` the case pins two things: a project with a recorded error carries that
error's code, message and `since` timestamp; a healthy project carries **no** `errors` field at all
rather than an empty array. Both halves are asserted, and the negative half is asserted with
`assert.equal('errors' in clean[0]!, false, ...)` — an `in` check, so a present-but-empty array
would fail it. That is precisely the distinction `onProjects`' `found.length > 0 ?` branch exists to
make, and the test is aimed at it correctly.

**Environment hygiene.** `registered()` saves and restores `XDG_CONFIG_HOME` (including the
"was unset" case, which it restores by `delete` rather than by setting `undefined` — the correct
form, since `process.env.X = undefined` stringifies to `"undefined"`), and removes the temp tree in
`finally`. It also `realpath`s the `mkdtemp` result, which matters on macOS where `os.tmpdir()` is a
symlink and `addProject`'s `resolve()` would otherwise store a path that does not match what other
code observes. The registry module reads `XDG_CONFIG_HOME` per call (it takes `env` with a
`process.env` default) rather than caching it at import, which is what makes the swap effective —
verified by the test's own passing shape.

**Determinism.** The error store is constructed with an injected clock
(`projectErrorStore(() => new Date('2026-08-20T10:00:00.000Z'))`), so `since` is a fixed string and
the `deepEqual` is exact rather than fuzzy. No sleeps, no watchers.

**Isolation caveat.** `process.env.XDG_CONFIG_HOME` is process-global while `node:test` may run
other tests in the same process concurrently; the framework's runner appears to execute one file per
process, so the swap is contained. Also `provideTestContext` is module-global state that sticks
until the next call — this file wires it once, and any file running after it in the same process
would inherit `projectErrors: errors.list`. Both are inherent to the design (`test-context.ts`
documents the stickiness) rather than defects of this test.

## Functions (low-level)

### `registered()`
Creates a temp dir, realpaths it, swaps `XDG_CONFIG_HOME` to a fresh `cfg/` inside it, creates
`<tmp>/app`, and registers it with `addProject(project, <now>)`. Returns the project dir plus a
`restore` that puts the env var back and removes the tree. Edge: it does not create a git repo in
`app/`, which `onProjects` does not need (it lists the registry, it does not probe the checkout).
Correct.

### The case — `onProjects carries each project's recorded errors ... (#1500)`
Wires only `projectErrors` (everything else takes `provideTestContext`'s defaults), asserts one
project and no `errors` key, then `errors.set(dir, 'data-sync', '...')` and asserts the annotated
shape. `errors.set` is keyed by the project's **path**, and `onProjects` looks up
`errors(project.path)` — so the test also implicitly pins that the key is the path and not the id.
Both assertions can fail for the right reasons. Correct.

## Bugs found

1. **L34 (fix belongs in `packages/framework/src/dashboard-rpc/test-context.ts` L25):
   `provideTestContext()` spawns a real `claude -p /usage` child process this test has no use for.**
   The helper's default context builds `defaultQuotaSource()`, which starts a `QuotaPoller` polling
   immediately (`dashboard/quota.ts` L103–114) and spawns the real `claude` binary with a
   non-unref'd 20 s timeout (`driver/claude-code-quota.ts` L128–131); nothing stops it. Worse in
   this file than elsewhere: `provideTestContext` is called *while* `XDG_CONFIG_HOME` points at the
   temp registry, and `defaultQuotaSource` reads preferences (`readPreferences(undefined, env)`) off
   that same env — so the spawned poller is reading the throwaway registry too, and it outlives the
   `restore()` that deletes it. Severity: minor (test-suite side effect). Confidence: high.
   Fix: default `quota` in `provideTestContext` to an inert stub instead of `defaultQuotaSource()`.
