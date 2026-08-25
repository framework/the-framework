# Bug analysis: packages/framework/src/framework-gitignore.ts

## Business logic (high-level)

Defines the one `.the-framework/.gitignore` written at install (#313): ignore everything in the directory, re-include the gitignore itself and the layout marker. Checked against `framework-gitignore.SPEC.md`: "ignores everything under `.the-framework/` except itself and the layout marker" — the generated content is exactly `# comment\n*\n!.gitignore\n!LAYOUT\n`, which does that.

Gitignore-semantics check (the subtle part): a `*` inside `.the-framework/.gitignore` applies relative to `.the-framework/`; negations `!.gitignore` and `!LAYOUT` work because the *directory containing them* is not itself excluded by this file (git's "cannot re-include inside an ignored directory" rule does not bite: `*` ignores `.the-framework`'s children, and the negated entries are direct children, not nested under an ignored subdirectory). Worktrees under `.the-framework/branches/<name>/` are ignored via `*` matching `branches`. `LAYOUT` comes from `layout.ts`'s `LAYOUT_FILE`, so a rename of the marker file propagates here automatically — same lockstep philosophy as the layout gate.

Also per the SPEC, this file's *presence* marks a project as activated; the content is deterministic, so repeated installs are idempotent byte-for-byte.

## Functions (low-level)

- **`gitignorePath(cwd)`** — `join(cwd, '.the-framework', '.gitignore')`. Plain path join; no traversal risk (cwd comes from the CLI's project root). Verdict: correct.
- **`frameworkGitignore()`** — returns the fixed content with trailing newline. Uses a template literal embedding `LAYOUT_FILE`; if the marker were ever renamed to something containing gitignore metacharacters (`#`, `!`, spaces) the pattern would break, but `LAYOUT` is a plain name and any rename runs through the layout-gate lockstep test. Verdict: correct.

## Bugs found

None found.
