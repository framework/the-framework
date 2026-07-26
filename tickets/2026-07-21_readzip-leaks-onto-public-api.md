Status: open
Priority: 2
GitHub: [#947](https://github.com/gemstack-land/the-framework/issues/947)

# readZip/ZipEntry leak onto the public API via the driver barrel

## TLDR

`driver/index.ts` re-exports `readZip`/`ZipEntry` (the ActionsDriver spike's internal zip reader) and `src/index.ts` `export *` carries them onto the published package surface, though nothing imports them from the barrel. Plan from the thread: mark both `@internal` now, and remove the re-export before the first npm publish — since #746 is still open, nothing has ever shipped to npm, so the removal breaks no external consumer. If #746 ships first, the removal moves to the next major. Found during the pinnacle-3 audit (PR #937).

## Why it matters

Accidental API surface is a one-way door: once published, removing it is a breaking change. Catching it while the package has never shipped makes the fix a free one-line barrel edit — but only if it happens before #746. The issue stays open until the barrel line is actually gone.

## Source

Imported from GitHub issue [gemstack-land/the-framework#947](https://github.com/gemstack-land/the-framework/issues/947), created 2026-07-21, label: `priority: low`, 1 comment.

### Original description

Found during the pinnacle-3 audit (PR #937).

driver/index.ts re-exports readZip/ZipEntry (the ActionsDriver spike's internal zip reader), and src/index.ts `export * from ./driver/index.js` carries them onto the published package surface. Nothing imports them from the barrel (the test imports the module directly). Removing them is technically breaking, so: drop them from the barrel in the next planned breaking window, or mark @internal.

### Notes from the GitHub thread

- Removal window proposal: (1) now, mark both `@internal` in `driver/actions-zip.ts`; (2) before the first npm publish (#746), remove the re-export from `driver/index.ts` (only importer is `actions-zip.test.ts`, which imports the module directly). If #746 ships before step 2, removal moves to the next major.
