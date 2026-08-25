# Bug analysis: packages/framework/scripts/gen-prompts.mjs

## Business logic (high-level)

Compiles `prompts/**/*.md` into `src/prompts.generated.ts` (#551) so prompts are authored as
markdown while code (including browser-reachable `client.ts` paths) imports plain strings. The
generated file is git-ignored (verified with `git check-ignore`) and rebuilt by
build/test/typecheck, so it cannot drift.

Properties checked:
- **Stable output** — `findMarkdown` sorts the collected absolute paths, so const order is
  deterministic across machines (all files live under one root, so absolute-path sort equals
  relative sort).
- **Faithful text** — `JSON.stringify(text)` escapes backticks/`${}`/unicode correctly (the
  stated reason for not using template literals); exactly one trailing newline is stripped
  (`replace(/\n$/, '')`), matching "the files end with one, the prompts they carry do not". A
  file ending in two newlines keeps one — correct, that second newline is content.
- **Windows separators** — `relative(...).split('\\').join('/')` normalizes the doc-comment path.
- **Name mangling** — `constName` uppercases and collapses non-alphanumerics to `_`. Collisions
  (`a-b.md` vs `a_b.md`) or a leading digit would produce a broken/duplicated `export const` —
  but tsc compiles the generated file on every build, so either failure is loud, and I verified
  (probe over the current tree) that no current prompt file collides or starts with a digit.
  Relied-upon, not a bug.
- **Exclusion filter — bug found.** The header says "README.md and SPEC.md are documentation for
  humans, not prompts", but the filter is `entry.name !== 'README.md' && entry.name !== 'SPEC.md'`
  — exact names only. The repo's SDD convention gives every prompt a sibling `<stem>.SPEC.md`
  (25 of them exist under `prompts/`), and those all end in `.md` without being named `SPEC.md`,
  so they are compiled in. Verified in the working tree: `src/prompts.generated.ts` holds 50
  exports — the 25 prompts plus 25 `*_SPEC` constants (e.g. `DATA_BRANCH_PROTOCOL_SPEC`,
  `PRESETS_RESEARCH_SPEC`), and the file is ~102KB, roughly half spec prose. Nothing imports the
  `*_SPEC` names (checked all importers), so no wrong text reaches an agent — the damage is dead
  documentation shipped in `dist` (`files: ["dist"]`) and fed to the bundler/tsc on every build,
  directly against the script's stated intent.
- **Failure modes** — an unreadable prompts dir or file rejects the top-level await → non-zero
  exit → the build/test/typecheck run that invoked it fails loudly. Correct for a build script.

## Functions (low-level)

- `findMarkdown(dir)` — recursive readdir with `withFileTypes`; symlinked dirs would recurse
  (none exist under prompts/); sorted return. Verdict: correct except the exclusion (bug 1).
- `constName(relPath)` — as analyzed; total function. Verdict: correct for current inputs.
- module body — maps files to `{relPath, name, text}` concurrently, then writes the banner +
  body. `writeFile` clobbers the previous generated file atomically enough for a build step.
  Verdict: correct.

## Bugs found

1. `L30` (`findMarkdown`'s filter): sibling `<name>.SPEC.md` documentation files are compiled
   into `src/prompts.generated.ts`. Scenario: any build/test/typecheck run — the generator picks
   up all 25 `*.SPEC.md` files under `prompts/` because the exclusion matches only the literal
   name `SPEC.md`; the generated module doubles in size (~50KB of spec prose), those constants
   ship in the published `dist`, and every SPEC edit rebuilds/reships prompt code. Contradicts
   the script's own stated intent ("README.md and SPEC.md are documentation for humans, not
   prompts") — the `<stem>.SPEC.md` files are exactly that kind of documentation, mandated
   per-file by the repo's SDD rule. No functional corruption (nothing imports `*_SPEC`), so
   severity: minor. Fix sketch: extend the filter to
   `!entry.name.endsWith('.SPEC.md')` alongside the two exact names.
