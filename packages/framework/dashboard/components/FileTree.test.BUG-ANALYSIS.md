# Bug analysis: packages/framework/dashboard/components/FileTree.test.tsx

## Business logic (high-level)

Covers exactly what `FileTree.test.SPEC.md` claims — the worktree-scoping behaviour (#815):
project home reads the project checkout (`onProjectFileStatus('p1', undefined)`), a selected agent
reads that agent's worktree (`'run-1'`), switching agents re-reads (`rerender` → `'run-2'`), and a
changed file carries its status letter (`M`).

Do the tests verify their claims?

- All four use awaited `waitFor` around the async assertions; no un-awaited promises.
- The switch test only asserts the *new* call happened; it does not assert the old dots were
  dropped — but `usePolled`'s reset is the mechanism under test elsewhere (use-async tests), and
  the call-args assertion is the scoping fact this suite claims. Adequate.
- The letter test relies on `getByText('M')` being unique — with the two-file fixture and only
  README.md modified, it is.
- Mock hygiene: `onProjectFileStatus` cleared and re-primed per test; `cleanup` in `afterEach`
  unmounts and stops the 8s poll interval.

Fragile-but-working detail worth recording: `vi.mock('../rpc/reads.js')` replaces the whole module
with only `onProjectFileStatus`, yet `FileTree` imports `FilePreviewHover`, whose module imports
`onFileDiff`/`onFileContent` from the same mocked module. Vitest resolves missing mock exports
lazily (at property access), and these tests never open a preview card, so nothing throws today —
but any future test that hovers a file (or an eager-binding change) would hit "No 'onFileDiff'
export is defined on the mock". A latent test-infrastructure trap, not a product bug, and not a
current failure: not reported in the JSON.

Coverage gaps (not bugs; the test SPEC scopes the suite to #815): the filter box, the zero-match
message, folder dots / mixed-status folding, the empty-files null render, and click-to-toggle are
untested here.

## Functions (low-level)

- `onProjectFileStatus` mock + module mock: correct vitest pattern (factory closes over a const
  defined before the dynamic `await import('./FileTree.js')`).
- `noop`, `files` fixtures: minimal; `files` includes a nested path (`src/app.ts`) and a root file
  so the tree exercises both branches of `buildTree`. Correct.
- Each test: arranges props/mock, asserts call args or rendered letter. All falsifiable. Correct.

## Bugs found

None found.
