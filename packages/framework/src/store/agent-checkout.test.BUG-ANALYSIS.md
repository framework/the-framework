# Bug analysis: packages/framework/src/store/agent-checkout.test.ts

## Business logic (high-level)

Six tests over `resolveAgentEventsPath` — which event journal a view scoped to one agent follows. The
file deliberately uses a real throwaway project directory under `tmpdir()` rather than a memory fs,
because the resolution probes the real filesystem (`nodeFs().isDirectory`, and `archivedAgentPaths`'s
`readdir`/`exists`), and a fake would not exercise the probe that the whole design hangs on.

Behaviours pinned, matching the sibling `.test.SPEC.md` one for one:

1. A missing id **and** an unsafe id (`'../escape'`) fall back to the root journal — the path-traversal
   guard, asserted by value rather than by "does not throw", so a regression that let the id reach
   `join` would produce a different string and fail.
2. An existing worktree directory wins, with no `agent.json` written anywhere — this is the #766 case
   (the directory exists before the agent's first status write), so the test genuinely covers the probe
   rather than the live-meta path.
3. An ended agent (worktree gone) resolves to its archived `<id>.jsonl` in the transient
   `.the-framework/agents/`, not the root journal (#1472).
4. The same, for an archive filed under a *user* directory on the data branch
   (`.the-framework/branches/tf-data/agents/someone`) — this exercises `archiveDirs`'s
   committed-archive scan, including the "a directory is recognised by having a readable child" rule,
   because `seedArchive` writes two files into it.
5. A live worktree beats a stale archive from an earlier stint (a resumed agent) — the ordering
   assertion; without it, swapping the archive step ahead of the worktree probe would pass tests 1-4.
6. An id with neither worktree nor archive keeps the root-journal fallback, so a just-started root
   agent still streams.

Do the tests verify what they claim? Yes. Every assertion compares against a path built from the same
helpers the source uses (`worktreePath`, `FRAMEWORK_DIR`, `EVENTS_FILE`, `ARCHIVE_DIR`), so a rename of
any of those cannot silently make the tests vacuous, and `seedArchive` returns the exact events path it
wrote so test 3/4 compare against a real file rather than a re-derived guess. Every call is awaited
inside the `try`, and each test's `finally` removes the temp tree with `{ recursive: true, force: true }`,
so a failure cannot leak a directory or leave an unhandled rejection. No test can pass without the code
under test doing work — each one asserts a *specific* one of the four possible outcomes, and the six
outcomes are mutually distinguishable strings.

Gaps (coverage, not defects): the live-meta branch (`readLiveMetas` → `agent.cwd`) is never exercised
here — no test writes an `agent.json`, so probe 1 and its read-time self-heal are covered elsewhere
(`agent-store.test.ts`); and `resolveAgentCheckout`, the sibling export, has no test in this file at all,
though it is the same three probes minus the archive step. The `RUN_ID` used is a well-formed
`agentIdFromStartedAt` shape, so nothing checks a syntactically valid but non-timestamp id — irrelevant,
since resolution never parses the id as a date.

## Functions (low-level)

- `makeProject()` — `mkdtemp` under `tmpdir()` plus an empty `.the-framework/`, so the root journal's
  parent exists while the journal itself does not (matching a project that has never run an agent).
  Note it does **not** `realpath` the temp dir; that is safe here because every expected path is derived
  from the same `cwd` value rather than from anything the code resolves, so a symlinked `/tmp` cannot
  cause a mismatch. Correct.
- `rootJournal(cwd)` — mirrors the source's `join(projectCwd, FRAMEWORK_DIR, EVENTS_FILE)`. Correct.
- `seedArchive(cwd, agentsDir)` — writes both `<RUN_ID>.json` (which `findArchive` keys on) and
  `<RUN_ID>.jsonl` (which is returned), and returns the events path. Writing both matters for test 4:
  `archiveDirs` only accepts a user directory whose `readdir` is non-empty. Correct.
- Test L31 (`no run id (and unsafe ids)`) — two assertions, both by value. Correct.
- Test L41 (`an existing worktree`) — creates only the directory, proving the disk probe rather than a
  meta lookup answers. Correct.
- Test L52 (`an ended run resolves to its archived log`) — no worktree created, so the probe must fail
  before the archive is consulted. Correct.
- Test L62 (`an archive filed under a user dir`) — hard-codes `'tf-data'`, which matches
  `DATA_BRANCH` in `branch-names.ts`; a rename of that constant would break this test loudly rather than
  silently, which is acceptable. Correct.
- Test L72 (`a live worktree beats a stale archive`) — the ordering test; seeds both and expects the
  worktree. Correct.
- Test L84 (`an unknown id with no archive`) — the residual fallback. Correct.

## Bugs found

None found.
