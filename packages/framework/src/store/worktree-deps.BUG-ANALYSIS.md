# Bug analysis: packages/framework/src/store/worktree-deps.ts

## Business logic (high-level)

Gives a fresh worktree a working dependency tree by mirroring each of the parent checkout's
`node_modules` directories as a *real directory of per-entry symlinks* (#736/#1262). Checked
against `worktree-deps.SPEC.md`:

- **Shared, not copied** — `findDependencyDirs` scans the repo root and down to `MAX_DEPTH = 2`
  (so `packages/<pkg>/node_modules` is found: the check runs on entry at depth 2, descent stops
  after), never descending into `node_modules`, `.git`, `.the-framework`, `dist`, `build`,
  `coverage`, or any dot-dir. Results are repo-relative and sorted for stable order. Matches the
  spec ("root and every directory down to two levels below").
- **Real directory of links, never a linked directory** — `linkDependencies` mkdirs the worktree's
  own directory (creating missing parents, e.g. an untracked package dir) and links each entry of
  the parent's tree individually with absolute targets. This is the #1262 fix: an install in the
  worktree rewrites the worktree's entries and can never resolve through to rewrite/purge the
  parent's tree. A pnpm package entry is itself a relative link into `.pnpm`; the worktree's
  absolute link points at that link's *location in the parent*, so it resolves in the parent
  store — verified by the sibling test against a real pnpm-shaped tree.
- **Private state stays behind** — `isPrivate`: every dot-entry except `.bin` (`.pnpm`,
  `.modules.yaml`, `.pnpm-workspace-state-v1.json`, …) is skipped, so the package manager never
  believes the worktree's tree is its own install; `.bin` is linked because agents run the
  project's tools (its inner relative links resolve at their real location, the parent — correct).
- **Never fatal** — a tree already present in the worktree (including a dangling entry —
  `entryExists` is an `lstat`) is left alone (the agent may have installed); each per-entry
  symlink failure is swallowed; a mkdir/readdir failure skips that tree. A worktree with no deps
  is a worse run, not a failed one.

Edge cases considered:

- Idempotence: second call finds `entryExists(dir)` true and links nothing (test-pinned).
- Windows: `symlinkDir` uses `'junction'` (no elevation needed); junction targets are the absolute
  `join(source, name)` paths — valid.
- Concurrent agent install racing the linker: per-entry and per-tree catches make the race lose
  gracefully (comment says exactly this).
- `git add -A` in the worktree: the mirrored directory is a real dir whose name (`node_modules`)
  the repo's own ignore rules cover — the same rule that hides the parent's tree; if a repo does
  not ignore `node_modules` at all, the parent's tree is equally tracked, so nothing new leaks.
- A workspace package literally named `dist`/`build`/`coverage` would be skipped by the scan and
  get no deps — a deliberate cost of not walking build outputs; "worse run, not failed", in spec.
- Return value: a tree whose directory was created but whose every entry-link failed still counts
  as "mirrored" (test at worktree-deps.test.ts L125–135 pins this) — the return is only ever used
  for logging, so the slight overstatement is accepted, noted here rather than reported.

## Functions (low-level)

- `NODE_MODULES`, `MAX_DEPTH`, `SKIP`, `BIN` — constants as described; `SKIP` includes
  `FRAMEWORK_DIR` so sibling worktrees under `.the-framework/branches/` are never scanned (their
  linked trees would explode the walk). Correct.
- `isPrivate(name)` — `startsWith('.') && name !== '.bin'`. Correct per spec.
- `nodeLinkFs()` — dynamic `node:fs/promises` per the package convention; `readdir` catches to
  `[]`, `isDirectory` stats (follows links — so a *symlinked* `node_modules` in the parent still
  counts as a tree, fine), `entryExists` lstats (does not follow — so a dangling prior link
  blocks re-linking, the conservative direction), `mkdir` recursive, `symlinkDir` junction on
  win32. Correct.
- `findDependencyDirs(repo, fs)` — recursive walk as analyzed; empty repo → `[]`; `relative()`
  over paths it built itself, so no `..` results. Sequential awaits — O(dirs) stats, bounded by
  depth 2. Correct.
- `linkDependencies(repo, worktree, fs)` — per-tree try/catch, per-entry catch, skip-existing,
  returns mirrored rels. Correct (with the return-value nuance noted above).

## Bugs found

None found.
