# Bug analysis: packages/framework/src/store/worktree-deps.test.ts

## Business logic (high-level)

Tests for the dependency-mirroring module, checked against `worktree-deps.test.SPEC.md`. Every
clause maps to a test, and each was read for whether it truly pins the behavior:

- **Scan** — finds the root tree, each workspace package's, and one nested example dir at depth 2;
  a `node_modules` at depth 3 is *not* found (the fixture includes one, and the exact expected
  list excludes it); never descends into `node_modules`, `.git`, or `.the-framework` (fixture
  plants trees inside all three and expects only the root tree). Sorted output is implicitly
  pinned by `deepEqual` on the ordered list.
- **Mirroring** — each tree lands at the same relative path as a real directory
  (`fs.isDirectory('/wt/node_modules')` true in the fake, `lstat().isDirectory()` in the real
  test) holding one link per entry with the exact `{target, path}` pairs asserted, `.bin`
  included, scoped entries (`@scope`) included.
- **Private state (#1262)** — `.pnpm`, `.modules.yaml`, `.pnpm-workspace-state-v1.json` are not
  linked; only `.bin` and the package entry are.
- **Existing tree left alone** — pre-existing `/wt/node_modules` → no links, empty return.
- **Tolerance** — a throwing `symlinkDir` still returns the tree as mirrored and does not throw;
  a throwing `mkdir` yields `[]` for that worktree. (This pins the return-value nuance noted in
  the source analysis: "mirrored" is claimed even when every entry link failed — deliberate,
  logging-only.)
- **Real-fs end-to-end (#736/#1262)** — builds an actual pnpm-shaped store
  (`node_modules/.pnpm/dep@1.0.0/node_modules/dep` with a relative package link), mirrors into a
  real worktree dir, and asserts: the worktree dir is real, its entry is a symlink, the dependency
  file reads back *through the chain* (link → parent's relative link → store), no `.pnpm` /
  `.modules.yaml` in the worktree listing, an install-like replacement in the worktree leaves the
  parent's link and file byte-identical, and a second mirror call links nothing. This is the test
  that would catch the #1262 regression class for real.

Test-craft notes:

- `fakeFs` models a set of directory paths only; every entry it returns from `readdir` is a "dir",
  including `.modules.yaml` — immaterial, since the code path under test filters by name before
  ever caring about kind, and the real-fs test covers actual files.
- `fakeFs.readdir` derives first path segments under a prefix — same faithful shape as the store
  tests' memFs.
- The tolerance test mutates `fs.symlinkDir`/`fs.mkdir` after construction — object property
  assignment on the returned literal; works because `linkDependencies` calls through the object.
- Real-fs test uses `realpath`(mkdtemp) for macOS and cleans up in `finally`. Symlink creation on
  the host is assumed permitted (POSIX CI; on Windows the `'junction'` branch would engage) —
  consistent with the repo's other real-fs tests.

## Functions (low-level)

- `fakeFs(dirs)` — in-memory `LinkFs` over a `Set<string>` plus a `links` recording array;
  `symlinkDir` records and adds the path (so `entryExists` sees it afterwards — what makes the
  idempotence assertion honest). `isDirectory`/`entryExists` are set membership. Correct for all
  exercised paths.
- Each `test(...)` body — assertions are on returned lists, recorded link pairs, and (in the
  real-fs test) on-disk lstat/readlink/readFile results; all awaited; none tautological. The
  sorted-comparison of `fs.links` uses a stable localeCompare on paths before `deepEqual` — fine.

## Bugs found

None found.
